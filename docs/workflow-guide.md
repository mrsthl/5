# dev-workflow Guide

v2.0.0 collapses the old five command path into the dev-workflow command path:

```text
/5:plan -> /5:implement -> /5:review
```

The package is named `foifi`.

## Architecture

The workflow separates human decisions from mechanical execution.

- The plan in `.5/planning/` is the only planning artifact. Claude Code's plan mode saves it there because `/5:configure` sets `plansDirectory`.
- There is no codebase index or scan cache. What implementation needs, such as the patterns to follow, goes into the plan.
- The execution graph is derived by `step-orchestrator-agent` on every run and is never written to disk.
- `state.json` persists only what a resume needs: status, completed component names, and the verification result.

Where Claude Code ships a native capability, the workflow wraps it: `/5:plan` runs inside native plan mode and `/5:review` calls the built-in `code-review` skill. Codex has neither, so both commands keep a prose fallback.

Code quality follows a fixed order. The repository's own standards, such as `CONTRIBUTING.md` or `CODESTYLE.md`, always win. The style skills `fowler-code-smells`, `cognitive-load`, `documentation-style`, and `baseline-conventions` set the baseline wherever the repository says nothing. The `review-style` skill checks a change against both.

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

The planner gathers requirements, explores the codebase, asks targeted questions, and plan mode saves the approved plan as:

```text
.5/planning/{generated-name}.md
```

Plan mode picks the file name. The plan's `feature` frontmatter field ties it to its feature, and `/5:implement {feature-name}` finds it by that field. On Codex the plan is written to `.5/planning/{feature-name}.md`.

The plan uses either the normal template or `PLAN-COMPACT.md` for small, low-risk changes with 1-2 components and no migration, security/auth, or public API contract change. It contains:

- overview
- what changes
- a mermaid diagram, when a flow, state machine, or component relationships explain the change better than text
- existing patterns to follow, with a symbol or line range
- constraints, including what the repository's standards require
- scope in/out
- acceptance criteria
- decisions
- module impact
- component checklist
- technical notes

The component checklist has only four columns: component, action, target path, intent. It does not contain step grouping, model selection, verify commands, or pattern-reference wiring.

Which template gets chosen also decides what happens on approval: a compact plan is implemented immediately in the same session, while a full plan stops and points you at `/5:implement`.

## Refining A Plan

Run:

```text
/5:plan {feature-name}
/5:plan {path-to-plan}
```

With an existing plan, `/5:plan` enters refine mode: it seeds plan mode with the current plan and discusses the changes. After approval the new plan file replaces the old one. Use this when the reviewed plan needs changed scope, additional acceptance criteria, or a corrected component checklist. Passing a path also turns a plan made in plain plan mode into a workflow plan.

## Implement

Compact plans never reach this command. Approving a plan means you want it built, so `/5:plan` implements a 1-2 component plan inline in the session that planned it and writes the same `state.json` — orchestration would cost more than it saves at that size. What follows applies to full plans.

Run:

```text
/5:implement {feature-name}
```

Prefer a fresh context first — `/clear` in Claude Code, a new conversation in Codex. This command needs only the plan, and dropping the planning conversation is the point of the handoff. It is a recommendation, not a requirement.

Implementation does four things:

1. Spawns `step-orchestrator-agent` to derive the execution graph from the plan — steps, execution mode, dependency edges, model choice, targeted pattern references, and verify commands.
2. Spawns executor agents for each component using an inline executor contract, parallelizing independent work. Each executor follows the repository standards and style skills that apply to its target.
3. Spawns `verification-agent` to verify completeness, correctness, build/tests, acceptance criteria, and test coverage.
4. Runs `review-style` on everything the run changed, then asks which findings to fix.

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

On Claude Code, review delegates to the built-in `code-review` skill. Effort defaults to `high`; pass `/5:review low|medium|high|max` to override. Where that skill is unavailable (Codex), a built-in review agent triages changed files by risk and reads full files only for high-risk changes or when diff context is insufficient. When the diff touches authentication, user input, secrets, cryptography, or SQL/shell/path construction, the built-in `security-review` skill runs as well. Then `review-style` checks the same changes against the repository's standards and the style skills, in report-only mode. Either way it saves findings to:

```text
.5/features/{feature-name}/review-findings-{timestamp}.md
```

When findings exist, `/5:review` asks whether to address them right away and hands off automatically if you say yes. To pick it up later instead:

```text
/5:address-review-findings {feature-name}
```

`/5:address-review-findings` presents each finding with a recommendation, records `fix`/`wont_fix`/`wait` decisions, applies the approved fixes, and runs build, tests, and lint afterwards. For comments on a GitHub PR, ask Claude directly.

## Configuration

First-time setup:

```text
/5:configure
/5:implement CONFIGURE
```

`/5:configure` writes `.5/config.json`, sets `plansDirectory` to `.5/planning` in `.claude/settings.json`, and writes the CONFIGURE plan. `/5:implement CONFIGURE` adds the workflow rules to AGENTS.md as one marked block that links the repository's own standards, appends `@AGENTS.md` to CLAUDE.md when it lacks that line, and generates scoped rules. Nothing outside the block changes.

Refresh the AGENTS.md block and the rules later with:

```text
/5:reconfigure
```

`/5:reconfigure` writes `.5/reconfigure-manifest.json` and passes that compact manifest to the AGENTS.md and rule refresh helpers instead of duplicating long detection summaries in prompts. It is also the upgrade path after a major update: it sets `plansDirectory` and removes the legacy `.5/index/`. Existing `.5/*.md` docs stay untouched.

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
| `/5:plan` | Create a plan, or refine an existing one |
| `/5:implement` | Implement and verify |
| `/5:review` | Review changes for correctness and standards |
| `/5:address-review-findings` | Decide on findings and apply the approved ones |
| `/5:analyze-feature` | Document a feature with mermaid diagrams |
| `/5:configure` | Create project config and CONFIGURE plan |
| `/5:reconfigure` | Refresh the AGENTS.md block and rules |
