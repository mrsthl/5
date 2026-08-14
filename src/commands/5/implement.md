---
name: 5:implement
description: Executes a unified plan. Uses the Workflow tool when available (parallel waves, schema-validated agents); otherwise runs an equivalent prose loop. Codex always uses the prose loop.
allowed-tools: Agent, Read, Write, Glob, Grep, Bash, Workflow, TaskCreate, TaskUpdate, TaskList
user-invocable: true
argument-hint: [feature-name]
---

<role>
You are an Implementation Orchestrator. Keep your context lean, delegate all code edits, and use `.5/features/{name}/state.json` for cross-session resume. You do NOT write source code yourself.
</role>

# Implement

## Step 1: Load Artifacts

Read `plan.md`, `codebase-scan.md` if it exists, and `.5/config.json` if it exists. If `plan.md` is missing, stop and ask the user to run `/5:plan` first, then rerun `/5:implement {feature-name}`.

Then read `.5/features/{feature-name}/state.json` if it exists:

- `completed`: tell the user it is already implemented and verified; stop.
- `in-progress`: resume — skip every component listed in `completedComponents`.
- `failed`: ask whether to resume or restart. Restart clears `completedComponents`.

A plan is **compact** when `plan.md` frontmatter has `planFormat: compact` (1-2 components, no data migration, no security/auth change, no public API change). `/5:plan` implements compact plans inline as soon as the user approves them, so a compact plan usually already has a `completed` or `failed` state here — the common reasons to reach this command are resuming a failed inline run or re-running after the plan changed. Treat that state exactly as above; do not re-run completed components.

The execution graph — steps, component wiring, model choices, pattern references, verify commands — is derived fresh on every run and lives only in this run. `state.json` persists only what resume needs:

```json
{
  "feature": "{feature-name}",
  "status": "in-progress|completed|failed",
  "completedComponents": ["component-name"],
  "verification": {"status": "passed|partial|failed", "summary": "one line"},
  "startedAt": "{ISO-timestamp}",
  "lastUpdated": "{ISO-timestamp}"
}
```

Resume matches on component name alone, so component names must always be copied verbatim from the plan's Component Checklist. Write `state.json` with `status: "in-progress"` now if it does not exist.

Create one task per planned component with `TaskCreate` so the user can see progress, and mark already-completed components as completed.

## Step 2: Establish Baseline

Run build/test commands from `.5/config.json`. Skip commands set to `none`. Keep the results in context for this run — they are what lets verification tell pre-existing failures apart from new ones. Do not persist them. If baseline fails, warn and continue.

## Step 3: Run

**If the `Workflow` tool is available, use the Workflow engine (preferred).** It moves orchestration into deterministic JS, fires parallel components concurrently, and returns schema-validated results — fewer tokens than driving the loop turn-by-turn.

1. Build `args` for the workflow:

```json
{
  "feature": "{feature-name}",
  "paths": {"plan": ".5/features/{feature-name}/plan.md", "scan": ".5/features/{feature-name}/codebase-scan.md", "config": ".5/config.json"},
  "isCompact": true,
  "components": [{"name": "...", "action": "create|modify|delete|rename", "file": "...", "sourceFile": null, "description": "...", "dependsOn": []}],
  "baseline": [{"command": "...", "status": "passed|failed|skipped", "summary": "one line"}],
  "completedComponents": []
}
```

- For a **compact** plan, set `isCompact: true` and parse `components` from the plan's Component Checklist (the workflow builds a trivial single step with no orchestrator agent).
- For a **full** plan, set `isCompact: false` and omit `components` — the workflow's orchestrate phase derives steps itself.
- `baseline` is the array from Step 2 (or `[]`); the workflow's verifier treats those failures as pre-existing and reuses passing results instead of rerunning them.
- `completedComponents` is `[]` for a fresh run, or the array from `state.json` to resume. The workflow re-derives the graph and skips those components by name.
- The workflow reads the config **file** at `paths.config` itself; do not pass build/test/commit settings inline — baseline (Step 2) and auto-commit (Step 5) are run by this command, not the workflow.

2. Call `Workflow({name: "5-implement", args})`.
3. When it returns, **merge** (never replace) its `completedComponents` into the existing array and write `state.json` (Step 4). A resumed run reports only the components it ran this invocation. Mark the matching tasks completed with `TaskUpdate`. The workflow does not touch the filesystem itself.
4. Auto-commit per step (Step 5), then report (Step 6).

> The Workflow path persists only after the workflow returns — if a run is interrupted mid-way, this session's progress is not saved and those components run again on the next `/5:implement`. The executor's smallest-coherent-change contract makes a re-touch safe but not free.

**Otherwise, run the prose loop (fallback).** It produces the same outcome:

### 3a. Derive the execution graph

- **Compact plan:** build the graph inline from the Component Checklist — one step, `mode: "parallel"` unless components share a file or have a dependency (then `sequential`), `model: "haiku"`. **Do not spawn `step-orchestrator-agent`.**
- **Full plan:** spawn `step-orchestrator-agent` with `plan.md`, `codebase-scan.md`, and config; it returns steps, dependencies, model choices, `patternRefs` (line ranges/symbols), and verify commands.

Check the returned graph: non-empty steps, every component name copied verbatim from the plan's Component Checklist, and each component carrying `step`, `mode`, `model`, `patternRefs`, and `verifyCommands`.

### 3b. Execute steps in waves

For each step, skipping components already in `completedComponents`:

1. Pre-check: every dependency component is completed and its files still exist.
2. Mark the step's tasks in progress with `TaskUpdate`.
3. Spawn executors:
   - **Parallel step: emit all of the step's executor Agent calls in a single message so they run concurrently.**
   - Sequential step (same-file or dependency): one executor at a time.
   - Give each executor only its component block, required `patternRefs`, verify commands, and the inline contract below — do not make it read `step-executor-agent.md`.

```text
Implement exactly the assigned component. Read only listed patternRefs ranges/symbols and the target file. Make the smallest coherent change, run assigned verify commands, and stop (STATUS: failed) for missing dependencies, unplanned auth/schema/API changes, or unclear product decisions. If verify fails only from pre-existing unrelated issues, report it under DEVIATIONS with the exact evidence and keep STATUS: success — your change is complete. Do not make more than three attempts on the same failing issue.

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
5. **Once per wave** (not per component), append the succeeded component names to `state.json.completedComponents`, refresh `lastUpdated`, and mark the matching tasks completed. Trust the executor's report — do not re-read files you did not change to confirm them.

Retry failed components up to twice, escalating to `sonnet`. Never fix code in the orchestrator context.

### 3c. Verify

- **Fast path:** when every component reported `success` with `verify` `passed` or `skipped`, and no component was planned as **or escalated to** `sonnet` (i.e. a mechanical change), verify inline — run the configured build/test once (reuse fresh baseline/component results) and set the verification result directly, skipping `verification-agent`.
- **Otherwise:** spawn `verification-agent` with `plan.md`, the component results, the baseline from Step 2, and config (and `codebase-scan.md` only if needed). It returns:

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

## Step 4: Persist Result

Write `state.json` with the merged `completedComponents`, a one-line `verification` summary condensed from the block above, and `lastUpdated`. Set `status` to `completed` when verification passed; otherwise `failed`, and tell the user to fix the reported issues and rerun `/5:implement {feature-name}` to resume.

## Step 5: Auto-commit

If `.5/config.json` `git.autoCommit` is `true`, commit once per completed step:

1. Stage only files owned by that step's components: `file` for create/modify/delete, both `sourceFile` and `file` for rename, plus the executor's reported `FILES_CREATED`/`FILES_MODIFIED`. Do not stage unrelated changes.
2. Build the message from `git.commitMessage.pattern`, replacing `{ticket-id}` with the ticket from the plan frontmatter (or empty) and `{short-description}` with `step {number}: {step-name}`; trim redundant whitespace/punctuation when the ticket is empty.
3. Commit.

No changed files → skip. Commit error → report it and continue; do not retry with broader paths. If `git.autoCommit` is missing/`false`, do not commit.

## Step 6: Report

Report: completed/failed component counts, verification status, path to `state.json`, auto-commit count and any failures, and any failed commands, missing tests, or unmet acceptance criteria. Then stop.
