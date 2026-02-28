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

Also read `.5/config.json` and extract:
- `git.autoCommit` (boolean, default `false`)
- `git.commitMessage.pattern` (string, default `{ticket-id} {short-description}`)

Extract from artifacts:
- Components table from `plan.md` (step, component, action, file, description, complexity)
- Build and test commands from `plan.md`
- Completed/failed components from `state.json`
- Acceptance criteria and functional requirements from `feature.md` (if present)
- Number of commits created from `state.json` `commitResults` (if auto-commit was used)

### Step 2: Infrastructure Verification (Layer 1)

#### 2a. Check Files Exist

For each component in the plan:
- Use Glob to verify the file exists
- Record: EXISTS / MISSING

#### 2b. Run Build

Execute the build command from the plan (or auto-detect from `.5/config.json`):

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
    Verify that an implementation satisfies its feature specification.

    ## Feature Specification
    {full text of feature.md}

    ## Implementation Plan
    {full text of plan.md}

    ## Instructions
    1. Read each file in the components table
    2. For each acceptance criterion: SATISFIED (cite file:line) or NOT_SATISFIED
    3. For each requirement: IMPLEMENTED (cite file:line) or NOT_IMPLEMENTED
    4. For each component: COMPLETE, PARTIAL (note what's missing), or MISSING

    ## Output Format
    End with a results block:

    ---VERIFICATION---
    ---ACCEPTANCE_CRITERIA---
    {SATISFIED | NOT_SATISFIED | criterion text | file:line or "none"} (one per line)
    ---REQUIREMENTS---
    {IMPLEMENTED | NOT_IMPLEMENTED | requirement text | file:line or "none"} (one per line)
    ---COMPONENTS---
    {COMPLETE | PARTIAL | MISSING | component name | file path | notes} (one per line)
    ---SUMMARY---
    criteria_satisfied: {N}/{M}
    requirements_implemented: {N}/{M}
    components_complete: {N}/{M}
    ---END_VERIFICATION---

    Rules: Read every file. Cite file:line evidence. Do NOT modify files or interact with user.
```

Parse the `---VERIFICATION---` ... `---END_VERIFICATION---` block. If malformed, fall back to extracting summary counts from prose.

From the parsed output, collect:
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

**Test requirement enforcement:**
- Components with logic (services, controllers, repositories, hooks, utilities, helpers) without tests → MISSING_REQUIRED_TEST (error-level)
- Declarative components (types, interfaces, models without logic) without tests → MISSING_OPTIONAL_TEST (info-level, not counted as issues)

If no test framework detected (no test runner in config, no existing test files found via Glob for `**/*.test.*`, `**/*.spec.*`, `**/test_*.*`), downgrade all MISSING_REQUIRED_TEST to warnings with note: "No test framework detected."

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
- BUT: some acceptance criteria not satisfied, OR some requirements not implemented, OR some components partial, OR logic-bearing components lack tests but project has no test framework

**FAILED** — infrastructure problems:
- Any files missing, OR build fails, OR tests fail
- Any logic-bearing components lack test files (MISSING_REQUIRED_TEST) AND project has a test framework

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

Report the status with layer-by-layer summary and link to `verification.md`.

- **PASSED:** If `git.autoCommit: false`, offer to commit via AskUserQuestion. If `git.autoCommit: true`, note commits were already made. Go to Step 11.
- **PARTIAL or FAILED:** Note issue count, continue to Step 9.

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
- Missing required test files (logic-bearing components) → fix: create test file for the component (priority: high)
- Missing optional test files (declarative components) → note in report, no fix entry

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

Spawn agents following `implement-feature` patterns (simple→haiku, moderate→haiku/sonnet, complex→sonnet). Group independent fixes for parallel execution; same-file fixes must be sequential.

Each agent prompt includes: category, file path, issue description, fix description, and relevant context from plan/feature spec. Agent finds similar files via Glob, reads patterns, applies fix with Write/Edit.

After fixes: re-run build and tests. If `git.autoCommit: true` and fixes succeeded, commit fix files with `{ticket-id} fix verification issues`. Update `fix-plan.md` with APPLIED/FAILED status per fix.

**If user selects manual fix:** save `fix-plan.md` and exit with re-run guidance.

**Iteration limit:** On 3rd+ verify+fix cycle, warn user to consider manual fixes or revisiting the plan.

### Step 11: Next Steps

Tell user:
```
Next steps:
1. Run `/clear` to reset context (recommended between phases)
2. Run `/5:review-code`
```
