# dev-workflow Guide

v2.0.0 collapses the old five command path into the dev-workflow command path:

```text
/5:plan -> /5:implement -> /5:review
```

The package is named `foifi`.

## Architecture

The workflow separates human decisions from mechanical execution.

- `plan.md` is the only planning artifact.
- `codebase-scan.md` caches discovery so later phases avoid repeated scanning.
- The execution graph is derived by `step-orchestrator-agent` on every run and is never written to disk.
- `state.json` persists only what a resume needs: status, completed component names, and the verification result.

Where Claude Code ships a native capability, the workflow wraps it: `/5:plan` runs inside native plan mode and `/5:review` calls the built-in `code-review` skill. Codex has neither, so both commands keep a prose fallback.

This keeps planning short and reviewable while still giving implementation agents enough structured data to work reliably.

## Plan

Run:

```text
/5:plan
```

or:

```text
$5-plan
```

The planner gathers requirements, explores the codebase, asks targeted questions, and writes:

```text
.5/features/{feature-name}/plan.md
.5/features/{feature-name}/codebase-scan.md
```

`plan.md` uses either the normal template or `PLAN-COMPACT.md` for small, low-risk changes with 1-2 components and no migration, security/auth, or public API contract change. It contains:

- overview
- what changes
- existing patterns to follow
- constraints
- scope in/out
- acceptance criteria
- decisions
- module impact
- component checklist
- technical notes

The component checklist has only four columns: component, action, target path, intent. It does not contain step grouping, model selection, verify commands, or pattern-reference wiring.

Which template gets chosen also decides what happens on approval: a compact plan is implemented immediately in the same session, while a full plan stops after writing the artifacts and points you at `/5:implement`.

## Refining A Plan

Run:

```text
/5:plan {feature-name}
```

With an existing `plan.md`, `/5:plan` enters refine mode: it seeds plan mode with the current plan, discusses the changes, then overwrites the file and appends a `## Discussion History` entry. Use this when the reviewed plan needs changed scope, additional acceptance criteria, or a corrected component checklist.

## Implement

Compact plans never reach this command. Approving a plan means you want it built, so `/5:plan` implements a 1-2 component plan inline in the session that planned it and writes the same `state.json` — orchestration would cost more than it saves at that size. What follows applies to full plans.

Run:

```text
/5:implement {feature-name}
```

Prefer a fresh context first — `/clear` in Claude Code, a new conversation in Codex. This command needs only `plan.md` and `codebase-scan.md`, and dropping the planning conversation is the point of the handoff. It is a recommendation, not a requirement.

Implementation does three things:

1. Spawns `step-orchestrator-agent` to derive the execution graph from `plan.md` and `codebase-scan.md` — steps, execution mode, dependency edges, model choice, targeted pattern references, and verify commands.
2. Spawns executor agents for each component using an inline executor contract, parallelizing independent work.
3. Spawns `verification-agent` to verify completeness, correctness, build/tests, acceptance criteria, and test coverage.

The graph is transient. `state.json` records only:

- `status` — `in-progress`, `completed`, or `failed`
- `completedComponents` — the names of components that finished
- `verification` — final status plus a one-line summary
- `startedAt` / `lastUpdated`

Live progress during a run comes from the task list rather than the file.

If implementation is interrupted, rerun `/5:implement {feature-name}` to resume. The graph is re-derived and components already in `completedComponents` are skipped — which works because component names are copied verbatim from the plan's checklist. Note that the Workflow path writes `state.json` only when the run returns, so a run killed mid-way repeats the components it had finished.

Verification runs inline during `/5:implement`. It checks planned files, final build/test commands, acceptance criteria, and recorded component verification outcomes.

## Review

Run:

```text
/5:review
```

On Claude Code, review delegates to the built-in `code-review` skill. Effort defaults to `high`; pass `/5:review low|medium|high|max` to override. Where that skill is unavailable (Codex), a built-in review agent triages changed files by risk and reads full files only for high-risk changes or when diff context is insufficient. Either way it saves findings to:

```text
.5/features/{feature-name}/review-findings-{timestamp}.md
```

When findings exist, `/5:review` asks whether to address them right away and hands off automatically if you say yes. To pick it up later instead:

```text
/5:address-review-findings {feature-name}
```

`/5:address-review-findings` is a compact coordinator. It routes local fixes, PR comment triage, and PR replies through focused helper commands:

- `/5:apply-review-findings`
- `/5:triage-pr-comments`
- `/5:reply-pr-comments`

PR comment decisions are recorded in `.5/features/{feature-name}/pr-comment-decisions.json` when PR handling is used.

## Configuration

First-time setup:

```text
/5:configure
/5:implement CONFIGURE
```

`/5:configure` writes `.5/config.json` and a CONFIGURE plan. `/5:implement CONFIGURE` generates documentation, the codebase index, AGENTS.md, CLAUDE.md shim, selected skills, and scoped rules.

Refresh generated docs/index/skills later with:

```text
/5:reconfigure
```

`/5:reconfigure` writes `.5/reconfigure-manifest.json` and passes that compact manifest to documentation and skill refresh helpers instead of duplicating long detection summaries in prompts.

## Troubleshooting

If an implementation failed:

1. Read `.5/features/{feature-name}/state.json`.
2. Fix external blockers if needed.
3. Re-run `/5:implement {feature-name}` to resume.

If an upgrade left old command files installed, run:

```text
npx foifi --upgrade
```

v2.0.0 removes old commands during upgrade:

- `plan-feature`
- `plan-implementation`
- `implement-feature`
- `verify-implementation`
- `review-code`
- `quick-implement`

## Quick Reference

| Command | Purpose |
|---------|---------|
| `/5:plan` | Create a unified plan, or refine an existing one |
| `/5:implement` | Implement and verify |
| `/5:review` | Review changes |
| `/5:commit` | Create a templated git commit |
| `/5:address-review-findings` | Apply approved findings |
| `/5:configure` | Create project config and CONFIGURE plan |
| `/5:reconfigure` | Refresh generated project context |
