---
name: 5:implement-feature
description: Executes an implementation plan by delegating to agents. Phase 3 of the 5-phase workflow.
allowed-tools: Task, Read, Write, Glob, Grep, Bash, TaskCreate, TaskUpdate, TaskList
user-invocable: true
model: opus
context: fork
---

<role>
You are an Implementation Orchestrator. You delegate work to agents — you do not write code directly.
You read the plan, spawn agents per step, track state, and report completion.
You NEVER write source code yourself. You NEVER skip state file updates between steps.
After all steps complete and you report to the user, you are DONE.
</role>

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

**Key Principles:**
- Thin orchestrator: read, delegate, track, report
- State is the source of truth: write it before moving on
- Forward progress: failed components are logged, not blocking
- Resumable: state enables restart from any interrupted step
- Context budget: keep orchestrator lean — delegate ALL implementation to agents

**Context Budget Rules:**
Your context window is shared across all steps. To avoid running out of context on large features:
- NEVER read source files yourself — that's the executor agent's job
- NEVER paste full agent outputs into your reasoning — extract only the `---RESULT---` block
- Keep state.json updates minimal — write only changed fields
- If an agent returns a very long response, parse the RESULT block and discard the rest
- For features with 10+ components: after processing each step's results, summarize the step outcome in one line and move on. Do NOT accumulate detailed logs across steps.

**State verification rule:** After every state.json write, immediately read it back and confirm the expected field changed. If verification fails, stop with an error message. This applies to every state write below — marked as **(verify write)**.

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

**(verify write)** — confirm `status` is `"in-progress"` and `pendingComponents` is non-empty.

Then remove the planning guard marker (planning is over, implementation is starting):

```bash
rm -f .5/.planning-active
```

### Step 2c: Regression Baseline

Before spawning any agents, establish a baseline by running the project's build and test commands:

```bash
# Build command from plan (or auto-detect)
{build-command}

# Test command from plan (or auto-detect)
{test-command}
```

Record the results in state.json as `baseline`:
```json
{
  "baseline": {
    "buildStatus": "success|failed",
    "testStatus": "success|failed|skipped",
    "checkedAt": "{ISO-timestamp}"
  }
}
```

**(verify write)** — confirm `baseline.checkedAt` is set.

**If the baseline build fails:** Warn the user: `"⚠ Build fails BEFORE implementation. Any post-implementation build failures may be pre-existing."` Continue — don't block on pre-existing failures.

**If baseline tests fail:** Warn the user: `"⚠ {N} tests fail BEFORE implementation. These will be excluded from regression comparison."` Record the failing test names/patterns if available, so Step 4 can distinguish pre-existing failures from new ones.

This baseline enables Step 4 to detect regressions: tests that passed before but fail after implementation.

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

**3pre. Pre-step dependency check (steps 2+)**

Before executing step N (where N > 1), verify that prior steps' outputs exist on disk:

1. For each component in `completedComponents` from prior steps: use Glob to confirm every file in `filesCreated` and `filesModified` still exists
2. If ANY file is missing:
   - Log: `"⚠ Pre-step check: {file} from step {M} component {name} not found on disk"`
   - Move the component back from `completedComponents` to `pendingComponents`
   - STOP execution for this step. Report to user: `"Step {N} blocked: prior step output missing. Re-run step {M} or fix manually."`
3. **Depends On check:** For each component in step N that has a `Depends On` value (not `—`), verify the named dependency component is in `completedComponents`. If a dependency is in `failedAttempts`, STOP and report: `"Step {N} component {name} blocked: dependency {dep} failed."`
4. If all files and dependencies verified, proceed to 3a

This prevents cascading failures where step N assumes step N-1's outputs exist but they don't.

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
    {component(s) from plan table: name, action, file, description, complexity}

    ## Read First
    {Pattern File value(s) from plan table — executor MUST read these before writing any code}

    ## Dependencies
    {If Depends On is not "—": "This component depends on {dep-name} ({dep-file}). Read that file first to understand the exports/types you need to use."}
    {If Depends On is "—": omit this section entirely}

    ## Codebase Context (optional)
    If you need to understand how this component relates to other modules (imports, service boundaries, data flow), check `.5/index/` for quick reference — especially modules.md and libraries.md. Only if these files exist.

    ## Verify
    {Verify command(s) from plan table — executor runs these after implementation}

    ## Implementation Notes
    {ONLY notes relevant to this step/component — filter by [Step N] or [component-name] prefix.
     Include untagged notes only if they are globally relevant (e.g., "all services use dependency injection").
     Do NOT send all notes to every agent — this wastes context.}
```

The agent file defines the implementation process, output format, and deviation rules. If the agent file is not found (local install), fall back to `.claude/agents/component-executor.md` relative to the project root.

**3d. Process results (context-lean)**

Collect results from all agents (parallel or sequential). Parse ONLY the `---RESULT---` block from each agent's response — do NOT retain the full agent output in your context. For each:
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

**(verify write)** — confirm `lastUpdated` changed.

Mark the current step's TaskCreate task as `completed`. Mark the next step's task as `in_progress`.

**3d2. Retry failed components (max 2 retries)**

For each component that returned `STATUS: failed`:

1. **Always re-spawn an agent** — NEVER fix code directly in the orchestrator context, not even for small fixes like missing imports or wrong paths. The orchestrator stays slim and delegates ALL code work.

   Re-spawn the component-executor agent with the same prompt plus an `## Error Context` block describing the previous failure.

   **Model upgrade on retry:** Bump the model one tier up from the original complexity:
   - `simple` (haiku) → retry with `sonnet`
   - `moderate` (haiku/sonnet) → retry with `sonnet`
   - `complex` (sonnet) → retry with `sonnet` (already max)

   This gives the retry agent better reasoning to solve what the first attempt couldn't.

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

**(verify write)** — confirm `verificationResults.builtAt` is set.

If build or tests fail:
- Compare against `baseline` in state.json:
  - If build failed in baseline AND still fails → report as `"Pre-existing build failure (not a regression)"`
  - If build passed in baseline BUT fails now → report as `"⚠ REGRESSION: Build broke during implementation"`
  - If tests that passed in baseline now fail → report as `"⚠ REGRESSION: {N} tests broke during implementation: {test names}"`
  - If tests that failed in baseline still fail → report as `"Pre-existing test failure (not a regression)"`
- Record in state.json
- Report to user with error details and regression classification

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

**(verify write)** — confirm `status` is `"completed"`. If this one fails, warn the user but continue — the implementation work is done.

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

