# foifi

A structured AI-assisted development workflow for Claude Code and Codex.

## Install

```bash
npx foifi
npx foifi --codex
```

Global installs are also supported:

```bash
npx foifi --global
npx foifi --codex --global
```

Claude Code installs commands under `.claude/`. Codex installs converted skills under `.codex/skills/`.

## Configure

Run configuration once per project:

```bash
/5:configure
# or in Codex
$5-configure
```

Configuration writes `.5/config.json` and `.5/features/CONFIGURE/plan.md`. Then run:

```bash
/5:implement CONFIGURE
# or
$5-implement CONFIGURE
```

That generates project documentation, a rebuildable `.5/index/`, AGENTS.md, a CLAUDE.md shim, and selected project-specific skills/rules.

## Workflow

```bash
/5:plan
/5:implement {feature-name}
/5:review
/5:address-review-findings {feature-name}
```

Codex equivalents:

```bash
$5-plan
$5-implement {feature-name}
$5-review
$5-address-review-findings {feature-name}
```

Verification runs at the end of `/5:implement` and records concise results in `state.json`.

## Commands

| Command | Purpose |
|---------|---------|
| `/5:configure` / `$5-configure` | Detect project settings and write the CONFIGURE plan |
| `/5:plan` / `$5-plan` | Create one unified `plan.md` from requirements, codebase exploration, and user decisions |
| `/5:discuss-feature` / `$5-discuss-feature` | Refine an existing `plan.md` |
| `/5:implement` / `$5-implement` | Derive `state.json`, execute steps with agents, and verify inline |
| `/5:review` / `$5-review` | Review code changes and save findings |
| `/5:address-review-findings` / `$5-address-review-findings` | Apply approved review findings and PR comments |
| `/5:reconfigure` / `$5-reconfigure` | Refresh docs, index, skills, and rules |
| `/5:update` / `$5-update` | Upgrade installed workflow files |
| `/5:eject` / `$5-eject` | Stop workflow-managed updates |
| `/5:unlock` / `$5-unlock` | Remove a stale planning guard lock |
| `/5:synchronize-agents` / `$5-synchronize-agents` | Sync user content between Claude Code and Codex |

## Artifacts

Each feature lives under `.5/features/{feature-name}/`:

- `plan.md` - single human-reviewed planning artifact
- `codebase-scan.md` - cached discovery used to reduce repeated scanning
- `state.json` - enriched execution state derived by `step-orchestrator-agent`
- `review-findings-*.md` - review output for `/5:address-review-findings`

## Design

Planning stays human-readable. `plan.md` contains scope, acceptance criteria, decisions, module impact, and a clean component checklist. It intentionally does not ask the planner to fill model choices, verify commands, step grouping, or pattern-file wiring.

Implementation is mechanical. `step-orchestrator-agent` reads `plan.md` and `codebase-scan.md`, derives the execution graph into `state.json`, then `/5:implement` delegates each component to `step-executor-agent`. This reduces planning token cost and avoids brittle prompt-table metadata.

Verification uses a dedicated agent. `/5:implement` runs `verification-agent` at the end and records a concise final status in `state.json` without generating an extra report.

## Updating

```bash
npx foifi --upgrade
npx foifi --codex --upgrade
```

v2.0.0 is a hard migration. Finish in-progress v1.9.5 features before upgrading; v1 `feature.md` and old `state.json` formats are not supported.
