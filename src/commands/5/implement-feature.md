---
name: 5:implement-feature
description: Orchestrates feature implementation by delegating tasks to specialized agents. Takes a planned feature and executes each step through forked agents to minimize main context usage.
allowed-tools: Task, Read, Write, Glob, Grep, mcp__jetbrains__*
context: fork
user-invocable: true
---

# Implement Feature (Orchestrator - Phase 3)

## Overview

This skill is the **third phase** of the 5-phase workflow:
1. **Feature Planning** - Understand requirements, create feature spec (completed)
2. **Implementation Planning** - Map to technical components and skills (completed)
3. **Orchestrated Implementation** (this skill) - Execute with state tracking
4. **Verify Implementation** - Check completeness and correctness (next)
5. **Code Review** - Apply automated quality improvements (final)

This command is a **thin orchestrator** that:
- Reads the implementation plan (pre-built Phase 2)
- Initializes state tracking
- Delegates to haiku agents via the Task tool (forked contexts)
- Processes agent results
- Tracks progress and handles failures
- Reports completion

**Architecture:** `Commands -> Agents (haiku) -> Skills`
- This command stays in the main context (thin, minimal)
- Agents run in forked contexts with **haiku model** for token efficiency
- The plan contains self-contained prompts - agents execute without codebase exploration
- Skills are called by agents when specified in the plan

## Prerequisites

Before using this skill, ensure:
1. Feature spec exists at `.5/{TICKET-ID}-{description}/feature.md`
2. Implementation plan exists at `.5/{TICKET-ID}-{description}/plan.md`
3. Implementation plan has been reviewed and approved by developer
4. You have the feature name (e.g., "PROJ-1234-add-emergency-schedule") ready

## Orchestration Process

### Step 1: Load Implementation Plan

Read the implementation plan from `.5/{feature-name}/plan.md` where `{feature-name}` is the argument provided by the user.

The plan uses a structured format. Extract:
- From `## Meta`: feature name, ticket ID, total_steps, total_components
- From `## Steps`: each step block with its components, modes, and pre-built prompts
- From `## Verification`: build_command, test_command, expected file lists

Each step block contains complete, self-contained component prompts ready to pass directly to haiku agents.

### Step 2: Initialize State Tracking (MANDATORY)

**CRITICAL**: You MUST create the state file before starting any step execution. This file is the source of truth for implementation progress.

Create state file at `.5/{feature-name}/state.json` using Write tool:

```json
{
  "ticketId": "PROJ-1234",
  "featureName": "{feature-name}",
  "phase": "implementation",
  "status": "in-progress",
  "currentStep": 1,
  "totalSteps": "{from plan}",
  "completedComponents": [],
  "pendingComponents": [
    /* All components from plan */
  ],
  "failedAttempts": [],
  "verificationResults": {},
  "contextUsage": "0%",
  "startedAt": "{ISO timestamp}",
  "lastUpdated": "{ISO timestamp}"
}
```

**After creating the file:**
1. Use Read tool to verify the file was written correctly
2. Report to user: "State tracking initialized at `.5/{feature-name}/state.json`"
3. If file creation fails, stop execution and report error to user

### Step 3: Initialize Task List

Create TaskCreate entries for all steps defined in the implementation plan. Steps are defined dynamically in each feature's plan based on component dependencies - read them directly from `.5/{feature-name}/plan.md`.

### Step 4: Execute Steps via Agents

For each step defined in the plan, follow this pattern:

#### 4a. Extract Step Block

From the plan, extract the step block verbatim. The plan already contains the structured format that step-executor expects:
- Step number, name, mode
- Components with action, file, skill, depends_on, and complete prompt

No transformation needed - the plan format matches the step-executor input contract.

#### 4b. Spawn step-executor Agent (haiku)

Read `.claude/agents/step-executor.md` for agent instructions, then spawn via Task tool with **model: haiku**:

```
Task tool call:
  subagent_type: general-purpose
  model: haiku
  description: "Execute Step {N} for {feature-name}"
  prompt: |
    {Contents of step-executor.md}

    ---

    ## Your Task

    {Step block extracted from plan - passed verbatim}
```

The step-executor receives the pre-built prompts and executes them directly. No codebase exploration needed.

#### 4c. Process step-executor Results

Receive results from the agent. For each component:
- If success: Move from `pendingComponents` to `completedComponents` in state file
- If failed: Record in `failedAttempts`

#### 4d. Spawn step-verifier Agent

Read `.claude/agents/step-verifier.md` for agent instructions, then spawn via Task tool:

```
Task tool call:
  subagent_type: general-purpose
  description: "Verify Step {N} for {feature-name}"
  prompt: |
    {Contents of step-verifier.md}

    ---

    ## Your Task

    Step Number: {N}
    Affected Modules: {modules from plan}
    New Files: {files reported by step-executor}
    Compilation Targets: {based on step number and modules}
```

#### 4e. Process step-verifier Results

- If **passed**: Update state, mark step task complete, proceed to next step
- If **passed-with-warnings**: Update state with warnings, proceed to next step
- If **failed**: Handle failure (see Step 5)

#### 4f. Update State File (MANDATORY)

**CRITICAL**: You MUST update the state file after each step completes. This is required for:
- Progress tracking if implementation is interrupted
- Debugging failures
- Resuming work in a new session
- User visibility into progress

After each step:
1. **Read current state file** using Read tool: `.5/{feature-name}/state.json`
2. **Update fields**:
   - `currentStep`: Increment to next step number
   - `completedComponents`: Append all successfully completed components from this step
   - `verificationResults`: Add verification outcome for this step
   - `lastUpdated`: Current ISO timestamp
3. **Write back** using Write tool with the updated JSON
4. **Verify write** by reading the file again to confirm update succeeded

**Example state update after Step 1:**

Before:
```json
{
  "currentStep": 1,
  "completedComponents": [],
  "verificationResults": {}
}
```

After:
```json
{
  "currentStep": 2,
  "completedComponents": [
    {
      "type": "Component",
      "name": "Product",
      "skill": "{project-specific-skill}",
      "step": 1,
      "timestamp": "2026-01-28T10:30:00Z",
      "filePath": "src/models/Product.js"
    }
  ],
  "verificationResults": {
    "step1": "passed"
  },
  "lastUpdated": "2026-01-28T10:30:00Z"
}
```

**If you skip this step, the implementation will not be resumable and progress will be lost.**

### Step 5: Handle Failures

If a step-executor or step-verifier reports failure:

1. **Record failure in state file** (MANDATORY):
   - Read current state file
   - Append to `failedAttempts` array:
     ```json
     {
       "component": "ComponentName",
       "skill": "skill-name",
       "step": 1,
       "error": "Error description",
       "attempt": 1,
       "timestamp": "{ISO timestamp}"
     }
     ```
   - Update `lastUpdated` timestamp
   - Write back to state file
   - This ensures failures are tracked even if work is interrupted

2. **Check retry limit** — count attempts for this component in `failedAttempts`. If >= 2, skip to escalation (step 6).

3. **Spawn step-fixer agent** (sonnet) — read `.claude/agents/step-fixer.md` for agent instructions, then spawn via Task tool:

   ```
   Task tool call:
     subagent_type: general-purpose
     model: sonnet
     description: "Fix Step {N} component {ComponentName} (attempt {M})"
     prompt: |
       {Contents of step-fixer.md}

       ---

       ## Your Task

       Step Number: {N}
       Component: {ComponentName}
       Attempt: {M}

       Original Prompt:
       {The component prompt from the plan that step-executor used}

       Step Verifier Output:
       {Complete output from step-verifier}

       Previous Attempts:
       {Previous fix attempts from failedAttempts in state file, if any}
   ```

4. **Process step-fixer results**:
   - If **fixed**: Proceed to re-verification (step 5)
   - If **failed**: Record in state, increment attempt count, loop back to step 2
   - If **escalate**: Skip to escalation (step 6)

5. **Re-verify** by spawning step-verifier again (same as Step 4d)

6. **Escalate to user** if:
   - 2 retry attempts exhausted
   - step-fixer reports `escalate` status
   - Fix requires design decision

### Step 6: Execute Final Integration Step (if configured)

If the plan includes a final integration step, read `.claude/agents/integration-agent.md` for agent instructions, then spawn via Task tool:

```
Task tool call:
  subagent_type: general-purpose
  description: "Integration for {feature-name}"
  prompt: |
    {Contents of integration-agent.md}

    ---

    ## Your Task

    Feature Name: {feature-name}
    Components to Wire: {from plan}
    Integration Points: {from plan}
    Affected Modules: {all affected modules}
```

Process integration-agent results:
- If success: Update state, mark final step complete
- If failed: Attempt fix or escalate

### Step 7: Monitor Context Usage

After each step, estimate context usage:
- Warn developer at 50% usage
- Stop at 80% usage and recommend continuing in new session

Update state file:
```json
{
  "contextUsage": "45%",
  "contextWarningIssued": false
}
```

### Step 8: Report Completion (MANDATORY)

**CRITICAL**: You MUST update the state file to mark completion. This is the final checkpoint.

1. **Read current state file** using Read tool
2. **Update to completed status**:
```json
{
  "status": "completed",
  "phase": "completed",
  "completedAt": "{ISO timestamp}",
  "lastUpdated": "{ISO timestamp}"
}
```
3. **Write back** using Write tool
4. **Verify** the update by reading the file again

Tell the developer:
1. "Feature implementation complete!"
2. "All {N} components created successfully"
3. "Compilation: Successful"
4. "Tests: All passing ({N} tests)"
5. **"State file: `.5/{feature-name}/state.json`"** (this is critical for resume capability)
6. "Next step: Run `/verify-implementation` to validate completeness"

**Note:** The verification step will automatically prompt the developer to commit changes, which is recommended before running CodeRabbit review.

## State File Schema

```typescript
{
  ticketId: string,
  featureName: string,
  phase: "implementation" | "completed" | "failed",
  status: "in-progress" | "completed" | "failed",
  currentStep: number,
  totalSteps: number,
  completedComponents: Array<{
    type: string,
    name: string,
    skill: string,
    step: number,
    timestamp: string,
    filePath: string
  }>,
  pendingComponents: Array<{
    type: string,
    name: string,
    skill: string,
    step: number
  }>,
  failedAttempts: Array<{
    component: string,
    skill: string,
    step: number,
    error: string,
    timestamp: string
  }>,
  verificationResults: Record<string, string>,
  contextUsage: string,
  contextWarningIssued?: boolean,
  startedAt: string,
  lastUpdated: string,
  completedAt?: string
}
```

## Step Execution Modes

Steps are defined in the implementation plan with pre-built component prompts. Each step specifies:
- `mode: parallel | sequential` - how components within the step execute
- Components with self-contained prompts ready for haiku execution

Step-executor agents run with **haiku model** for token efficiency. The plan contains all context they need - no codebase exploration.

After each step: step-verifier agent runs.

## Example Orchestration Flow

```
User: /implement-feature PROJ-1234-add-emergency-schedule

[Main] Load plan, init state, create tasks

[FORK] step-executor: Step 1 (Foundation) - parallel
  -> Returns: Product data structure created
[FORK] step-verifier: Step 1
  -> Returns: passed

[Main] Update state: Step 1 complete

[FORK] step-executor: Step 2 (Logic) - parallel
  -> Returns: Validation logic, business rules created
[FORK] step-verifier: Step 2
  -> Returns: passed-with-warnings (1 unused import)

[Main] Update state: Step 2 complete

[FORK] step-executor: Step 3 (Integration) - sequential
  -> Returns: API endpoint, tests created
[FORK] step-verifier: Step 3
  -> Returns: failed (missing import in endpoint)

[FORK] step-fixer: Step 3 (attempt 1)
  -> Returns: fixed (added missing import)
[FORK] step-verifier: Step 3 (retry)
  -> Returns: passed

[Main] Update state: Step 3 complete

[Main] Update state: completed
[Main] Report: "Feature implementation complete! All 5 components created."
```

## Instructions Summary

1. **Load implementation plan** from `.5/{feature-name}/plan.md`
2. **Initialize state file** (MANDATORY) in `.5/{feature-name}/state.json` - verify creation
3. **Create tasks** for all steps defined in the plan
4. **For each step:**
   - Spawn step-executor
   - Process results
   - Spawn step-verifier
   - Process results
   - **Update state file** (MANDATORY - Step 4f) - verify update
5. **For final integration step (if configured):** Spawn integration-agent, process results, **update state file** (MANDATORY)
6. **Handle failures** - record in state file (MANDATORY), spawn step-fixer to diagnose and fix, re-verify after fix, escalate if stuck
7. **Monitor context** - warn at 50%, stop at 80%
8. **Update state file to completed** (MANDATORY - Step 8) - verify final update
9. **Report completion** with summary including state file location

**CRITICAL**: State file updates at Steps 2, 4f (after each step), 5 (failures), and 8 (completion) are MANDATORY. These enable resumability if implementation is interrupted.

## Key Principles

1. **Thin orchestrator** - Main context only reads plans, spawns agents, processes results, updates state
2. **Haiku execution** - Step-executor agents use haiku model with pre-built prompts from the plan
3. **No exploration** - Agents execute self-contained prompts; all codebase analysis was done in Phase 2
4. **State tracking** - Persistent, resumable, debuggable
5. **Verify early, verify often** - step-verifier after each step-executor
6. **Graceful degradation** - Retry, fix, escalate
7. **Context awareness** - Monitor and warn

## Resuming Interrupted Implementations

If an implementation is interrupted (context limit, error, timeout):

1. **Check state file** at `.5/{feature-name}/state.json`
2. **Read current progress**:
   - `currentStep`: Which step to resume at
   - `completedComponents`: What's already done
   - `failedAttempts`: What needs attention
3. **Resume execution** starting from `currentStep`
4. **Continue normal flow** with step-executor → step-verifier → state update cycle

**Example resume scenario:**
```
User: "Continue implementation of PROJ-1234-add-emergency-schedule"

[You read state file]
{
  "currentStep": 2,
  "completedComponents": [/* Step 1 components */],
  "failedAttempts": []
}

[You resume at Step 2]
"Resuming implementation from Step 2 (Logic)..."
[Execute Step 2 → remaining steps]
```

## DO NOT

- DO NOT execute skills directly from this command (agents call skills)
- DO NOT do heavy file reading/writing in main context (agents do this)
- **DO NOT skip state file updates** (this breaks resumability)
- **DO NOT skip state file initialization** (Step 2 is mandatory)
- **DO NOT skip state file completion update** (Step 8 is mandatory)
- DO NOT skip verification (step-verifier) after any step
- DO NOT continue after 2 failed retry attempts without escalation
- DO NOT ignore context usage warnings
- DO NOT analyze errors in main context (delegate to step-fixer)
- DO NOT fix code in main context (delegate to step-fixer)

## Related Documentation

- [Agent: step-executor](../agents/step-executor.md)
- [Agent: step-verifier](../agents/step-verifier.md)
- [Agent: integration-agent](../agents/integration-agent.md)
- [Agent: step-fixer](../agents/step-fixer.md)
- [/plan-feature command](plan-feature.md)
- [/plan-implementation command](plan-implementation.md)
- [/verify-implementation command](verify-implementation.md)
