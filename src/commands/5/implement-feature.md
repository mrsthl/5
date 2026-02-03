---
name: 5:implement-feature
description: Executes an implementation plan by delegating to agents. Phase 3 of the 5-phase workflow.
allowed-tools: Task, Read, Write, Glob, Grep
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

### Step 1: Load Plan

Read `.5/{feature-name}/plan.md` (where `{feature-name}` is the argument provided).

Parse:
- YAML frontmatter for ticket and feature name
- Components table for the list of work
- Implementation notes for context
- Verification commands

If the plan doesn't exist, tell the user to run `/5:plan-implementation` first.

### Step 2: Initialize State

Create `.5/{feature-name}/state.json`:

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

**3a. Determine model for this step**

Look at the Complexity column for components in this step:
- If ALL components are `simple` → use `haiku`
- If ANY component is `complex` → use `sonnet`
- If mixed `simple`/`moderate` → use `haiku`
- If ANY component is `moderate` and involves business logic → use `sonnet`

**3b. Spawn step-executor agent**

```
Task tool call:
  subagent_type: general-purpose
  model: {haiku or sonnet based on step complexity}
  description: "Execute Step {N} for {feature-name}"
  prompt: |
    You are implementing components for a feature.

    ## Feature Context
    {feature-name}: {one-line summary from plan}

    ## Components to Create/Modify
    {components for this step from the plan table}

    ## Implementation Notes
    {implementation notes section from plan}

    ## Instructions
    1. For each component:
       - If creating a file: find a similar existing file, understand the pattern, create the new file following that pattern
       - If modifying a file: read the file, make the described change
    2. After creating/modifying each file, verify it exists
    3. Report what you created/modified

    Use Glob to find similar files. Use Read to understand patterns. Use Write/Edit to create/modify files.
```

**3c. Process results**

From the agent's response, identify:
- Components completed successfully
- Components that failed

Update state.json:
```json
{
  "currentStep": {N+1},
  "completed": [...previous, ...newlyCompleted],
  "failed": [...previous, ...newlyFailed]
}
```

**3d. Handle failures**

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

{If any failures: list them}

Next: /5:verify-implementation {feature-name}
```

## Handling Interruptions

If implementation is interrupted, the state file allows resuming:
- Read state.json
- Skip steps where all components are in `completed`
- Resume from `currentStep`

## Example Flow

```
User: /implement-feature PROJ-1234-add-emergency-schedule

[You read plan.md]
[You create state.json]

[You spawn agent for Step 1: Foundation]
  Agent creates: Schedule.ts, schedule.ts (types)
[You update state: Step 1 complete]

[You spawn agent for Step 2: Logic]
  Agent creates: ScheduleService.ts, ScheduleRepository.ts
[You update state: Step 2 complete]

[You spawn agent for Step 3: Integration]
  Agent creates: ScheduleController.ts
  Agent modifies: routes/index.ts
[You update state: Step 3 complete]

[You spawn agent for Step 4: Tests]
  Agent creates: ScheduleService.test.ts
[You update state: Step 4 complete]

[You run: npm run build]
  Build successful
[You run: npm test]
  Tests passing

[You update state: completed]
[You report to user]
```
