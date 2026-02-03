---
name: 5:verify-implementation
description: Verifies a feature implementation is complete and working. Phase 4 of the 5-phase workflow.
allowed-tools: Read, Glob, Grep, Bash, Write, AskUserQuestion
context: fork
user-invocable: true
---

# Verify Implementation (Phase 4)

Verify that an implementation is complete and working.

## Scope

**This command verifies the implementation. It does NOT fix issues.**

If verification fails, report what's wrong. The user decides next steps.

## Process

### Step 1: Load Plan and State

Read `.5/{feature-name}/plan.md` and `.5/{feature-name}/state.json`.

Extract:
- Components list from plan (the table)
- Build and test commands from plan
- Completed/failed components from state

If plan doesn't exist, tell user to run `/5:plan-implementation` first.

### Step 2: Check Files Exist

For each component in the plan:
- Use Glob to verify the file exists
- Record: exists / missing

### Step 3: Run Build

Execute the build command from the plan (or auto-detect):

```bash
{build-command}
```

Record: success / failed with errors

### Step 4: Run Tests

Execute the test command from the plan (or auto-detect):

```bash
{test-command}
```

Record: success / failed with details

### Step 5: Generate Report

Create `.5/{feature-name}/verification.md`:

```markdown
# Verification Report: {TICKET-ID}

**Status:** PASSED | FAILED
**Verified:** {timestamp}

## Files
- [x] {path} - exists
- [ ] {path} - MISSING

## Build
Status: {success|failed}
{errors if any}

## Tests
Status: {success|failed}
Total: {N}, Passed: {N}, Failed: {N}
{failure details if any}

## Summary
- Files: {N}/{M} exist
- Build: {status}
- Tests: {status}
```

### Step 6: Update State

Update `.5/{feature-name}/state.json`:
```json
{
  "verificationStatus": "passed|failed",
  "verifiedAt": "{ISO-timestamp}"
}
```

### Step 7: Report to User

**If PASSED:**
```
Verification passed!

- Files: {N}/{N} exist
- Build: Success
- Tests: {N} passing

Report: .5/{feature-name}/verification.md

Would you like to commit these changes?
```

Use AskUserQuestion with options:
1. "Yes - commit now (Recommended)"
2. "No - I'll commit later"

If yes: stage and commit with message format `{TICKET-ID} {description}`

**If FAILED:**
```
Verification failed.

Issues:
- {list missing files}
- {list build errors}
- {list test failures}

Report: .5/{feature-name}/verification.md

Fix the issues and re-run: /5:verify-implementation {feature-name}
```

## After Verification

Tell user:
```
Next: /5:review-code (optional, requires CodeRabbit)
```
