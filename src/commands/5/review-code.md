---
name: 5:review-code
description: Reviews code changes using CodeRabbit CLI by delegating execution and parsing to review-processor agent. Handles user interaction and fix application in main context.
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, AskUserQuestion, Task, mcp__jetbrains__*
model: sonnet
context: fork
user-invocable: true
---

# Review Code with CodeRabbit (Phase 5)

## Overview

This skill automates code review using the CodeRabbit CLI. It supports two workflows:

**Workflow A: Interactive Review** (default)
1. Checks prerequisites in main context
2. Asks user what to review
3. Delegates CodeRabbit execution and output parsing to review-processor agent
4. Presents structured results and asks user for decisions
5. Applies fixes based on user approval
6. Reports results

**Workflow B: File-Based Annotation** (user preference)
1. Runs CodeRabbit and saves findings to `.5/{feature-name}/review-{timestamp}-findings.md`
2. User edits the file to mark which findings to fix ([FIX], [SKIP], [MANUAL])
3. User runs `/review-code apply` to read annotations and apply marked fixes

**Architecture:** `Command -> Agent -> CodeRabbit CLI`
- This command stays in the main context (user interaction, fix application)
- review-processor agent runs CodeRabbit and categorizes findings (forked context)

## ⚠️ CRITICAL SCOPE CONSTRAINT

**THIS COMMAND REVIEWS CODE AND APPLIES USER-APPROVED FIXES ONLY.**

Your job in this phase:
✅ Check CodeRabbit prerequisites
✅ Ask user what to review
✅ Spawn review-processor agent
✅ Present findings overview to user
✅ Ask user which fixes to apply
✅ Apply ONLY user-approved fixes
✅ Verify changes (compile and test)
✅ Save review report

Your job is NOT:
❌ Run CodeRabbit directly (agent does this)
❌ Parse CodeRabbit output directly (agent does this)
❌ Apply fixes without user approval
❌ Auto-apply complex refactoring
❌ Skip the overview step
❌ Skip verification after applying fixes
❌ Proceed if CodeRabbit not installed

**ALWAYS GET USER CONSENT BEFORE APPLYING ANY FIXES. This is a review tool, not an auto-fix tool.**

## ❌ Boundaries: What This Command Does NOT Do

**CRITICAL:** This command has a LIMITED scope. Do NOT:

- ❌ **Run CodeRabbit directly** - review-processor agent handles this
- ❌ **Parse CodeRabbit output directly** - review-processor agent handles this
- ❌ **Apply fixes without approval** - ALWAYS ask user first
- ❌ **Auto-apply refactoring** - Even if CodeRabbit suggests it
- ❌ **Skip the overview** - User must see all findings first
- ❌ **Skip verification** - Always compile and test after fixes
- ❌ **Assume user wants all fixes** - Each fix needs approval

**If you find yourself applying fixes without user approval, STOP IMMEDIATELY. User consent is mandatory.**

## Prerequisites

**Required:**
- CodeRabbit CLI installed (`coderabbit` command available)
- User logged in to CodeRabbit (`coderabbit auth status` shows authenticated)
- Git repository with changes to review

**Installation:**
If CodeRabbit is not installed, see: https://docs.coderabbit.ai/cli/installation

## Review Process

### Step 1: Check Prerequisites

Check if CodeRabbit CLI is installed and user is authenticated:

```bash
# Check if coderabbit command exists
which coderabbit

# Check authentication status
coderabbit auth status
```

**If not installed or not logged in:**
- Inform user: "CodeRabbit CLI is not installed or you're not logged in."
- Provide installation/login instructions
- Exit without reviewing

### Step 2: Check for Special Modes

**Check if user invoked with `apply` argument:**
```
/review-code apply
```

If `apply` mode:
- Skip to Step 11 (Apply Annotated Findings)
- Do NOT run a new review

**Otherwise, proceed with new review:**

### Step 3: Determine What to Review

Ask the user what to review and how to present results using AskUserQuestion:

**Question 1: What to review?**
1. **Staged changes** (default) - Review `git diff --cached`
2. **Unstaged changes** - Review `git diff`
3. **All changes** - Review both staged and unstaged
4. **Current branch** - Review all commits on current branch vs main/master
5. **Specific files** - User specifies file paths

**Question 2: How to review?**
1. **Interactive** (default) - Show findings and apply fixes immediately
2. **Save to file** - Save findings to `.5/{feature-name}/` for later annotation

### Step 4: Spawn review-processor Agent

Read `.claude/agents/review-processor.md` for agent instructions, then spawn via Task tool:

```
Task tool call:
  subagent_type: general-purpose
  description: "Run CodeRabbit review"
  prompt: |
    {Contents of review-processor.md}

    ---

    ## Your Task

    Review Scope: {scope from Step 3}
    Base Branch: {branch-name if scope is "branch"}
    Files: [{file-paths if scope is "files"}]
```

### Step 5: Process Agent Results

Receive structured results from review-processor:
- Total issues count
- Categorized findings: fixable, questions, manual
- Raw CodeRabbit output

If agent returned failure (CodeRabbit failed), report error and exit.

### Step 6: Branch Based on Review Mode

**If user selected "Save to file":**
- Skip to Step 10 (Save Findings to File)

**If user selected "Interactive":**
- Continue to Step 7

### Step 7: Provide Overview and Ask User

Present a concise overview of all findings:

```
CodeRabbit Review Results:

Summary:
- Total Issues: {N}
- Fixable: {N} (can be applied automatically)
- Questions: {N} (need clarification)
- Manual Review: {N} (require judgment)

Fixable Issues:
- ProductFactory.ts:45 - Remove unused import
- OrderValidator.ts:23 - Add null check for parameter

Questions:
? ProductFactory.ts:67 - Should validation check for empty strings?

Manual Review Needed:
- ProductFactory.ts:120 - Consider extracting method (complexity: 15)
```

**Use AskUserQuestion to ask:**
- Which fixable issues should be applied? (options: All, Selected, None)

### Step 8: Apply Fixes Based on User Agreement

Only apply fixes that the user has agreed to:

**If user chose "All fixable issues":**
- Apply all fixable issues automatically
- Track applied fixes

**If user chose "Selected":**
- Ask which specific fixes to apply
- Apply only selected fixes

**If user chose "None":**
- Skip to reporting

**For each fix to apply:**
1. Read the file
2. Apply the suggested fix using Edit tool
3. Format using IDE (if available) `reformat_file` if available
4. Track applied fixes

### Step 9: Handle Questions Based on User Preference

If there are questions from CodeRabbit, use AskUserQuestion:

**Options:**
1. "Ask me for each" - Present each question individually
2. "Skip all" - Add to manual review list

**If "Ask me for each":**
- For each question, use AskUserQuestion to get answer
- If answer requires code change, apply it
- Track as user-resolved

### Step 9b: Verify Changes

After applying fixes:

1. **Compile:**
   Use the `/build-project` skill to compile:
   ```
   Skill tool call:
     skill: "build-project"
     args: "target=compile"
   ```

2. **Check for problems:**
   Use IDE (if available) `get_file_problems` on modified files

3. **Run tests:**
   Use the `/run-tests` skill to run tests:
   ```
   Skill tool call:
     skill: "run-tests"
     args: "target=all"
   ```

4. **Report results:**
   - If compilation fails: Revert problematic fixes, report to user
   - If tests fail: Report which tests failed, suggest manual review
   - If all pass: Confirm fixes are successful

### Step 9c: Generate Review Summary

Create comprehensive summary report using the template structure.

**Template Reference:** Use the structure from `.claude/templates/workflow/REVIEW-SUMMARY.md`

The template contains placeholders for:
- **Header:** Reviewed scope, timestamp, user decisions summary
- **Summary:** Counts for total issues, applied fixes, user-resolved questions, manual review, skipped
- **Applied Fixes:** List of fixes applied with user approval (file:line - description)
- **User-Resolved Questions:** Questions answered by user with their decisions
- **Manual Review Needed:** Issues requiring human judgment
- **Skipped Issues:** Fixes user chose not to apply
- **Files Modified:** Summary of modified files with fix counts

### Step 10: Save Findings to File (File-Based Mode)

When user selects "Save to file", create a structured findings file that allows user annotation.

**Determine feature name:**
- Check most recent state file in `.5/*/state.json` to find current feature
- Or ask user which feature they're reviewing
- Use feature name for organizing review files

**Create directory if needed:**
```bash
mkdir -p .5/{feature-name}
```

**Generate timestamp:**
```
{timestamp} = Custom timestamp format: YYYYMMDD-HHmmss
Example: 20260128-103045
```

**File path:**
```
.5/{feature-name}/review-{timestamp}-findings.md
```

**File format:**

**Template Reference:** Use the structure from `.claude/templates/workflow/REVIEW-FINDINGS.md`

The template contains:
- **Header:** Generated timestamp, scope, total findings count
- **How to Use This File:** Instructions for user annotation with [FIX], [SKIP], [MANUAL] actions
- **Finding sections:** Repeated for each finding with:
  - File path, line number, category, severity
  - Description of what CodeRabbit found
  - Suggested fix
  - Original CodeRabbit message
  - Action placeholder (default [FIX])
  - Custom instructions field for [MANUAL] fixes
- **Summary:** Counts of total, fixable, questions, manual review
- **Next Steps:** Instructions to edit and run `/review-code apply`

**After saving file:**
- Inform user: "Findings saved to .5/{feature-name}/review-{timestamp}-findings.md"
- Provide instructions: "Edit the file to mark findings, then run: /review-code apply"
- Skip remaining steps (don't apply fixes interactively)

### Step 11: Apply Annotated Findings

When user runs `/review-code apply`, read the most recent findings file and apply marked fixes.

**Determine feature name:**
- Check most recent state file in `.5/*/state.json` to find current feature
- Or ask user which feature they're reviewing

**Find the most recent findings file:**
```bash
# Find most recent review findings file in the feature folder
ls -t .5/{feature-name}/review-*-findings.md | head -1
```

**If no findings file exists:**
- Inform user: "No findings file found. Run /review-code first to generate findings."
- Exit

**Read the findings file:**
- Parse each finding section
- Extract action marker: [FIX], [SKIP], or [MANUAL]
- For [MANUAL], also extract custom instructions

**Apply fixes:**

For each finding marked `[FIX]`:
1. Read the file specified in the finding
2. Apply the suggested fix using Edit tool
3. Track applied fix

For each finding marked `[MANUAL]` with custom instructions:
1. Read the file
2. Use the custom instructions to determine what to change
3. Apply the change using Edit tool
4. Track applied fix

For findings marked `[SKIP]`:
- Skip, don't apply

**After applying all marked fixes:**
- Continue to Step 9b (Verify Changes)
- Then Step 12 (Update Findings File)

### Step 12: Update Findings File After Apply

After applying fixes from an annotated file, update the findings file with results:

**Append to the end of the findings file:**

```markdown

---

## Application Results

**Applied:** {timestamp in ISO 8601 format, e.g., 2026-01-28T10:30:45Z}
**Fixes Applied:** {N}
**Custom Fixes:** {N}
**Skipped:** {N}

### Applied Fixes

- Finding #1 - {file}:{line} - {description} - ✓ Applied
- Finding #5 - {file}:{line} - {description} - ✓ Applied

### Custom Fixes

- Finding #3 - {file}:{line} - {description} - ✓ Applied with custom instructions

### Skipped

- Finding #2 - {file}:{line} - {description} - Skipped by user
- Finding #4 - {file}:{line} - {description} - Skipped by user

### Verification

**Compilation:** {success|failed}
**Tests:** {passed|failed|skipped}

{any error messages if failed}
```

**Inform user:**
- Show summary of applied fixes
- Reference the updated findings file
- Indicate if compilation/tests passed

### Step 13: Save Review Report (Interactive Mode)

For interactive mode only, save the review summary to:
```
.5/{feature-name}/review-{timestamp}.md
```

## Instructions Summary

### Interactive Mode (Default)

Follow these steps **IN ORDER**:

1. **Check prerequisites** - CodeRabbit installed and logged in
2. **Ask what to review** - Staged, unstaged, branch, or specific files
3. **Ask review mode** - Interactive or save to file
4. **Spawn review-processor** - Delegate CodeRabbit execution and parsing
5. **Process results** - Receive categorized findings
6. **Provide overview** - Show concise summary to user (MANDATORY - don't skip)
7. **Ask user** - Which fixes to apply, how to handle questions
8. **Apply fixes** - Only user-approved fixes, using Edit tool
9. **Handle questions** - Ask user for each if requested
10. **Verify changes** - Compile and test after applying fixes
11. **Save report** - Store in `.5/{feature-name}/`

**🛑 AFTER SAVING REPORT, YOUR JOB IS COMPLETE.**

### File-Based Annotation Mode

Follow these steps **IN ORDER**:

1. **Check prerequisites** - CodeRabbit installed and logged in
2. **Ask what to review** - Staged, unstaged, branch, or specific files
3. **User selects "Save to file"**
4. **Spawn review-processor** - Delegate CodeRabbit execution and parsing
5. **Process results** - Receive categorized findings
6. **Save findings file** - Store structured findings in `.5/{feature-name}/review-{timestamp}-findings.md`
7. **Tell user** - Edit the file and run `/5:review-code apply`

**🛑 STOP HERE if in save-to-file mode. Wait for user to edit and run apply.**

**When user runs `/5:review-code apply`:**

8. **Parse annotations** - Read user's action markers and custom instructions
9. **Apply marked fixes** - Apply [FIX] and [MANUAL] fixes automatically (user already approved via file annotations)
10. **Verify changes** - Compile and test after applying fixes
11. **Update findings file** - Append application results

**🛑 AFTER UPDATING FINDINGS FILE, YOUR JOB IS COMPLETE.**

## Key Principles

1. **Thin orchestrator** - Delegate CodeRabbit execution to agent, keep interaction in main context
2. **User consent first** - Always get user approval before applying any fixes
3. **Provide overview** - Give user a clear summary before asking for decisions
4. **Transparency** - Report all actions taken and user decisions made
5. **Verification** - Always compile and test after applying fixes
6. **Non-intrusive** - If not installed or logged in, gracefully exit


## Error Handling

### CodeRabbit Not Installed
```
CodeRabbit CLI is not installed.

To install:
1. Visit: https://docs.coderabbit.ai/cli/installation
2. Follow installation instructions for your OS
3. Run: coderabbit auth login
4. Then re-run: /review-code
```

### User Not Logged In
```
You're not logged in to CodeRabbit.

To log in:
1. Run: coderabbit auth login
2. Follow authentication prompts
3. Then re-run: /review-code
```

### Agent Failed
```
CodeRabbit review failed.

Error: {error from agent}

Troubleshooting:
1. Check if you have internet connection
2. Verify CodeRabbit CLI is up to date: coderabbit update
3. Check if git repository is valid
4. Try running manually: coderabbit review --plain
```

### Compilation Failed After Fixes
```
Compilation failed after applying fixes.

Reverting problematic fixes:
- ProductFactory.ts:45 (reverted)

Error:
{compilation error}

Action: Please review the suggested fix manually.
```

## Integration with Workflow

**When to use:**
- Before committing changes
- After completing a feature (before PR)
- When fixing bugs (to catch additional issues)

**Workflow integration:**
```
1. Make code changes
2. Stage changes: git add .
3. Run `/clear` to reset context
4. Run review: /5:review-code
5. Address manual issues if needed
6. Commit: git commit -m "message"
7. For next feature: Run `/clear` before starting /5:plan-feature
```

## Configuration

**Directory:** `.5/{feature-name}/` (organized by feature)

**File Types:**
- `review-{timestamp}-findings.md` - Annotatable findings (file-based mode)
- `review-{timestamp}.md` - Review summary reports (interactive mode)

**Timestamp Format:** Custom format `YYYYMMDD-HHmmss` (e.g., `20260128-103045`)

**Feature Detection:** Review files are organized by feature. The command will:
- Check most recent state file in `.5/*/state.json` to find current feature
- Or ask user which feature they're reviewing if unclear

## Related Documentation

- [Agent: review-processor](../agents/review-processor.md)
- [Workflow Guide](../docs/workflow-guide.md)
