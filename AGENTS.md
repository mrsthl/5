# Repository Guide

This repository publishes the `foifi` npm package for Claude Code and Codex.

## Development

```bash
npm test
bash test/verify-install-js.sh
bash test/test-check-updates-hook.sh
bash test/test-update-system.sh
```

Do not manually bump `package.json` version for workflow refactors unless the release process explicitly asks for it.

## Layout

```text
bin/
  install.js          installer, updater, Codex conversion, upgrade migrations
  sync-agents.js      Claude/Codex user-content sync
src/
  commands/5/         workflow commands (Claude Code)
  agents/             reusable agent instructions
  workflows/          Workflow-tool scripts (Claude Code only; e.g. 5-implement.js)
  hooks/              Claude Code hooks (statusline, check-updates, check-reconfig, plan-guard, config-guard)
  skills/             setup and project-skill generators
  templates/workflow/ workflow artifact templates
test/                 shell verification scripts
```

## Runtime Parity

Every feature must work for both Claude Code and Codex. The two runtimes share `.5/` state but have separate install targets (`.claude/` vs `.codex/`).

| Concern | Claude Code | Codex |
|---|---|---|
| Commands | `/5:*` slash commands | `$5-*` skills (auto-converted by installer) |
| Planning engine | Native plan mode via `EnterPlanMode`, which also enforces read-only planning at the harness level | prose fallback in `plan.md` + the "Guard Rules" block in `getCodexSkillAdapterHeader()` (no plan mode) |
| Implement orchestration | `.claude/workflows/5-implement.js` (Workflow tool) when available, else the prose loop in `implement.md` | prose loop only (no Workflow tool) |
| Review engine | Built-in `code-review` skill via the `Skill` tool when available, else the prose fallback in `review.md` | prose fallback only (no `Skill` tool) |
| Model mapping (haiku/sonnet) | real model names inline | centralized in `getCodexSkillAdapterHeader()` "Model Mapping" |
| Hooks | `src/hooks/*.js` via `settings.json` (`statusline`, `check-updates`, `check-reconfig`, `config-guard`) | Embedded as instructions in skill adapter preamble |
| Statusline | `src/hooks/statusline.js` | Not available |
| Update notice | Statusline reads `.5/.update-cache.json` | Skill adapter preamble reads `.5/.update-cache.json` at startup |
| Migration notice | Statusline reads `.5/.migration-v*` | Skill adapter preamble reads `.5/.migration-v*` at startup |
| Generated skills | `.claude/skills/{pattern}/SKILL.md` | `.codex/skills/{pattern}/SKILL.md` (paths substituted by installer) |
| Upgrade migrations | `performUpdate()` in `install.js` | `performCodexUpdate()` in `install.js` — must mirror all migrations |

**Rule:** When adding a hook, statusline indicator, or upgrade migration for Claude Code, add an equivalent for Codex. The most common Codex equivalent is an instruction in `getCodexSkillAdapterHeader()`.

## Workflow Model

Primary commands:

1. `/5:plan` / `$5-plan` — resolves the ticket and feature name, hands exploration, Q&A, and the approval gate to native plan mode, then writes `.5/features/{name}/plan.md` and `codebase-scan.md`. Re-running it on an existing feature refines that plan. Codex uses the prose fallback in `plan.md`.
   On approval it branches: a **compact** plan is implemented inline in the same session (warm context beats orchestration for 1-2 files) and gets its `state.json` written there; a **full** plan is handed to `/5:implement`, where parallel waves and model routing pay for a fresh run.
2. `/5:implement {name}` / `$5-implement {name}` — derives the execution graph, executes components in parallel waves, verifies inline. On Claude Code it runs `.claude/workflows/5-implement.js` via the Workflow tool when available (the orchestrator/executor/verifier prompts in that script are the schema-validated form of `src/agents/*-agent.md` — keep them in sync), and falls back to the prose loop in `implement.md` otherwise. Codex always uses the prose loop.
3. `/5:review [low|medium|high|max]` / `$5-review` — reviews code and writes review findings. On Claude Code it delegates to the built-in `code-review` skill (default effort `high`) and maps its reported findings onto `REVIEW-FINDINGS.md`; Codex uses the condensed prose fallback in `review.md`.

Helpers:

- `/5:split {name}` splits an existing `plan.md` into smaller linked plans.
- `/5:lean-check [base-branch|feature-name] [request]` checks any diff — with or without a plan — for scope drift and over-engineering, and can revert the drift.
- `/5:commit [short-description]` creates a git commit using `git.commitMessage.pattern`.
- `/5:address-review-findings {name}` applies approved review findings.
- `/5:configure` writes config and the CONFIGURE plan.
- `/5:reconfigure`, `/5:update`, `/5:eject`, and `/5:synchronize-agents` are maintenance commands.

All commands have `$5-*` Codex equivalents unless noted otherwise.

## Generated Skills

`/5:configure` generates project-specific skills and rules via `configure-skills`:

- Pattern skills: `.claude/skills/{pattern}/SKILL.md` (e.g. `dto`, `service`, `component`) — handle both create and update.
- Command skills: `.claude/skills/run-{command}/SKILL.md` (e.g. `run-build`, `run-tests`).
- Rules: `.claude/rules/*.md` scoped to file globs.

Generated skills must not include `context: fork` — this causes skills to loop by re-invoking themselves in a fresh context. The upgrade migration in `performUpdate` / `performCodexUpdate` strips `context: fork` from existing skills and renames legacy `create-*` directories to bare pattern names.

## Planning Artifact

`PLAN.md` is the single planning template. It includes:

- overview and what changes
- existing patterns to follow
- constraints, scope, acceptance criteria, decisions
- module impact
- component checklist
- technical notes and next steps

The component checklist stays intentionally lean: component, action, target path, intent. `step-orchestrator-agent` derives execution details from it.

## Execution State

The execution graph — steps, component wiring, model choices, `patternRefs`, verify commands — is derived fresh on every `/5:implement` run and never persisted. `.5/features/{name}/state.json` holds only what resume needs:

```json
{
  "feature": "{name}",
  "status": "in-progress|completed|failed",
  "completedComponents": ["component-name"],
  "verification": {"status": "passed|partial|failed", "summary": "one line"},
  "startedAt": "{ISO}",
  "lastUpdated": "{ISO}"
}
```

Resume matches components by name across runs, which is only sound because **component names are copied verbatim from the plan's Component Checklist**. That rule lives in `step-orchestrator-agent.md` and in `orchestratorPrompt()` in `5-implement.js` — keep both. In-run progress the user sees comes from `TaskCreate` / `TaskUpdate`, not from a file.

## Agents

- `step-orchestrator-agent.md` reads `plan.md` and `codebase-scan.md`, then returns the execution graph.
- `step-executor-agent.md` implements assigned components and reports a strict `---RESULT---` block.
- `verification-agent.md` verifies completeness, correctness, build/tests, acceptance criteria, and test coverage, then returns a `---VERIFICATION---` block.

None of the three writes `state.json`; `/5:implement` owns every write.

The scope contract is shared across runtimes and workflows: executors report deliberate omissions under `SKIPPED`, the verifier reports `SCOPE: passed | drift`, and outside the workflow the same rules live in the generated project `AGENTS.md` ("Simplicity First", "Surgical Changes") plus `/5:lean-check`. Keep the simplicity ladder in `src/templates/AGENTS.md`, `step-executor-agent.md`, `executorPrompt()` in `5-implement.js`, and the executor contract in `implement.md` in sync.

Usage examples:

- `step-orchestrator-agent.md`: input `plan.md` + `codebase-scan.md` -> output steps + components.
- `step-executor-agent.md`: input one assigned component -> output `---RESULT--- STATUS: success ...`.
- `verification-agent.md`: input `plan.md` + component results + baseline -> output `---VERIFICATION---`.

## Installer Rules

When adding or deleting workflow-owned files, update:

- `bin/install.js` `LEGACY_REMOVED_FILES` and `getWorkflowManagedFiles()`
- `bin/sync-agents.js` managed skills/agents if applicable
- `test/verify-install-js.sh` only if its extraction logic no longer matches the manifest shape

`LEGACY_REMOVED_FILES` must include old v1 command names so upgrades remove stale installed commands.

When adding an upgrade migration, add it to **both** `performUpdate()` and `performCodexUpdate()`.
