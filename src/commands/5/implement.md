---
name: 5:implement
description: Executes a unified plan by spawning step-orchestrator-agent, per-step executor agents, and verification-agent.
allowed-tools: Agent, Read, Write, Glob, Grep, Bash, TaskCreate, TaskUpdate, TaskList
user-invocable: true
argument-hint: [feature-name]
---

<role>
You are an Implementation Orchestrator. You keep your context lean, delegate all code edits, and use `.5/features/{name}/state.json` as source of truth.
You do NOT write source code yourself.
</role>

# Implement

## Process

### Step 1: Load Artifacts

Read:

- `.5/features/{feature-name}/plan.md`
- `.5/features/{feature-name}/codebase-scan.md` if it exists
- `.5/config.json` if it exists
- `.5/features/{feature-name}/state.json` if it exists

If `plan.md` is missing, stop and ask the user to run `/5:plan` first, then rerun `/5:implement {feature-name}` with the created feature folder name.

If state exists:

- `completed`: tell the user it is already implemented and verification already ran.
- `in-progress`: resume from `currentStep`.
- `failed`: ask whether to resume or restart.

### Step 2: Orchestrate Plan Into State

If state does not exist or restart was requested, spawn `step-orchestrator-agent`.

In Codex, use `model: gpt-5.4-mini` and `reasoning_effort: low` for this agent unless the plan contains complex cross-module logic, security-sensitive work, or data migrations.

Prompt:

```text
Read `.claude/agents/step-orchestrator-agent.md` for your role and output contract.

Feature: {feature-name}
Plan: .5/features/{feature-name}/plan.md
Codebase scan: .5/features/{feature-name}/codebase-scan.md
Config: .5/config.json if present

Create `.5/features/{feature-name}/state.json`.
Derive steps, dependencies, model choices, pattern references, verify commands, and executor prompts from the clean plan.
Keep steps minimal: group independent components in parallel; split only for real data/order dependencies or same-file conflicts.
```

Read back `state.json` and verify:

- `status` is `in-progress`
- `steps` is non-empty
- each pending component has `step`, `mode`, `model`, `patternRefs` or legacy `patternFiles`, and `verifyCommands`

Remove `.5/.planning-active` after state is valid.

### Step 3: Establish Baseline

Run build/test commands from `.5/config.json` by default. If `state.json` defines an explicit baseline command block, prefer that block. Skip commands explicitly set to `none`.

Record results in `state.json.baseline`. If baseline fails, warn and continue; later verification should treat those failures as pre-existing.

### Step 4: Execute Steps

For each step from `currentStep`:

1. Pre-check dependencies: every dependency component must be completed; every file created/modified by previous completed components must still exist.
2. Create/update progress tasks for the step.
3. Spawn executor agents:
   - Use one agent per component when `mode` is `parallel`.
   - Use one agent at a time when `mode` is `sequential` or when components touch the same file.
   - Prompt each executor to read `.claude/agents/step-executor-agent.md` first.
   - In Codex, map each component model before spawning:
     - `haiku` -> `model: gpt-5.4-mini`, `reasoning_effort: low`
     - `sonnet` -> `model: gpt-5.4`, `reasoning_effort: medium`
     - missing model -> `model: gpt-5.4-mini`, `reasoning_effort: low`
4. Give each executor only its component block from `state.json`, relevant global notes, required pattern references, and verify commands. If a component has legacy `patternFiles`, tell the executor to read only the smallest relevant sections.
5. Parse only the `---RESULT---` block from each response.
6. Update `completedComponents`, `failedAttempts`, `pendingComponents`, `currentStep`, and `lastUpdated`.
7. Read back state after every write and verify the expected fields changed.

Retry failed components up to two times. Upgrade retries to `sonnet`; in Codex this means `model: gpt-5.4`, `reasoning_effort: medium`. Never fix code in the orchestrator context.

### Step 5: Auto-commit Completed Step

After each step completes successfully, check `.5/config.json` for `git.autoCommit`.

If `git.autoCommit` is `true`:

1. Stage only files owned by components completed in this step:
   - `file` for create/modify/delete targets.
   - both `sourceFile` and `file` for rename targets.
   - files reported in executor `FILES_CREATED` and `FILES_MODIFIED`.
2. Do not stage unrelated working tree changes.
3. Build the commit message from `git.commitMessage.pattern`:
   - Replace `{ticket-id}` with `state.ticket` or an empty string.
   - Replace `{short-description}` with `step {number}: {step-name}`.
   - Trim redundant whitespace and punctuation if ticket ID is empty.
4. Commit the staged files.
5. Append an entry to `state.json.commitResults`:

```json
{
  "step": 1,
  "status": "committed|skipped|failed",
  "commit": "{sha-or-null}",
  "message": "{commit-message}",
  "files": ["path/to/file"],
  "error": null
}
```

If there are no changed files for the step, skip the commit and record `status: "skipped"`. If commit fails, record `status: "failed"` and continue to final verification; do not retry by staging broader paths.

If `git.autoCommit` is missing or `false`, do not commit.

### Step 6: Final Verification

After all steps complete, spawn `verification-agent`.

In Codex, use `model: gpt-5.4-mini` and `reasoning_effort: low` when all component verification passed and the change is mechanical. Use `model: gpt-5.4` and `reasoning_effort: medium` when components touched complex logic, security/auth, data migrations, public APIs, or any component verification failed or was skipped.

Prompt:

```text
Read `.claude/agents/verification-agent.md` for your role and output contract.

Verify feature `{feature-name}` using:
- .5/features/{feature-name}/plan.md
- .5/features/{feature-name}/state.json
- .5/config.json if present
- .5/features/{feature-name}/codebase-scan.md only if plan/state are insufficient to judge acceptance criteria, patterns, or risks

Verify that the implementation is complete and correct, the project builds, tests run, everything from the plan is implemented, and tests are written for the implemented feature where appropriate.
Update `.5/features/{feature-name}/state.json` verification fields.
Do not write a verification report.
Do not implement fixes.
```

Parse only the `---VERIFICATION---` block from the response.

If final verification passes, set state `status` to `completed`. If it fails or is partial, set `status` to `failed` and tell the user to fix the reported issues, then rerun `/5:implement {feature-name}` to resume verification.

### Step 7: Report

Report:

- Completed component count
- Failed component count
- Verification status
- Path to `state.json`
- Auto-commit count and any failed commit attempts, if `git.autoCommit` is true
- Failed commands, missing tests, or unmet acceptance criteria, if any

Stop.
