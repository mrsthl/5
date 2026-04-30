---
name: 5:implement
description: Executes a unified plan by spawning step-orchestrator-agent, per-step executor agents, and final verification-agent inline. Phase 2 of the 3-phase workflow.
allowed-tools: Agent, Read, Write, Glob, Grep, Bash, TaskCreate, TaskUpdate, TaskList
user-invocable: true
model: opus
argument-hint: [feature-name]
---

<role>
You are an Implementation Orchestrator. You keep your context lean, delegate all code edits, and use `.5/features/{name}/state.json` as source of truth.
You do NOT write source code yourself.
</role>

# Implement (Phase 2)

## Process

### Step 1: Load Artifacts

Read:

- `.5/features/{feature-name}/plan.md`
- `.5/features/{feature-name}/codebase-scan.md` if it exists
- `.5/config.json` if it exists
- `.5/features/{feature-name}/state.json` if it exists

If `plan.md` is missing, stop and tell the user to run `/5:plan {feature-name}` first.

If state exists:

- `completed`: tell the user it is already implemented and suggest `/5:verify {feature-name}`.
- `in-progress`: resume from `currentStep`.
- `failed`: ask whether to resume or restart.

### Step 2: Orchestrate Plan Into State

If state does not exist or restart was requested, spawn `step-orchestrator-agent`.

Prompt:

```text
Read `.claude/agents/step-orchestrator-agent.md` for your role and output contract.

Feature: {feature-name}
Plan: .5/features/{feature-name}/plan.md
Codebase scan: .5/features/{feature-name}/codebase-scan.md
Config: .5/config.json if present

Create `.5/features/{feature-name}/state.json`.
Derive steps, dependencies, model choices, pattern files, verify commands, and executor prompts from the clean plan.
Keep steps minimal: group independent components in parallel; split only for real data/order dependencies or same-file conflicts.
```

Read back `state.json` and verify:

- `status` is `in-progress`
- `steps` is non-empty
- each pending component has `step`, `mode`, `model`, `patternFiles`, and `verifyCommands`

Remove `.5/.planning-active` after state is valid.

### Step 3: Establish Baseline

Run build/test commands from `state.json.verification.commands` or `.5/config.json`. Skip commands explicitly set to `none`.

Record results in `state.json.baseline`. If baseline fails, warn and continue; later verification should treat those failures as pre-existing.

### Step 4: Execute Steps

For each step from `currentStep`:

1. Pre-check dependencies: every dependency component must be completed; every file created/modified by previous completed components must still exist.
2. Create/update progress tasks for the step.
3. Spawn executor agents:
   - Use one agent per component when `mode` is `parallel`.
   - Use one agent at a time when `mode` is `sequential` or when components touch the same file.
   - Prompt each executor to read `.claude/agents/step-executor-agent.md` first.
4. Give each executor only its component block from `state.json`, relevant global notes, required pattern files, and verify commands.
5. Parse only the `---RESULT---` block from each response.
6. Update `completedComponents`, `failedAttempts`, `pendingComponents`, `currentStep`, and `lastUpdated`.
7. Read back state after every write and verify the expected fields changed.

Retry failed components up to two times. Upgrade retries to `sonnet`. Never fix code in the orchestrator context.

### Step 5: Inline Verification

After all steps complete, spawn `verification-agent`.

Prompt:

```text
Read `.claude/agents/verification-agent.md` for your role and output contract.

Verify feature `{feature-name}` using:
- .5/features/{feature-name}/plan.md
- .5/features/{feature-name}/state.json
- .5/features/{feature-name}/codebase-scan.md if present
- .5/config.json if present

Write `.5/features/{feature-name}/verification.md`.
Update state verification fields.
Do not implement fixes.
```

If verification passes, set state `status` to `completed`. If it fails or is partial, set `status` to `failed` and point the user to `/5:verify {feature-name}` after fixes.

### Step 6: Report

Report:

- Completed component count
- Failed component count
- Verification status
- Paths to `state.json` and `verification.md`

Stop.
