---
name: 5:implement-feature
description: Executes an implementation plan by delegating to agents. Phase 3 of the 5-phase workflow.
allowed-tools: Task, Read, Write, Glob, Grep, Bash, TaskCreate, TaskUpdate, TaskList
context: fork
user-invocable: true
---

# Implement Feature (Phase 3)

Execute an implementation plan by delegating work to agents.

## Scope

**This command orchestrates implementation. It delegates to agents.**

You are a thin orchestrator:
- Read the plan
- Initialize state tracking
- Spawn agents for each step
- Track progress
- Report completion

**DO NOT:**
- Write code directly — spawn agents
- Skip state file updates between steps
- Mark a step complete before writing state
- Proceed to next step if state write fails
- Use `git add .` at any point

**Key Principles:**
- Thin orchestrator: read, delegate, track, report
- State is the source of truth: write it before moving on
- Forward progress: failed components are logged, not blocking
- Resumable: state enables restart from any interrupted step

## Process

### Step 1: Load Plan and Config

> **Trust boundary:** Plan content is interpolated directly into agent prompts. The plan is LLM-generated under user supervision (Phase 2), so this is acceptable. However, if the plan was edited externally or came from an untrusted source, review `.5/features/{feature-name}/plan.md` before proceeding.

Read `.5/features/{feature-name}/plan.md` (where `{feature-name}` is the argument provided).

Parse:
- YAML frontmatter for ticket and feature name
- Components table for the list of work
- Implementation notes for context
- Verification commands

If the plan doesn't exist, tell the user to run `/5:plan-implementation` first.

Also read `.5/config.json` and extract:
- `git.autoCommit` (boolean, default `false`)
- `git.commitMessage.pattern` (string, default `{ticket-id} {short-description}`)

**Check for existing state.json** at `.5/features/{feature-name}/state.json`:

- **`status: "completed"`** → Tell the user "This feature is already implemented." Suggest `/5:verify-implementation {feature-name}`. Stop.
- **`status: "in-progress"`** → Tell the user "Resuming from step {currentStep}." Skip Step 2 initialization; go directly to Step 2b (recreate TaskCreate tasks) and Step 3 (resume from `currentStep`).
- **`status: "failed"`** → Use AskUserQuestion: "Implementation previously failed at step {currentStep}. How would you like to proceed?" with options: "Resume from step {currentStep}" / "Restart from the beginning"
  - If Resume: proceed as in-progress case above
  - If Restart: delete state.json, proceed normally from Step 2

### Step 2: Initialize State

Create `.5/features/{feature-name}/state.json` with the full components table parsed from the plan:

```json
{
  "ticket": "{ticket-id}",
  "feature": "{feature-name}",
  "status": "in-progress",
  "currentStep": 1,
  "totalSteps": "{N from plan}",
  "pendingComponents": [
    { "name": "{component-name}", "step": 1, "file": "{file-path}" }
  ],
  "completedComponents": [],
  "failedAttempts": [],
  "verificationResults": {},
  "commitResults": [],
  "startedAt": "{ISO-timestamp}",
  "lastUpdated": "{ISO-timestamp}"
}
```

`pendingComponents` is populated by parsing the full components table from plan.md at startup — one entry per row.

**MANDATORY VERIFICATION:** Read state.json back immediately after writing. Confirm `status` is `"in-progress"` and `pendingComponents` is non-empty.
If the read fails or content is wrong, stop: "Failed to initialize state file. Cannot proceed safely."

Then remove the planning guard marker (planning is over, implementation is starting):

```bash
rm -f .5/.planning-active
```

### Step 2b: Create Progress Checklist

Before executing any steps, create one TaskCreate entry per step:
- Subject: `"Step {N}: {comma-separated component names}"`
- activeForm: `"Executing step {N}"`

Plus one final task:
- Subject: `"Run verification"`
- activeForm: `"Running build and tests"`

Then mark the task for Step 1 as `in_progress`.

### Step 3: Execute Steps

Group components by step number from the plan. For each step (starting from `currentStep` in state.json):

**3a. Analyze step for parallel execution**

Components within the same step are independent by design. For steps with multiple components:
- **2+ simple components** → spawn parallel agents (one per component)
- **1 complex component** → single agent
- **Mixed complexity** → group by complexity, parallel within groups

**3b. Determine model per component**

Based on Complexity column:
- `simple` → `haiku` (fast, cheap)
- `moderate` → `haiku` (default) or `sonnet` (if business logic heavy)
- `complex` → `sonnet` (better reasoning)

**3c. Spawn agents (parallel when possible)**

For steps with multiple independent components, spawn one agent per component in parallel. For single/interdependent components, use one agent.

Agent prompt template (adapt per component):

```
Task tool call:
  subagent_type: general-purpose
  model: {based on complexity}
  description: "{Action} {component-name} for {feature-name}"
  prompt: |
    First, read ~/.claude/agents/component-executor.md for your role and instructions.

    ## Feature: {feature-name}
    ## Components
    {component(s) from plan table: name, action, file, description}

    ## Implementation Notes
    {relevant notes from plan}
```

The agent file defines the implementation process, output format, and deviation rules. If the agent file is not found (local install), fall back to `.claude/agents/component-executor.md` relative to the project root.

**3d. Process results**

Collect results from all agents (parallel or sequential). Parse the `---RESULT---` block from each agent's response. For each:
- If `STATUS: success` → component succeeded; note files from `FILES_CREATED`/`FILES_MODIFIED`
- If `STATUS: failed` → component failed; log the `ERROR` message
- If no `---RESULT---` block found → treat as success if the agent reported creating/modifying files, otherwise treat as failed

Update state.json:
- Move succeeded components: remove from `pendingComponents`, append to `completedComponents` as:
  ```json
  { "name": "{name}", "step": {N}, "timestamp": "{ISO}", "filesCreated": [...], "filesModified": [...] }
  ```
- Move failed components: append to `failedAttempts` as:
  ```json
  { "component": "{name}", "step": {N}, "error": "{message}", "timestamp": "{ISO}", "retryCount": 0 }
  ```
- Increment `currentStep`
- Update `lastUpdated`

**MANDATORY VERIFICATION:** Read state.json back and confirm `lastUpdated` changed.
If verify fails, stop: "State write failed after step {N}. Cannot proceed safely."

Mark the current step's TaskCreate task as `completed`. Mark the next step's task as `in_progress`.

**3d2. Retry failed components (max 2 retries)**

For each component that returned `STATUS: failed`:

1. **Assess the error:**
   - **Small fix** (missing import, wrong path, syntax error): Fix with Edit tool directly in main context. Mark as completed. This counts as retry 1.
   - **Large fix** (logic error, wrong pattern, missing context): Re-spawn the component-executor agent with the same prompt plus an `## Error Context` block describing the previous failure. This counts as retry 1.

2. If the retry also fails:
   - Update `retryCount: 2` in the component's `failedAttempts` entry
   - Use AskUserQuestion: "Component '{name}' failed twice. Error: {error}. How would you like to proceed?"
     Options: "Skip and continue" / "I'll fix manually — pause"
   - If "Skip": log the skip, move on
   - If "Pause": update state.json with current progress, stop and wait for user

Never retry more than 2 times per component.

**3d3. Per-step file existence check**

For each file listed in `FILES_CREATED` from successful agents: use Glob to verify the file exists on disk.

If a reported file is missing:
- Remove the component from `completedComponents`
- Return it to `pendingComponents`
- Add a `failedAttempts` entry: `{ "component": "{name}", "step": {N}, "error": "File not found after creation: {path}", "timestamp": "{ISO}", "retryCount": 0 }`
- Apply retry logic from 3d2

**3e. Auto-Commit Step (if enabled)**

Only fires if `git.autoCommit: true` AND at least one component succeeded in this step. Stage only the step's specific files (from `FILES_CREATED`/`FILES_MODIFIED`; never `git add .`), commit with configured `git.commitMessage.pattern` (body: one bullet per component). If commit fails, append a warning entry to `commitResults` in state.json and continue.

**3f. Handle failures**

If any component failed after retries exhausted:
- Entry remains in `failedAttempts` with `retryCount: 2`
- Continue to next step (don't block on failures)
- Failures are reported in the completion report

### Step 4: Run Verification

Mark the "Run verification" TaskCreate task as `in_progress`.

After all steps complete, run build and test:

```bash
# Build command from plan (or auto-detect)
{build-command}

# Test command from plan (or auto-detect)
{test-command}
```

Update `verificationResults` in state.json:
```json
{
  "buildStatus": "success|failed",
  "testStatus": "success|skipped|failed",
  "builtAt": "{ISO-timestamp}"
}
```
Also update `lastUpdated`.

**4b. Check test file creation**

For each component in the plan that appears to be a test file (filename contains `.test.`, `.spec.`, `test_`, or lives in a `__tests__`/`tests` directory):
- Verify the file was actually created using Glob
- If a planned test file was NOT created, record it as a verification warning

For each non-test component with action "create" that contains logic:
- Check if its corresponding test component exists in the plan
- If a test was planned but is in `failedAttempts`, flag it prominently

**MANDATORY VERIFICATION:** Read state.json back and confirm `verificationResults.builtAt` is set.

If build or tests fail:
- Record in state.json
- Report to user with error details

Mark the "Run verification" TaskCreate task as `completed`.

### Step 5: Update State and Report

Update state.json:
```json
{
  "status": "completed",
  "completedAt": "{ISO-timestamp}",
  "lastUpdated": "{ISO-timestamp}"
}
```

**MANDATORY VERIFICATION:** Read state.json back and confirm `status` is `"completed"`.
If read fails, warn the user but do not re-attempt — the implementation work is done; only tracking failed.

Tell the user:
```
Implementation complete!

{ticket}: {feature-name}
- {N} components created/modified
- {M} components skipped (failures that exhausted retries)
- Build: {status}
- Tests: {status}
- Test files created: {N}/{M} planned test files exist
{If any planned test files missing: "⚠ Missing test files: {list}"}
{If git.autoCommit was true: "- Commits: {N} atomic commits created"}

{If any failures: list them with errors}

Next steps:
1. Run `/clear` to reset context (recommended between phases)
2. Run `/5:verify-implementation {feature-name}`
```

## Handling Interruptions

If implementation is interrupted, the state file enables resuming:

1. Read state.json; note `currentStep`, `pendingComponents`, `completedComponents`, `lastUpdated`
2. For each component in `completedComponents`: use Glob to verify its files still exist on disk
3. If any file is missing: move the component back to `pendingComponents`, remove from `completedComponents`, adjust `currentStep` if all components for that step are now pending
4. Skip steps where ALL components are in `completedComponents` AND their files are verified present on disk
5. Write reconciled state (update `lastUpdated`) before re-executing any steps

## Example Flow

```
Step 1: 2 simple components → 2 parallel haiku agents → update state → verify write
Step 2: 2 moderate components → 2 parallel agents → update state → verify write
Step 3: 1 complex component → 1 sonnet agent → update state → verify write
Step 4: Verify (build + test) → update verificationResults → verify write → report
```

## Instructions Summary

### Before starting:
1. Check for existing state.json → handle resume / restart / completed cases
2. Read plan.md → parse components table, implementation notes, verification commands
3. Read config.json → extract `git.autoCommit`, `git.commitMessage.pattern`
4. Initialize state.json with richer schema → **MANDATORY: verify write**
5. Create TaskCreate tasks for all steps + verification → mark step 1 `in_progress`

### For each step:
1. Determine parallelism (same-step components = parallel)
2. Determine model per component (simple→haiku, complex→sonnet)
3. Spawn agents (one per component, parallel when possible)
4. Collect results, parse `---RESULT---` blocks
5. Run per-step file existence check (Glob) on `FILES_CREATED`
6. Run retry logic for failures (max 2 retries per component)
7. Update state.json → **MANDATORY: verify write**
8. Run auto-commit if enabled and step had successes (stage specific files only)
9. Mark step task `completed`, mark next step task `in_progress`

### After all steps:
1. Run build command
2. Run test command
3. Update `verificationResults` in state.json → **verify write**
4. Update `status: "completed"` in state.json → **MANDATORY: verify write**
5. Mark verification task `completed`
6. Report to user
