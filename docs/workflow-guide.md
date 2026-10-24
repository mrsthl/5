# dev-workflow Guide

v2.0.0 collapses the old five command path into the dev-workflow command path:

```text
plan mode -> /5:implement -> /5:review
```

The package is named `foifi`.

## Architecture

The workflow separates human decisions from mechanical execution.

- The plan in `.5/planning/` is the only planning artifact. Claude Code's plan mode saves it there because `/5:configure` sets `plansDirectory`.
- There is no codebase index or scan cache. What implementation needs, such as the patterns to follow, goes into the plan.
- The execution graph is derived by `step-orchestrator-agent` on every run and is never written to disk.
- Nothing about a run is persisted; a rerun of `/5:implement` starts over.

Where Claude Code ships a native capability, the workflow uses it: planning happens in native plan mode, shaped by the `AGENTS.md` rules, and `/5:review` calls the built-in `code-review` skill. Codex has neither, so it gets `$5-plan` and a prose review fallback.

Code quality follows a fixed order. The repository's own standards, such as `CONTRIBUTING.md` or `CODESTYLE.md`, always win. The style skills `fowler-code-smells`, `cognitive-load`, `documentation-style`, and `baseline-conventions` set the baseline wherever the repository says nothing. The `review-style` skill checks a change against both.

This keeps planning short and reviewable while still giving implementation agents enough structured data to work reliably.

## Plan

On Claude Code there is no plan command. Plan in native plan mode (shift+tab, or ask Claude to plan). The "Planning" section of the generated `AGENTS.md` shapes every plan, and plan mode saves it as:

```text
.5/planning/{generated-name}.md
```

On Codex, which has no plan mode, run `$5-plan`; it writes `.5/planning/{feature-name}.md`.

The plan has no prescribed structure; Claude shapes it as the change needs, with a mermaid diagram where a flow, state machine, or component relationships explain the change better than text. When the request names a ticket, Claude fetches it and confirms the content with you first.

Approving a plan means you want it built: Claude runs `/5:implement {plan-path}` right away. A small plan (1-2 files, no migration, security/auth, or public API change) skips the orchestrator there.

## Refining A Plan

Ask Claude in plan mode to refine an existing plan, by feature name or path. It starts from the plan's content. On Codex, run `$5-plan {feature-name}` or `$5-plan {path-to-plan}`.

## Implement

Run:

```text
/5:implement {feature-name}
```

Claude runs it right after you approve a plan; run it yourself to run a plan again.

A compact plan (1-2 files, no migration, security/auth, or public API change) is implemented inline in that session — no agents. Then build and tests run once, and a scope check compares the diff with the plan. `/5:review` follows, as for a full plan.

A full plan goes through four steps:

1. `step-orchestrator-agent` derives the execution graph — steps, execution mode, dependency edges, model choice, targeted pattern references, and verify commands.
2. Executor agents implement the components using an inline executor contract, independent ones in parallel. Each follows the repository standards and style skills that apply to its target. Mechanical work runs on `haiku`, ordinary logic on `sonnet`, complex work and every retry on `opus` at medium effort.
3. When every component was mechanical and passed, build and tests run once plus the scope check. Otherwise `verification-agent` checks completeness, build/tests, the plan's acceptance criteria when it states any, and scope.
4. `/5:review` runs once on the files the run changed — `code-review`, `security-review` for security-sensitive files, and `review-style` — and `/5:address-review-findings` then fixes the clear findings on its own and asks you only about real decisions, one question at a time. Auto-commit comes after, so approved fixes land in the same commit.

Nothing is persisted. If a run fails or is interrupted, fix the cause and rerun `/5:implement`; executors see work already in the files.

## Review

Run:

```text
/5:review
```

On Claude Code, review delegates to the built-in `code-review` skill. Effort defaults to `high`; pass `/5:review low|medium|high|max` to override. Where that skill is unavailable (Codex), a built-in review agent triages changed files by risk and reads full files only for high-risk changes or when diff context is insufficient. When the diff touches authentication, user input, secrets, cryptography, or SQL/shell/path construction, the built-in `security-review` skill runs as well. Then `review-style` checks the same changes against the repository's standards and the style skills, in report-only mode. Either way it saves findings to:

```text
.5/features/{feature-name}/review-findings-{timestamp}.md
```

When findings exist after `/5:implement`, `/5:review` hands them straight to `/5:address-review-findings`. When you start `/5:review` yourself — possibly on someone else's branch — it asks once before fixing anything and running build and tests. It fixes clear findings on its own — confirmed bugs, security issues, breaches of a repository standard, and style findings with a clear local fix — skips obsolete or out-of-scope ones, and asks you only about real decisions, one question at a time. Then it runs build, tests, and lint, and reports what it fixed, what it skipped, and what you decided. To go through saved findings again, or to decide on every finding yourself:

```text
/5:address-review-findings {feature-name} [--interactive]
```

For comments on a GitHub PR, ask Claude directly.

## Configuration

First-time setup:

```text
/5:configure
```

`/5:configure` writes `.5/config.json`, sets `plansDirectory` to `.5/planning` in `.claude/settings.json`, writes the CONFIGURE plan, and then runs `/5:implement CONFIGURE` itself, which adds the workflow rules to AGENTS.md as one marked block that links the repository's own standards, appends `@AGENTS.md` to CLAUDE.md when it lacks that line, and generates scoped rules. Nothing outside the block changes.

Refresh the AGENTS.md block and the rules later with:

```text
/5:reconfigure
```

`/5:reconfigure` writes `.5/reconfigure-manifest.json` and passes that compact manifest to the AGENTS.md and rule refresh helpers instead of duplicating long detection summaries in prompts. It is also the upgrade path after a major update: it sets `plansDirectory` and removes the legacy `.5/index/`. Existing `.5/*.md` docs stay untouched.

## Troubleshooting

If an implementation failed:

1. Read the verification result in the `/5:implement` report.
2. Fix external blockers if needed.
3. Re-run `/5:implement {feature-name}`.

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
| plan mode / `$5-plan` | Create a plan, or refine an existing one |
| `/5:implement` | Implement and verify |
| `/5:review` | Review changes for correctness and standards |
| `/5:address-review-findings` | Fix clear findings, ask about real decisions |
| `/5:analyze-feature` | Document a feature with mermaid diagrams |
| `/5:configure` | Create project config and CONFIGURE plan, then implement it |
| `/5:reconfigure` | Refresh the AGENTS.md block and rules |
