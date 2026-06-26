---
name: 5:implement
description: Executes a unified plan. Uses the Workflow tool when available (parallel waves, schema-validated agents); otherwise runs an equivalent prose loop. Codex always uses the prose loop.
allowed-tools: Agent, Read, Write, Glob, Grep, Bash, Workflow, TaskCreate, TaskUpdate, TaskList
user-invocable: true
argument-hint: [feature-name]
---

<role>
You are an Implementation Orchestrator. Keep your context lean, delegate all code edits, and use `.5/features/{name}/state.json` as the durable source of truth for cross-session resume. You do NOT write source code yourself.
</role>

# Implement

## Step 1: Load Artifacts & Decide Path

Read `.5/features/{feature-name}/state.json` first if it exists. Then read only what the current path needs:

- Resume existing state: `.5/config.json` if needed for baseline, verification, or auto-commit.
- New state or restart: `plan.md`, `codebase-scan.md` if it exists, and `.5/config.json` if it exists.

If `plan.md` is missing, stop and ask the user to run `/5:plan` first, then rerun `/5:implement {feature-name}`.

State machine, if state exists:

- `completed`: tell the user it is already implemented and verified; stop.
- `in-progress`: resume from `currentStep` (only run components not in `completedComponents`).
- `failed`: ask whether to resume or restart.

A plan is **compact** when `plan.md` frontmatter has `planFormat: compact` (1-2 components, no data migration, no security/auth change, no public API change).

Remove `.5/.planning-active` once you have a valid plan to execute.

## Step 2: Establish Baseline

Run build/test commands from `.5/config.json` (or an explicit baseline block in `state.json`). Skip commands set to `none`. If `state.json.baseline` already records the same commands for this run/resume, reuse it.

Record compact results in `state.json.baseline` (command, status, one-line summary). Append full history to `state-events.jsonl`. If baseline fails, warn and continue; verification treats those as pre-existing.

```json
{"type":"command","timestamp":"{ISO}","step":0,"component":null,"status":"passed|failed|skipped","summary":"one line","details":{"command":"{command}","phase":"baseline"}}
```

## Step 3: Run

**If the `Workflow` tool is available, use the Workflow engine (preferred).** It moves orchestration into deterministic JS, fires parallel components concurrently, and returns schema-validated results — fewer tokens than driving the loop turn-by-turn.

1. Build `args` for the workflow:

```json
{
  "feature": "{feature-name}",
  "paths": {"plan": ".5/features/{name}/plan.md", "scan": ".5/features/{name}/codebase-scan.md", "config": ".5/config.json"},
  "isCompact": true,
  "components": [{"name": "...", "action": "create|modify|delete|rename", "file": "...", "sourceFile": null, "description": "...", "dependsOn": []}],
  "config": {"build": "...", "test": "...", "lint": "...", "e2e": "...", "autoCommit": false, "commitPattern": "...", "ticket": "..."},
  "resume": {"currentStep": 2, "completedComponents": ["..."]}
}
```

- For a **compact** plan, set `isCompact: true` and parse `components` from the plan's Component Checklist (the workflow builds a trivial single step with no orchestrator agent).
- For a **full** plan, set `isCompact: false` and omit `components` — the workflow's orchestrate phase derives steps itself.
- `resume` mirrors current `state.json` progress, or `null` for a fresh run.

2. Call `Workflow({name: "5-implement", args})`.
3. When it returns, **persist its result** (Step 4): write the returned `steps`, `components`, per-component results, and `verification` into `state.json`; append events to `state-events.jsonl`. The workflow does not touch the filesystem itself.
4. Auto-commit per step (Step 5), then report (Step 6).

> Cross-session resume stays durable via `state.json`. Workflow's own in-session resume is a bonus; you are the one who persists state after it returns.

**Otherwise, run the prose loop (fallback).** It produces the same `state.json` outcome:

### 3a. Orchestrate into state

- **Compact plan:** build `state.json` inline from the Component Checklist — one step, `mode: "parallel"` unless components share a file or have a dependency (then `sequential`), `model: "haiku"`. **Do not spawn `step-orchestrator-agent`.**
- **Full plan:** spawn `step-orchestrator-agent` with `plan.md`, `codebase-scan.md`, and config; it writes `state.json` with steps, dependencies, model choices, `patternRefs` (line ranges/symbols), and verify commands.

Verify `state.json`: `status: in-progress`, non-empty `steps`, each pending component has `step`, `mode`, `model`, `patternRefs` (or legacy `patternFiles`), and `verifyCommands`.

### 3b. Execute steps in waves

For each step from `currentStep`, skipping components already in `completedComponents`:

1. Pre-check: every dependency component is completed and its files still exist.
2. Update progress tasks for the step.
3. Spawn executors:
   - **Parallel step: emit all of the step's executor Agent calls in a single message so they run concurrently.**
   - Sequential step (same-file or dependency): one executor at a time.
   - Give each executor only its component block, required `patternRefs`, verify commands, and the inline contract below — do not make it read `step-executor-agent.md`. (For legacy `patternFiles`, tell it to read only the smallest relevant sections.)

```text
Implement exactly the assigned component. Read only listed patternRefs ranges/symbols and the target file. Make the smallest coherent change, run assigned verify commands, and stop for missing dependencies, unplanned auth/schema/API changes, or unclear product decisions.

End with:
---RESULT---
STATUS: success | failed
FILES_CREATED: [comma-separated paths]
FILES_MODIFIED: [comma-separated paths]
VERIFY: passed | failed | skipped
DEVIATIONS: none | {brief list}
ERROR: none | {error description}
---END---
```

4. Parse only the `---RESULT---` block from each executor.
5. **Once per wave** (not per component), update `completedComponents`, `recentFailures`, `pendingComponents`, `currentStep`, `latestCommandResults`, `lastUpdated`, and append `component_result` / `retry` / `command` events to `state-events.jsonl`. Trust the executor's report — do not re-read files you did not change to confirm them.

```json
{"type":"component_result","timestamp":"{ISO}","step":1,"component":"{name}","status":"success|failed","summary":"one line","details":{"filesCreated":[],"filesModified":[],"verify":"passed|failed|skipped"}}
{"type":"retry","timestamp":"{ISO}","step":1,"component":"{name}","status":"failed","summary":"retry reason","details":{"attempt":2,"model":"sonnet"}}
```

Retry failed components up to twice, escalating to `sonnet`. Never fix code in the orchestrator context.

### 3c. Verify

- **Fast path:** when every component reported `success` with `verify: passed` and no component used `model: sonnet` (i.e. mechanical change), verify inline — run the configured build/test once (reuse fresh baseline/component results), set the verification fields directly, and skip `verification-agent`.
- **Otherwise:** spawn `verification-agent` with `plan.md`, `state.json`, and config (and `codebase-scan.md` only if needed). It reuses fresh `baseline`/component/`latestCommandResults` instead of rerunning identical passing commands, then updates `state.json` verification fields and returns:

```text
---VERIFICATION---
STATUS: passed | partial | failed
COMPLETENESS: passed | partial | failed
INFRASTRUCTURE: passed | failed
ACCEPTANCE_CRITERIA: satisfied/total
QUALITY: passed | partial | failed
ERRORS: none | {summary}
---END_VERIFICATION---
```

## Step 4: Persist Verification Result

Set `state.json` `status` to `completed` when verification passed; otherwise `failed`, and tell the user to fix the reported issues and rerun `/5:implement {feature-name}` to resume.

## Step 5: Auto-commit

If `.5/config.json` `git.autoCommit` is `true`, commit once per completed step:

1. Stage only files owned by that step's components: `file` for create/modify/delete, both `sourceFile` and `file` for rename, plus the executor's reported `FILES_CREATED`/`FILES_MODIFIED`. Do not stage unrelated changes.
2. Build the message from `git.commitMessage.pattern`, replacing `{ticket-id}` with `state.ticket` (or empty) and `{short-description}` with `step {number}: {step-name}`; trim redundant whitespace/punctuation when the ticket is empty.
3. Commit, and record a compact entry in `state.json.latestCommitResults` plus a detailed `commit` event:

```json
{"type":"commit","timestamp":"{ISO}","step":1,"component":null,"status":"committed|skipped|failed","summary":"{message-or-reason}","details":{"commit":"{sha-or-null}","files":["path"],"error":null}}
```

No changed files → `status: "skipped"`. Commit error → `status: "failed"`, continue; do not retry with broader paths. If `git.autoCommit` is missing/`false`, do not commit.

## Step 6: Report

Report: completed/failed component counts, verification status, path to `state.json`, auto-commit count and any failures, and any failed commands, missing tests, or unmet acceptance criteria. Then stop.
