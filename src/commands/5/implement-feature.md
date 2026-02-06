---
name: 5:implement-feature
description: Executes an implementation plan by delegating to agents. Phase 3 of the 5-phase workflow.
allowed-tools: Task, Read, Write, Glob, Grep, Bash
context: fork
user-invocable: true
---

# Implement Feature (Phase 3)

## Prerequisites Check

**CRITICAL: Check for configuration before proceeding**

```bash
if [ ! -f ".claude/.5/config.json" ]; then
  echo "❌ Configuration not found"
  echo ""
  echo "Please run /5:configure first to set up your project."
  echo ""
  echo "The configure command will:"
  echo "  • Detect your project type and build commands"
  echo "  • Set up ticket tracking conventions"
  echo "  • Generate documentation (CLAUDE.md)"
  echo "  • Create project-specific skills"
  exit 1
fi
```

**If config doesn't exist, STOP IMMEDIATELY. Do not proceed with the workflow.**

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

For steps with multiple independent components, spawn agents in parallel using multiple Task calls in a single message:

```
# Example: Step 1 has 3 simple components - spawn all 3 in parallel

Task tool call #1:
  subagent_type: general-purpose
  model: haiku
  description: "Create {component-1} for {feature-name}"
  prompt: |
    Create a single component for a feature.

    ## Component
    - Name: {component-name}
    - Action: create
    - File: {file-path}
    - Description: {what it does}

    ## Pattern Reference
    {relevant implementation note for this component}

    ## Instructions
    1. Find a similar existing file using Glob (e.g., *Service.ts for services)
    2. Read that file to understand the pattern
    3. Create the new file following that pattern
    4. Verify the file exists

Task tool call #2:
  subagent_type: general-purpose
  model: haiku
  description: "Create {component-2} for {feature-name}"
  prompt: |
    [same structure, different component]

Task tool call #3:
  subagent_type: general-purpose
  model: haiku
  description: "Create {component-3} for {feature-name}"
  prompt: |
    [same structure, different component]
```

For steps with a single component or complex interdependencies, use a single agent:

```
Task tool call:
  subagent_type: general-purpose
  model: {based on complexity}
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

**3d. Process results**

Collect results from all agents (parallel or sequential). For each:
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

**3e. Auto-Commit Step (if enabled)**

Only fires if `git.autoCommit: true` AND at least one component in the step succeeded.

1. Stage **only** the specific files from the plan's components table for this step (never `git add .`)
2. Commit using the configured `git.commitMessage.pattern`:
   - `{ticket-id}` → ticket ID from plan frontmatter
   - `{short-description}` → auto-generated summary of the step (imperative mood, max 50 chars for the full first line)
   - Body: one bullet per completed component

```bash
# Stage only specific files from this step's components
git add {file-1} {file-2} ...

# Commit with configured pattern + body
git commit -m "{ticket-id} {short-description}

- {concise change 1}
- {concise change 2}"
```

3. If commit fails → log warning, record in `state.json` under `commitResults` array, continue
4. If all components in the step failed → skip commit entirely

**Example commit:**
```
PROJ-1234 add schedule model and types

- Create Schedule.ts entity model
- Create schedule.ts type definitions
```

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
- Skip steps where all components are in `completed`
- Resume from `currentStep`

## Example Flow

```
User: /implement-feature PROJ-1234-add-emergency-schedule

[You read plan.md]
[You create state.json]

[Step 1: Foundation - 2 simple components → PARALLEL]
  Spawn 2 agents in single message:
  - Agent A creates: Schedule.ts (model)
  - Agent B creates: schedule.ts (types)
  Both complete → update state

[Step 2: Logic - 2 moderate components → PARALLEL]
  Spawn 2 agents in single message:
  - Agent A creates: ScheduleService.ts
  - Agent B creates: ScheduleRepository.ts
  Both complete → update state

[Step 3: Integration - mixed complexity → SEQUENTIAL or grouped]
  Option A: Single sonnet agent handles both
  Option B: Parallel if truly independent
  - Agent creates: ScheduleController.ts
  - Agent modifies: routes/index.ts
  Complete → update state

[Step 4: Tests - 1 component → SINGLE agent]
  Agent creates: ScheduleService.test.ts
  Complete → update state

[Verification]
  Run: npm run build → successful
  Run: npm test → passing

[Update state: completed]
[Report to user]
```

**Performance gain:** Steps 1 and 2 run in half the time by parallelizing components.
