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

## ⚠️ CRITICAL SCOPE CONSTRAINT

**THIS COMMAND ORCHESTRATES IMPLEMENTATION. IT DELEGATES TO AGENTS.**

Your job in this phase:
✅ Load implementation plan
✅ Initialize state tracking
✅ Spawn agents (step-executor, step-verifier, step-fixer)
✅ Process agent results
✅ Update state file after each step
✅ Report completion
✅ Tell user to run /5:verify-implementation

Your job is NOT:
❌ Execute skills directly (agents call skills)
❌ Do heavy file reading/writing (agents do this)
❌ Write code files directly (agents do this)
❌ Skip state file updates
❌ Analyze or fix errors yourself (delegate to step-fixer agent)
❌ Continue past 80% context usage

**You are a THIN ORCHESTRATOR. Delegate all heavy work to agents in forked contexts.**

## ❌ Boundaries: What This Command Does NOT Do

**CRITICAL:** This command has a LIMITED scope. Do NOT:

- ❌ **Execute skills directly** - Agents call skills, not this command
- ❌ **Write code directly** - Agents handle all file operations
- ❌ **Analyze errors yourself** - Delegate to step-fixer agent (sonnet)
- ❌ **Skip state file updates** - State updates are MANDATORY after each step
- ❌ **Skip verification** - step-verifier must run after each step-executor
- ❌ **Continue after 2 failed retries** - Escalate to user
- ❌ **Ignore context warnings** - Stop at 80% usage

**If you find yourself writing code or fixing errors directly, STOP. You should be spawning agents instead.**

## Prerequisites

Before using this skill, ensure:
1. Feature spec exists at `.5/{TICKET-ID}-{description}/feature.md`
2. Implementation plan exists at `.5/{TICKET-ID}-{description}/plan/` directory with:
   - plan/meta.md (metadata)
   - plan/step-N.md files (one per step)
   - plan/verification.md (verification config)
3. Implementation plan has been reviewed and approved by developer
4. You have the feature name (e.g., "PROJ-1234-add-emergency-schedule") ready

## Orchestration Process

### Step 1: Load Implementation Plan

Read the implementation plan metadata from `.5/{feature-name}/plan/meta.md` where `{feature-name}` is the argument provided by the user.

**Error Handling:** If the plan directory or meta.md file is missing:
- Report error immediately: "Error: Implementation plan not found at `.5/{feature-name}/plan/`. Please run /5:plan-implementation first."
- Do not proceed to Step 2

Parse the YAML frontmatter from meta.md to extract:
- `feature`: feature name
- `ticket`: ticket ID
- `total_steps`: number of steps in the plan
- `total_components`: total component count
- `new_files`: count of new files
- `modified_files`: count of modified files

Store this metadata for state file initialization.

**Note:** Individual step files (plan/step-N.md) will be loaded on-demand during Step 4 when executing each step.

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

For each step (1 to total_steps from meta.md), follow this pattern:

#### 4a. Load and Parse Step File

For the current step number N:

1. **Read step file:** `.5/{feature-name}/plan/step-{N}.md`

   **Error Handling:** If the step file is missing:
   - Report error: "Error: Step {N} plan file not found at `.5/{feature-name}/plan/step-{N}.md`. Plan may be incomplete."
   - Stop execution and escalate to user

2. **Parse YAML frontmatter** (between `---` markers):
   - Extract: `step`, `name`, `mode`, `components` (count)

3. **Extract YAML components block:**
   - Find the `## Components` section
   - Extract the YAML block (between ` ```yaml` and ` ``` `)
   - Parse the YAML to get the `components` array

   **Error Handling:** If YAML parsing fails:
   - Report error: "Error: Malformed step plan file at `.5/{feature-name}/plan/step-{N}.md`. Check YAML syntax in components block."
   - Stop execution and escalate to user

4. **Build step block object:**
   ```yaml
   step: {from frontmatter}
   name: "{from frontmatter}"
   mode: {from frontmatter}
   components: {from YAML block}
   ```

This step block is now ready to pass to the step-executor agent (same format as before).

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

   To retrieve the original component prompt:
   - Read `.5/{feature-name}/plan/step-{N}.md`
   - Parse the YAML components block
   - Find the component by ID
   - Extract the `prompt` field

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
       {The component prompt extracted from plan/step-{N}.md}

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

```
✅ Feature implementation complete!

Summary:
- All {N} components created successfully
- Compilation: Successful
- Tests: All passing ({N} tests)
- State file: `.5/{feature-name}/state.json`

Next steps:
1. Run `/clear` to reset context
2. Run `/5:verify-implementation {feature-name}` to validate completeness
```

**Note:** The verification step will automatically prompt the developer to commit changes, which is recommended before running CodeRabbit review.

**🛑 YOUR JOB IS COMPLETE. DO NOT START VERIFICATION. Wait for user to proceed to Phase 4.**

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

Follow these steps **IN ORDER**:

1. **Load implementation plan metadata** from `.5/{feature-name}/plan/meta.md` - parse YAML frontmatter for total_steps, total_components
2. **Initialize state file** (MANDATORY) in `.5/{feature-name}/state.json` - verify creation
3. **Create tasks** for all steps defined in the plan
4. **For each step (1 to total_steps):**
   - Load and parse step file: `.5/{feature-name}/plan/step-{N}.md` (parse YAML frontmatter + components block)
   - Build step block object from parsed data
   - Spawn step-executor with step block (haiku model)
   - Process results
   - Spawn step-verifier
   - Process results
   - **Update state file** (MANDATORY - Step 4f) - verify update
5. **For final integration step (if configured):** Spawn integration-agent, process results, **update state file** (MANDATORY)
6. **Handle failures** - record in state file (MANDATORY), extract original prompt from plan/step-{N}.md, spawn step-fixer (sonnet) to diagnose and fix, re-verify after fix, escalate if stuck
7. **Monitor context** - warn at 50%, stop at 80%
8. **Update state file to completed** (MANDATORY - Step 8) - verify final update
9. **Report completion** - Tell user: "Run `/clear` followed by `/5:verify-implementation {feature-name}`"

**CRITICAL**: State file updates at Steps 2, 4f (after each step), 5 (failures), and 8 (completion) are MANDATORY. These enable resumability if implementation is interrupted.

**🛑 AFTER REPORTING COMPLETION, YOUR JOB IS DONE. DO NOT START VERIFICATION.**

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


## Related Documentation

- [Agent: step-executor](../agents/step-executor.md)
- [Agent: step-verifier](../agents/step-verifier.md)
- [Agent: integration-agent](../agents/integration-agent.md)
- [Agent: step-fixer](../agents/step-fixer.md)
- [/plan-feature command](plan-feature.md)
- [/plan-implementation command](plan-implementation.md)
- [/verify-implementation command](verify-implementation.md)
