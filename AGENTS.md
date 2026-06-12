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
| Hooks | `src/hooks/*.js` via `settings.json` | Embedded as instructions in skill adapter preamble |
| Statusline | `src/hooks/statusline.js` | Not available |
| Update notice | Statusline reads `.5/.update-cache.json` | Skill adapter preamble reads `.5/.update-cache.json` at startup |
| Migration notice | Statusline reads `.5/.migration-v*` | Skill adapter preamble reads `.5/.migration-v*` at startup |
| Generated skills | `.claude/skills/{pattern}/SKILL.md` | `.codex/skills/{pattern}/SKILL.md` (paths substituted by installer) |
| Upgrade migrations | `performUpdate()` in `install.js` | `performCodexUpdate()` in `install.js` — must mirror all migrations |

**Rule:** When adding a hook, statusline indicator, or upgrade migration for Claude Code, add an equivalent for Codex. The most common Codex equivalent is an instruction in `getCodexSkillAdapterHeader()`.

## Workflow Model

Primary commands:

1. `/5:plan` / `$5-plan` — writes `.5/features/{name}/plan.md` and `codebase-scan.md`
2. `/5:implement {name}` / `$5-implement {name}` — derives `state.json`, executes components, verifies inline
3. `/5:review` / `$5-review` — reviews code and writes review findings

Helpers:

- `/5:discuss-feature {name}` refines an existing `plan.md`.
- `/5:split {name}` splits an existing `plan.md` into smaller linked plans.
- `/5:commit [short-description]` creates a git commit using `git.commitMessage.pattern`.
- `/5:address-review-findings {name}` applies approved review findings.
- `/5:configure` writes config and the CONFIGURE plan.
- `/5:reconfigure`, `/5:update`, `/5:eject`, `/5:unlock`, and `/5:synchronize-agents` are maintenance commands.

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

The component checklist stays intentionally lean: component, action, target path, intent. `step-orchestrator-agent` derives execution details into `state.json`.

## Agents

- `step-orchestrator-agent.md` reads `plan.md` and `codebase-scan.md`, then writes enriched `state.json`.
- `step-executor-agent.md` implements assigned components and reports a strict `---RESULT---` block.
- `verification-agent.md` verifies completeness, correctness, build/tests, acceptance criteria, and test coverage, then records concise status in `state.json`.

Usage examples:

- `step-orchestrator-agent.md`: input `plan.md` + `codebase-scan.md` -> output `state.json` with numbered steps.
- `step-executor-agent.md`: input one assigned component -> output `---RESULT--- STATUS: success ...`.
- `verification-agent.md`: input `plan.md` + `state.json` -> update `state.json` and output `---VERIFICATION---`.

## Installer Rules

When adding or deleting workflow-owned files, update:

- `bin/install.js` `LEGACY_REMOVED_FILES` and `getWorkflowManagedFiles()`
- `bin/sync-agents.js` managed skills/agents if applicable
- `test/verify-install-js.sh` only if its extraction logic no longer matches the manifest shape

`LEGACY_REMOVED_FILES` must include old v1 command names so upgrades remove stale installed commands.

When adding an upgrade migration, add it to **both** `performUpdate()` and `performCodexUpdate()`.
