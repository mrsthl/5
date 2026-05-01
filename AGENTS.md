# Repository Guide

This repository publishes the `foif` npm package for Claude Code and Codex.

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
  install.js          installer, updater, Codex conversion
  sync-agents.js      Claude/Codex user-content sync
src/
  commands/5/         workflow commands
  agents/             reusable agent instructions
  hooks/              Claude Code hooks
  skills/             setup and project-skill generators
  templates/workflow/ workflow artifact templates
test/                 shell verification scripts
```

## Workflow Model

Primary commands:

1. `/5:plan` - writes `.5/features/{name}/plan.md` and `codebase-scan.md`
2. `/5:implement {name}` - derives `state.json`, executes components, verifies inline
3. `/5:review` - reviews code and writes review findings

Helpers:

- `/5:discuss-feature {name}` refines an existing `plan.md`.
- `/5:address-review-findings {name}` applies approved review findings.
- `/5:configure` writes config and the CONFIGURE plan.
- `/5:reconfigure`, `/5:update`, `/5:eject`, `/5:unlock`, and `/5:synchronize-agents` are maintenance commands.

Codex equivalents use `$5-...` skill names.

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
