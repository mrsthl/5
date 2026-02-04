---
name: 5:verify-implementation
description: Verifies a feature implementation is complete and working with multi-layer checks. Phase 4 of the 5-phase workflow.
allowed-tools: Read, Glob, Grep, Bash, Write, Task, AskUserQuestion
context: fork
user-invocable: true
---

# Verify Implementation (Phase 4)

Verify that an implementation is complete, correct, and meets feature requirements through multi-layer verification.

## Scope

**This command verifies the implementation across three layers:**
1. Infrastructure — files exist, build passes, tests pass
2. Feature completeness — code satisfies acceptance criteria and requirements from the feature spec
3. Quality — new files have corresponding tests

If verification finds gaps, it generates a fix plan and offers to apply fixes automatically.

## Process

### Step 1: Load All Artifacts

Read all workflow artifacts for the feature:

**Required:**
- `.5/features/{feature-name}/plan.md` — implementation plan (Phase 2)
- `.5/features/{feature-name}/state.json` — implementation state (Phase 3)

**Optional:**
- `.5/features/{feature-name}/feature.md` — feature spec (Phase 1)

**If `plan.md` or `state.json` is missing:** hard stop.
```
Cannot verify — missing required artifacts.

Missing: {plan.md | state.json | both}

Run these first:
- /5:plan-implementation {feature-name}  (creates plan.md)
- /5:implement-feature {feature-name}    (creates state.json)
```

**If `feature.md` is missing:** warn and continue. Feature completeness verification (Layer 2) will be skipped.
```
Note: feature.md not found — skipping feature completeness checks.
This is normal for quick-implement workflows. Infrastructure and quality checks will still run.
```

Extract from artifacts:
- Components table from `plan.md` (step, component, action, file, description, complexity)
- Build and test commands from `plan.md`
- Completed/failed components from `state.json`
- Acceptance criteria and functional requirements from `feature.md` (if present)

### Step 2: Infrastructure Verification (Layer 1)

#### 2a. Check Files Exist

For each component in the plan:
- Use Glob to verify the file exists
- Record: EXISTS / MISSING

#### 2b. Run Build

Execute the build command from the plan (or auto-detect from `.claude/.5/config.json`):

```bash
{build-command}
```

Record: SUCCESS / FAILED with errors.

**If build fails, stop here.** Broken code cannot be meaningfully verified for completeness. Set overall status to FAILED and skip to Step 6.

#### 2c. Run Tests

Execute the test command from the plan (or auto-detect):

```bash
{test-command}
```

Record: SUCCESS / FAILED with details (which tests failed, error messages).

### Step 3: Feature Completeness Verification (Layer 2)

**Skip this step entirely if `feature.md` was not found in Step 1.**

Spawn a sonnet agent to cross-reference the implementation against the feature spec:

```
Task tool call:
  subagent_type: general-purpose
  model: sonnet
  description: "Verify feature completeness for {feature-name}"
  prompt: |
    You are verifying that an implementation satisfies its feature specification.

    ## Feature Specification
    {full text of feature.md}

    ## Implementation Plan
    {full text of plan.md}

    ## Instructions

    1. **Read each implemented file** listed in the components table below:
       {components table from plan.md}

    2. **Check acceptance criteria** from the feature spec.
       For each acceptance criterion, determine:
       - SATISFIED — code clearly implements this criterion (cite file:line as evidence)
       - NOT SATISFIED — no code found that implements this criterion

    3. **Check functional requirements** from the feature spec.
       For each requirement, determine:
       - IMPLEMENTED — code implements this requirement (cite file:line)
       - NOT IMPLEMENTED — no code found for this requirement

    4. **Check component completeness** from the plan.
       For each component in the table, read the file and determine:
       - COMPLETE — file exists and implements what the description says
       - PARTIAL — file exists but is missing described functionality
       - MISSING — file does not exist

    ## Output Format
    Return EXACTLY this structure:

    ACCEPTANCE_CRITERIA:
    - criterion: "{text of criterion}"
      status: SATISFIED | NOT SATISFIED
      evidence: "{file:line}" or "none"
      notes: "{brief explanation}"

    REQUIREMENTS:
    - requirement: "{text of requirement}"
      status: IMPLEMENTED | NOT IMPLEMENTED
      evidence: "{file:line}" or "none"
      notes: "{brief explanation}"

    COMPONENTS:
    - component: "{component name}"
      file: "{file path}"
      status: COMPLETE | PARTIAL | MISSING
      notes: "{what's missing if partial}"

    SUMMARY:
    - criteria_satisfied: {N}/{M}
    - requirements_implemented: {N}/{M}
    - components_complete: {N}/{M}

    ## Rules
    - Read every file referenced in the components table
    - Be precise with evidence — cite actual file paths and line numbers
    - PARTIAL means the file exists but is missing specific functionality described in the plan
    - Do NOT interact with the user
    - Do NOT modify any files
```

Parse the agent's structured output into:
- Acceptance criteria results (satisfied/not satisfied counts)
- Requirements results (implemented/not implemented counts)
- Component completeness results (complete/partial/missing counts)

### Step 4: Quality Checks (Layer 3)

For each component with action `create` in the plan:
- Determine the expected test file path using common patterns:
  - `src/foo/Bar.ts` → look for `src/foo/Bar.test.ts`, `src/foo/Bar.spec.ts`, `test/foo/Bar.test.ts`, `tests/foo/Bar.test.ts`
  - `src/foo/bar.py` → look for `tests/foo/test_bar.py`, `tests/test_bar.py`, `src/foo/test_bar.py`
  - Adapt pattern based on project conventions
- Use Glob to check if a test file exists
- Record: HAS TEST / NO TEST

This is a lightweight check — it only verifies test files exist for new code, not test quality.

### Step 5: Determine Status

Evaluate all three layers:

**PASSED** — all conditions met:
- All files exist
- Build succeeds
- Tests pass
- All acceptance criteria satisfied (or Layer 2 skipped)
- All requirements implemented (or Layer 2 skipped)
- All components complete

**PARTIAL** — infrastructure OK but gaps exist:
- All files exist AND build succeeds AND tests pass
- BUT: some acceptance criteria not satisfied, OR some requirements not implemented, OR some components partial, OR some new files lack tests

**FAILED** — infrastructure problems:
- Any files missing, OR build fails, OR tests fail

### Step 6: Generate Verification Report

Write `.5/features/{feature-name}/verification.md` using the template structure from `.claude/templates/workflow/VERIFICATION-REPORT.md`.

The report covers:
- **Header:** ticket, feature, status, timestamp
- **Layer 1 — Infrastructure:** file existence checklist, build result, test result
- **Layer 2 — Feature Completeness:** acceptance criteria status, requirements status, component completeness (or "Skipped — no feature.md" if not available)
- **Layer 3 — Quality:** test coverage for new files
- **Summary table:** layer-by-layer pass/fail overview

### Step 7: Update State

Update `.5/features/{feature-name}/state.json`:
```json
{
  "verificationStatus": "passed | partial | failed",
  "verifiedAt": "{ISO-timestamp}",
  "verificationLayers": {
    "infrastructure": "passed | failed",
    "featureCompleteness": "passed | partial | skipped",
    "quality": "passed | partial"
  }
}
```

### Step 8: Handle Results

**If PASSED:**

```
Verification passed!

Layer 1 (Infrastructure): All files exist, build OK, tests OK
Layer 2 (Feature Completeness): {N}/{N} criteria satisfied, {N}/{N} requirements implemented
Layer 3 (Quality): {N}/{N} new files have tests

Report: .5/{feature-name}/verification.md

Would you like to commit these changes?
```

Use AskUserQuestion with options:
1. "Yes - commit now (Recommended)"
2. "No - I'll commit later"

If yes: stage and commit with message format `{TICKET-ID} {description}`.

Then go to Step 11 (Next Steps).

**If PARTIAL or FAILED:**

```
Verification {status}.

Layer 1 (Infrastructure): {summary}
Layer 2 (Feature Completeness): {summary}
Layer 3 (Quality): {summary}

{Count} issue(s) found. Generating fix plan...

Report: .5/{feature-name}/verification.md
```

Continue to Step 9.

### Step 9: Generate Fix Plan (PARTIAL or FAILED only)

Write `.5/features/{feature-name}/fix-plan.md` using the template structure from `.claude/templates/workflow/FIX-PLAN.md`.

Build fix entries from verification results:

**From Layer 1 (Infrastructure):**
- Missing files → fix: create the file (reference the plan component)
- Build failures → fix: describe the build error and likely cause
- Test failures → fix: describe failing test and likely cause

**From Layer 2 (Feature Completeness):**
- Unsatisfied acceptance criteria → fix: describe what code needs to change
- Unimplemented requirements → fix: describe what needs to be added
- Partial components → fix: describe what's missing from the component

**From Layer 3 (Quality):**
- Missing test files → fix: create test file for the component

Each fix entry follows the same table format as `plan.md`:

| # | Category | File | Issue | Fix | Complexity |
|---|----------|------|-------|-----|------------|
| 1 | infrastructure | src/models/Foo.ts | File missing | Create file per plan component #3 | simple |
| 2 | feature-gap | src/services/Bar.ts | Missing validation for criterion "..." | Add input validation in processOrder() | moderate |
| 3 | quality | tests/services/Bar.test.ts | No test file for BarService | Create test file with basic CRUD tests | simple |

### Step 10: Offer Fix Options

Use AskUserQuestion:
1. "Apply fixes automatically (Recommended)" — spawn agents to apply each fix
2. "I'll fix manually, then re-run /5:verify-implementation"

**If user selects "Apply fixes automatically":**

For each fix in the fix plan, spawn an agent following the same pattern as `implement-feature`:

- **simple** fixes → `haiku` model
- **moderate** fixes → `haiku` or `sonnet` depending on context
- **complex** fixes → `sonnet` model

Group independent fixes for parallel execution. Fixes modifying the same file must be sequential.

```
Task tool call:
  subagent_type: general-purpose
  model: {based on complexity}
  description: "Fix: {short description}"
  prompt: |
    You are fixing a verification issue in a codebase.

    ## Issue
    Category: {infrastructure | feature-gap | quality}
    File: {file-path}
    Issue: {description of what's wrong}
    Fix: {description of what to do}

    ## Context
    {relevant section from plan.md or feature.md}

    ## Instructions
    1. If creating a new file: find a similar existing file using Glob, read it to understand the pattern, create the new file following that pattern
    2. If modifying a file: read the file, make the described change
    3. Verify the file exists after changes
    4. Report what you did

    Use Glob to find similar files. Use Read to understand patterns. Use Write/Edit to create/modify files.
```

After all fixes are applied, re-run build and tests:

```bash
{build-command}
{test-command}
```

Update `fix-plan.md` with results:
- Mark each fix as APPLIED / FAILED
- Record build and test results after fixes

Report to user:
```
Applied {N} fixes.

Build: {status}
Tests: {status}

{If any fixes failed, list them}

Updated: .5/{feature-name}/fix-plan.md
```

**If user selects manual fix:** exit with guidance.
```
Fix plan saved: .5/{feature-name}/fix-plan.md

When ready, re-run: /5:verify-implementation {feature-name}
```

### Step 11: Next Steps

Tell user:
```
Next steps:
1. Run `/clear` to reset context (recommended between phases)
2. Run `/5:review-code`
```
