---
name: 5:verify-implementation
description: Verifies completed feature implementation by delegating checks to verification-agent. Runs in forked context to minimize main context usage.
allowed-tools: Read, Glob, Write, AskUserQuestion, Bash, Task, mcp__jetbrains__*
context: fork
user-invocable: true
---

# Verify Implementation (Phase 4)

## Overview

This skill provides comprehensive verification of a completed feature implementation. It is typically invoked:
1. Automatically by `/implement-feature` at the end of Wave 7
2. Manually by the developer to verify a feature
3. After fixing issues to re-verify

**Architecture:** `Command -> Agent -> Tools`
- This command runs in forked context to minimize main context usage
- Delegates verification work to the verification-agent (also forked context)
- Handles reporting, state updates, and user interaction within the forked context

## ⚠️ CRITICAL SCOPE CONSTRAINT

**THIS COMMAND VERIFIES IMPLEMENTATION. IT DELEGATES CHECKS TO AGENT.**

Your job in this phase:
✅ Load implementation plan
✅ Spawn verification-agent
✅ Process verification results
✅ Save verification report
✅ Update state file
✅ Prompt for commit (if passed)
✅ Tell user to run /5:review-code

Your job is NOT:
❌ Run compilation directly (agent does this)
❌ Run tests directly (agent does this)
❌ Detect problems directly (agent does this)
❌ Block on warnings (only errors block)
❌ Create commits without user approval
❌ Skip asking about commit

**After prompting for commit and informing the user, YOUR JOB IS COMPLETE. EXIT IMMEDIATELY.**

## ❌ Boundaries: What This Command Does NOT Do

**CRITICAL:** This command has a LIMITED scope. Do NOT:

- ❌ **Run compilation directly** - verification-agent handles this
- ❌ **Run tests directly** - verification-agent handles this
- ❌ **Detect problems directly** - verification-agent handles this
- ❌ **Block on warnings** - Only errors block completion
- ❌ **Auto-commit** - Always ask user first
- ❌ **Skip state file update** - State update is mandatory
- ❌ **Start code review** - That's Phase 5 (/5:review-code)

**If you find yourself running builds or tests directly, STOP. You should be spawning the verification-agent instead.**

## Verification Process

### Step 1: Load Implementation Plan

Read the implementation plan from `.5/{feature-name}/plan/` where `{feature-name}` is the argument provided by the user.

**Error Handling:** If the plan directory is missing:
- Return fail status immediately
- Display clear error message: "Error: Implementation plan not found at `.5/{feature-name}/plan/`. Please run /5:plan-implementation first."
- Do not proceed to Step 2

**Load metadata:**
- Read `.5/{feature-name}/plan/meta.md`
- Parse YAML frontmatter for basic plan info

**Load verification config:**
- Read `.5/{feature-name}/plan/verification.md`
- Extract:
  - `build_command`
  - `test_command`
  - Expected New Files list
  - Expected Modified Files list
  - Build Targets list
  - Test Modules list

**Load component checklist (aggregate from all step files):**
- For each step (1 to total_steps from meta.md):
  - Read `.5/{feature-name}/plan/step-{N}.md`
  - Extract "Expected Outputs" section (files created/modified)
- Build comprehensive expected files list to pass to verification-agent

### Step 2: Spawn verification-agent

Read `.claude/agents/verification-agent.md` for agent instructions, then spawn via Task tool:

```
Task tool call:
  subagent_type: general-purpose
  description: "Verify {feature-name}"
  prompt: |
    {Contents of verification-agent.md}

    ---

    ## Your Task

    Feature Name: {feature-name}
    Implementation Plan Path: .5/{feature-name}/plan/
    Expected Files:
    - {path/to/file1.ext}
    - {path/to/file2.ext}
    (aggregated from all step files in Step 1)
    Affected Modules:
    - {module-path-1}
    - {module-path-2}
    (from verification.md)
    Test Modules:
    - {module-path-for-tests}
    (from verification.md)
    Build Command: {from verification.md}
    Test Command: {from verification.md}
```

### Step 3: Process Agent Results

Receive the structured results from verification-agent:
- Overall status (passed/passed-with-warnings/failed)
- Implementation completeness results (tasks, method signatures, test coverage, acceptance criteria)
- File existence results
- Problem detection results (errors vs warnings)
- Compilation results
- Test results
- Generated verification report (Markdown)

### Step 4: Save Verification Report

Write the verification report from the agent to:
`.5/{feature-name}/verification.md`

### Step 5: Update State File

Update `.5/{feature-name}/state.json` with verification results:

```json
{
  "verificationResults": {
    "status": "passed | passed-with-warnings | failed",
    "timestamp": "{ISO timestamp}",
    "implementationCompleteness": {
      "tasksTotal": N,
      "tasksCompleted": N,
      "tasksPartial": N,
      "tasksMissing": N
    },
    "filesChecked": N,
    "filesExist": N,
    "compilationStatus": "success | failed",
    "testStatus": "passed | failed",
    "testsTotal": N,
    "testsPassed": N,
    "testsFailed": N,
    "errorsFound": N,
    "warningsFound": N,
    "reportPath": ".5/{feature-name}/verification.md"
  }
}
```

If status is "passed" or "passed-with-warnings", also update:
```json
{
  "status": "completed",
  "completedAt": "{ISO timestamp}"
}
```

### Step 6: Inform Developer

**If PASSED:**
```
Verification PASSED!

All checks completed successfully:
- Implementation: {N}/{N} tasks completed
- Files: {N}/{N} exist
- Compilation: Success
- Tests: All passing ({N} tests)
- Errors: 0
- Warnings: {N}

Verification report: .5/{feature-name}/verification.md

Next steps:
1. Commit your changes (recommended before code review)
2. Run `/clear` to reset context
3. Run `/5:review-code` for CodeRabbit review
```

**If PASSED WITH WARNINGS:**
```
Verification PASSED with warnings

All critical checks passed, but warnings were found:
- Implementation: {N}/{N} tasks completed ({N} partial or minor deviations)
- Files: {N}/{N} exist
- Compilation: Success
- Tests: All passing ({N} tests)
- Errors: 0
- Warnings: {N}

See warnings in verification report:
.5/{feature-name}/verification.md

You may address warnings before committing, but they don't block completion.

Next steps:
1. Commit your changes (recommended before code review)
2. Run `/clear` to reset context
3. Run `/5:review-code` for CodeRabbit review
```

**If FAILED:**
```
Verification FAILED

Issues found:
- Implementation: {N}/{N} tasks incomplete
- Files missing: {N}
- Compilation: Failed
- Tests: {N} failures
- Errors: {N}

See detailed errors in verification report:
.5/{feature-name}/verification.md

Please fix the errors and complete missing tasks, then re-run /verify-implementation {feature-name}
```

### Step 7: Prompt for Commit

**Only if verification PASSED or PASSED WITH WARNINGS**, use AskUserQuestion to ask if the user wants to commit the changes:

**Question:**
```
Would you like to commit these changes now?

It's recommended to commit changes before running CodeRabbit review (/review-code).
```

**Options:**
1. "Yes - Create commit now (Recommended)"
2. "No - I'll commit manually later"

**If user selects "Yes":**
- Create commit using the standard commit message format below
- Stage all relevant files
- Create commit with proper message format
- After committing, tell user: "Changes committed. Next steps: Run `/clear` followed by `/5:review-code` for CodeRabbit review."

**If user selects "No":**
- Tell user: "You can commit the changes manually when ready. After committing, run `/clear` followed by `/5:review-code` for CodeRabbit review."

#### Commit Message Format

**CRITICAL:** Follow this exact format when creating commits:

```
{TICKET-ID} Short description of what is done (~50 chars)

- What changed and why (important points only)
- Another change and reason
- Keep it concise, no verbose descriptions
- No emojis
```

**Guidelines:**
- First line: `{TICKET-ID}` + space + short description (~50 characters max)
- Blank line after first line
- Bullet points for changes (what changed and why)
- Only important points, no verbose descriptions
- No emojis
- No AI attribution or Co-Authored-By lines

**Implementation:**
When creating the commit, use HEREDOC format:

```bash
git add [relevant files]
git commit -m "$(cat <<'EOF'
PROJ-1234 Short description here

- Change 1 and reason
- Change 2 and reason
EOF
)"
```

## Instructions Summary

Follow these steps **IN ORDER** and **STOP after step 7**:

1. **Load implementation plan** from `.5/{feature-name}/plan/`:
   - Read meta.md for plan metadata
   - Read verification.md for build/test config and targets
   - Aggregate expected files from all step-N.md files
2. **Spawn verification-agent** with aggregated expected files, modules, and test modules
3. **Process agent results** - extract status, report, and structured data
4. **Save verification report** to `.5/{feature-name}/verification.md`
5. **Update state file** with verification results
6. **Inform developer** with clear status
7. **Prompt for commit** (if PASSED or PASSED WITH WARNINGS) and tell user: "Run `/clear` followed by `/5:review-code` for CodeRabbit review"

**🛑 STOP HERE. YOUR JOB IS COMPLETE. DO NOT START CODE REVIEW.**

## Key Principles

1. **Thin orchestrator** - Delegate verification work to agent, keep interactive parts in main context
2. **Comprehensive** - Agent checks everything (files, problems, compilation, tests)
3. **Categorized** - Separate errors (block) from warnings (report)
4. **Actionable** - Clear report of what needs fixing
5. **Persistent** - Save report for reference
6. **Resumable** - Can be re-run after fixes
7. **Commit ready** - Prompt for commit after successful verification


## Error Handling

If the verification-agent fails to return results:
1. Record the failure in the state file
2. Mark overall verification as FAILED
3. Include diagnostic information in report
4. Suggest re-running verification

## Related Documentation

- [Agent: verification-agent](../agents/verification-agent.md)
- [/implement-feature command](implement-feature.md)
- [/plan-implementation command](plan-implementation.md)
