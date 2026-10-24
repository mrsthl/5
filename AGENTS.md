# Repository Guide

This repository publishes the `foifi` npm package for Claude Code and Codex.

## Development

```bash
npm test
bash test/verify-install-js.sh
bash test/test-check-updates-hook.sh
bash test/test-dependency-guard.sh
bash test/test-update-system.sh
```

Do not manually bump `package.json` version for workflow refactors unless the release process explicitly asks for it.

## Layout

```text
bin/
  install.js          installer, updater, Codex conversion, upgrade migrations
  sync-agents.js      Claude/Codex user-content sync
src/
  commands/5/         workflow commands (both runtimes)
  codex-commands/     Codex-only commands, listed in `codexCommands` (e.g. plan.md; Claude Code uses plan mode)
  agents/             reusable agent instructions
  workflows/          Workflow-tool scripts (Claude Code only; e.g. 5-implement.js)
  hooks/              Claude Code hooks (statusline, check-updates, check-reconfig, dependency-guard)
  skills/             setup generators and review styles (review-style + one skill per style)
  templates/workflow/ workflow artifact templates
test/                 shell verification scripts
```

## Runtime Parity

Every feature must work for both Claude Code and Codex. The two runtimes share `.5/` state but have separate install targets (`.claude/` vs `.codex/`).

| Concern | Claude Code | Codex |
|---|---|---|
| Commands | `/5:*` slash commands | `$5-*` skills (auto-converted by installer) |
| Planning engine | Native plan mode, shaped by the "Planning" section of the generated `AGENTS.md` block; no plan command. `/5:configure` sets `plansDirectory` so the plan file lands in `.5/planning/` | `$5-plan` from `src/codex-commands/plan.md`, which writes `.5/planning/{name}.md` itself, + the "Guard Rules" block in `getCodexSkillAdapterHeader()` (no plan mode) |
| Implement orchestration | `.claude/workflows/5-implement.js` (Workflow tool) when available, else the prose loop in `implement.md` | prose loop only (no Workflow tool) |
| Review engine | Built-in `code-review` skill via the `Skill` tool when available, else the prose fallback in `review.md`; plus `security-review` for security-sensitive diffs and `review-style` | prose fallback only (no `Skill` tool); `review-style` by reading its SKILL.md |
| Standards review | `Skill(review-style)` in `/5:review`, which `/5:implement` runs at its end | `Skill(skill="review-style")` row in the "Tool Mapping" of `getCodexSkillAdapterHeader()` |
| Model mapping (haiku/sonnet/opus) | real model names inline | centralized in `getCodexSkillAdapterHeader()` "Model Mapping" |
| Hooks | `src/hooks/*.js` via `settings.json` (`statusline`, `check-updates`, `check-reconfig`, `dependency-guard`) | Embedded as instructions in skill adapter preamble; the `dependency-guard` Stop hook becomes the "Scope Discipline" rule in `generateCodexInstructions()` because it must apply outside the workflow skills too |
| Statusline | `src/hooks/statusline.js` | Not available |
| Update notice | Statusline reads `.5/.update-cache.json` | Skill adapter preamble reads `.5/.update-cache.json` at startup |
| Migration notice | Statusline reads `.5/.migration-v*` | Skill adapter preamble reads `.5/.migration-v*` at startup |
| Security review | `Skill(security-review)` in `/5:review` when the diff is security-sensitive | `Skill(skill="security-review")` row in the "Tool Mapping"; the prose review fallback covers security |
| Upgrade migrations | `performUpdate()` in `install.js` | `performCodexUpdate()` in `install.js` — must mirror all migrations |

**Rule:** When adding a hook, statusline indicator, or upgrade migration for Claude Code, add an equivalent for Codex. The most common Codex equivalent is an instruction in `getCodexSkillAdapterHeader()`.

## Workflow Model

Primary commands:

1. Plan mode / `$5-plan` — on Claude Code there is no plan command: the "Planning" section of the `AGENTS.md` template asks Claude, in native plan mode, for a diagram where it helps, what the repository standards require, and the ticket handling, and to run `/5:implement {plan-path}` after approval. It prescribes no plan structure and no save location; plan mode saves the plan where `plansDirectory` points (`.5/planning/`). Codex has no plan mode and runs `$5-plan` (`src/codex-commands/plan.md`), which ends with the same hand-off.
2. `/5:implement {name}` / `$5-implement {name}` — takes a plan path, or finds the plan in `.5/planning/` by file name or `feature` frontmatter (newest plan without an argument), derives the execution graph (inline for a compact plan, via the orchestrator otherwise), executes components in parallel waves, verifies that it was built and works, then runs `/5:review` on the run's files before any auto-commit. On Claude Code it runs `.claude/workflows/5-implement.js` via the Workflow tool when available (the orchestrator/executor/verifier prompts in that script are the schema-validated form of `src/agents/*-agent.md` — keep them in sync), and falls back to the prose loop in `implement.md` otherwise. Codex always uses the prose loop.
3. `/5:review [low|medium|high|max]` / `$5-review` — reviews code and writes review findings. On Claude Code it delegates to the built-in `code-review` skill (default effort `high`), adds the built-in `security-review` skill when the diff is security-sensitive, and maps their reported findings onto `REVIEW-FINDINGS.md`; Codex uses the condensed prose fallback in `review.md`. Both then run `review-style` in report-only mode and map its findings too.

Helpers:

- `/5:lean-check [base-branch|feature-name] [request]` checks any diff — with or without a plan — for scope drift and over-engineering, and can revert the drift.
- `/5:address-review-findings {name} [--interactive]` runs after every `/5:review`: it fixes clear findings on its own, asks the user one question at a time only for real decisions, and verifies the result.
- `/5:analyze-feature {topic}` documents a feature or dataflow with mermaid diagrams.
- `/5:configure` writes config and the CONFIGURE plan.
- `/5:reconfigure`, `/5:update`, `/5:eject`, and `/5:synchronize-agents` are maintenance commands.

All commands have `$5-*` Codex equivalents unless noted otherwise.

## Project Instructions

`/5:configure` never owns a project's `AGENTS.md` or `CLAUDE.md`. `configure-agents-md` writes the workflow rules into `AGENTS.md` as one block between `<!-- foifi:start` and `<!-- foifi:end -->`, and appends `@AGENTS.md` to `CLAUDE.md` when that line is missing. Everything outside the block belongs to the repository, ranks as a repository standard, and is never changed. `review-style` uses the markers to tell the two apart.

`configure-rules` generates `.claude/rules/*.md` scoped to file globs and marks each with `<!-- foifi:generated -->`; only marked rules are refreshed or removed. foifi generates no project-specific skills: Claude explores the code itself. Pattern and `run-*` skills from earlier versions stay where they are, untouched.

The installer merges `src/settings.json` into an existing `settings.json` without overriding any value the user already set, such as their own `statusLine`.

Skills must not include `context: fork` — this causes skills to loop by re-invoking themselves in a fresh context. The upgrade migration in `performUpdate` / `performCodexUpdate` strips `context: fork` from existing skills and renames legacy `create-*` directories to bare pattern names.

## Planning Artifact

The plan file that native plan mode saves in `.5/planning/` is the only planning artifact. Plans have no prescribed structure or template — Claude or Codex shapes each one as the change needs. `step-orchestrator-agent` derives components from whatever the plan describes. There is no codebase index and no `codebase-scan.md`; agents explore on demand.

## Execution State

Nothing about a run is persisted. A compact plan (1-2 files, no migration, security/auth, or public API change) is implemented inline in the `/5:implement` session. A full plan's execution graph — steps, component wiring, model choices, `patternRefs`, verify commands — is derived on every run; a rerun starts over, and executors see already-done work in the files. There is no `state.json` and no task list.

Model tiers: `haiku` for mechanical work, `sonnet` for ordinary logic, `opus` at effort `medium` for complex logic, cross-module, security/auth, migrations, public API, and every retry. Keep the tiers in sync across `step-orchestrator-agent.md`, `orchestratorPrompt()` / `modelOpts()` in `5-implement.js`, `implement.md`, and the Codex "Model Mapping" in `getCodexSkillAdapterHeader()`.

## Agents

- `step-orchestrator-agent.md` reads the plan, then returns the execution graph.
- `step-executor-agent.md` implements assigned components and reports a strict `---RESULT---` block.
- `verification-agent.md` verifies that the plan was built and works — completeness, build/tests, acceptance criteria, scope — then returns a `---VERIFICATION---` block. Code quality and correctness are `/5:review`'s job; keep each check in exactly one place.

None of the three writes files outside its assigned component.

The scope contract is shared across runtimes and workflows: executors report deliberate omissions under `SKIPPED`, the verifier reports `SCOPE: passed | drift`, and outside the workflow the same rules live in the generated project `AGENTS.md` ("Simplicity First", "Surgical Changes") plus `/5:lean-check`, plus the `dependency-guard` Stop hook (Claude Code) that makes Claude justify any dependency the uncommitted diff adds, once per session. Keep the simplicity ladder in `src/templates/AGENTS.md`, `step-executor-agent.md`, `executorPrompt()` in `5-implement.js`, and the executor contract in `implement.md` in sync.

Usage examples:

- `step-orchestrator-agent.md`: input plan -> output steps + components.
- `step-executor-agent.md`: input one assigned component -> output `---RESULT--- STATUS: success ...`.
- `verification-agent.md`: input plan + component results + baseline + repository standards -> output `---VERIFICATION---`.

## Standards and Review Styles

Code quality follows one order everywhere: the target repository's own standards win, then the style skills, then the workflow rules in the generated `AGENTS.md`. Which files count as repository standards is defined once, in step 2 of `src/skills/review-style/SKILL.md`; everything else points there. Keep the precedence wording in sync across `src/templates/AGENTS.md`, `step-executor-agent.md`, `executorPrompt()` in `5-implement.js`, and the executor contract in `implement.md`.

The style list lives in the `## Styles` section of `review-style/SKILL.md`. To add a style:

- add `src/skills/{style}/SKILL.md` and list it under `## Styles` in `review-style/SKILL.md`
- add it to `getWorkflowManagedFiles()` and to `WORKFLOW_MANAGED_SKILLS` in `bin/sync-agents.js` (`test/verify-install-js.sh` checks both lists match)
- name it in the `## Standards` section of `src/templates/AGENTS.md`

`/5:configure` no longer generates architecture, testing, concerns, or conventions docs. Existing `.5/*.md` docs in a project stay untouched and linked, because a team may maintain them.

## Installer Rules

When adding or deleting workflow-owned files, update:

- `bin/install.js` `LEGACY_REMOVED_FILES` and `getWorkflowManagedFiles()`
- `bin/sync-agents.js` managed skills/agents if applicable
- `test/verify-install-js.sh` only if its extraction logic no longer matches the manifest shape

`LEGACY_REMOVED_FILES` must include old v1 command names so upgrades remove stale installed commands.

When adding an upgrade migration, add it to **both** `performUpdate()` and `performCodexUpdate()`.
