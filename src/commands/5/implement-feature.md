---
name: 5:implement-feature
description: Executes an implementation plan by delegating to agents. Phase 3 of the 5-phase workflow.
allowed-tools: Task, Read, Write, Glob, Grep, Bash
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

Do NOT write code directly. Spawn agents to do the work.

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

Also read `.claude/.5/config.json` and extract:
- `git.autoCommit` (boolean, default `false`)
- `git.commitMessage.pattern` (string, default `{ticket-id} {short-description}`)

### Step 2: Initialize State

Create `.5/features/{feature-name}/state.json`:

```json
{
  "ticket": "{ticket-id}",
  "feature": "{feature-name}",
  "status": "in-progress",
  "currentStep": 1,
  "completed": [],
  "failed": [],
  "startedAt": "{ISO-timestamp}"
}
```

### Step 3: Execute Steps

Group components by step number from the plan. For each step:

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
    Implement component(s) for a feature.

    ## Feature: {feature-name}
    ## Components
    {component(s) from plan table: name, action, file, description}

    ## Implementation Notes
    {relevant notes from plan}

    ## Process
    - Creating: Find similar file via Glob, read pattern, create new file following it
    - Modifying: Read file, apply described change via Edit
    - Verify each file exists after changes

    ## Output
    ---RESULT---
    STATUS: success | failed
    FILES_CREATED: [comma-separated paths]
    FILES_MODIFIED: [comma-separated paths]
    ERROR: none | {error description}
    ---END---
```

**3d. Process results**

Collect results from all agents (parallel or sequential). Parse the `---RESULT---` block from each agent's response. For each:
- If `STATUS: success` → mark components as completed, note files from `FILES_CREATED`/`FILES_MODIFIED`
- If `STATUS: failed` → mark components as failed, log the `ERROR` message
- If no `---RESULT---` block found → treat the response as success if the agent reported creating/modifying files, otherwise treat as failed

Update state.json:
```json
{
  "currentStep": {N+1},
  "completed": [...previous, ...newlyCompleted],
  "failed": [...previous, ...newlyFailed]
}
```

**3e. Auto-Commit Step (if enabled)**

Only fires if `git.autoCommit: true` AND at least one component succeeded. Stage only the step's specific files (never `git add .`), commit with configured `git.commitMessage.pattern` (body: one bullet per component). If commit fails, log warning in `state.json` `commitResults` and continue.

**3f. Handle failures**

If any component failed:
- Log the failure in state.json
- Continue to next step (don't block on failures)
- Report failures at the end

### Step 4: Run Verification

After all steps complete, run build and test:

```bash
# Build command from plan (or auto-detect)
{build-command}

# Test command from plan (or auto-detect)
{test-command}
```

If build or tests fail:
- Record in state.json
- Report to user with error details

### Step 5: Update State and Report

Update state.json:
```json
{
  "status": "completed",
  "completedAt": "{ISO-timestamp}",
  "buildStatus": "success|failed",
  "testStatus": "success|failed"
}
```

Tell the user:
```
Implementation complete!

{ticket}: {feature-name}
- {N} components created/modified
- Build: {status}
- Tests: {status}
{If git.autoCommit was true: "- Commits: {N} atomic commits created"}

{If any failures: list them}

Next steps:
1. Run `/clear` to reset context (recommended between phases)
2. Run `/5:verify-implementation {feature-name}`
```

## Handling Interruptions

If implementation is interrupted, the state file allows resuming:
- Read state.json
- For each step marked as completed, verify the output files still exist on disk using Glob
- If any completed files are missing, move those components back to pending and re-run them
- Skip steps where all components are in `completed` AND their files verified to exist
- Resume from `currentStep`

## Example Flow

```
Step 1: 2 simple components → 2 parallel haiku agents → update state
Step 2: 2 moderate components → 2 parallel agents → update state
Step 3: 1 complex component → 1 sonnet agent → update state
Step 4: Verify (build + test) → update state → report
```
