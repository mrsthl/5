---
name: 5:implement
description: Executes a plan from .5/planning/. Compact plans are implemented inline in this session; full plans run through the Workflow tool when available (parallel waves, schema-validated agents), otherwise an equivalent prose loop. Codex always uses the prose loop. Verifies that the plan was built and works, then runs /5:review.
allowed-tools: Agent, Read, Write, Edit, Glob, Grep, Bash, Workflow, Skill, AskUserQuestion
user-invocable: true
argument-hint: [feature-name-or-plan-path]
---

<role>
You are an Implementation Orchestrator. A compact plan you implement yourself. For a full plan you keep your context lean and delegate every code edit to executor agents.
</role>

# Implement

## Step 1: Load the Plan

Find the plan:

- If the argument is a path to a plan file, use it.
- Otherwise look in `.5/planning/` for a file named `{argument}.md`, or whose frontmatter has `feature: {argument}`. If several match, use the most recently modified one.
- Without an argument, use the most recently modified file in `.5/planning/` and name it to the user.
- If no plan matches, stop and ask the user to plan the feature first — in plan mode on Claude Code, with `$5-plan` on Codex — then rerun `/5:implement`.

Plans have no fixed shape. The feature name is the plan's `feature` frontmatter field when it has one, otherwise the file name without `.md`.

Read the plan and `.5/config.json` if it exists. Nothing is persisted between runs; a rerun starts over, and executors see work that is already done in the files.

A plan is **compact** when it changes 1-2 files with no data migration, no security/auth change, and no public API change. Every other plan is **full**.

Collect the standards once for this run:

- **Repository standards:** the files `.claude/skills/review-style/SKILL.md` step 2 lists that exist in this repository.
- **Style skills:** the absolute paths of the styles listed under `## Styles` in `.claude/skills/review-style/SKILL.md`. Resolve them from that skill's directory.

## Step 2: Establish Baseline

Record `git rev-parse HEAD` as this run's **fixed point** for the review in Step 4.

Run build/test commands from `.5/config.json`. Skip commands set to `none`. Keep the results in context for this run — they are what lets verification tell pre-existing failures apart from new ones. If baseline fails, warn and continue.

## Step 3: Run

### Compact plan: implement inline

The context is already warm, and an agent for one or two files costs more than it saves. Implement the plan yourself, in this session, with no agents and no Workflow call:

- Follow the repository standards first, then the style skills. Follow the patterns the plan names.
- Make the smallest coherent change: reuse existing code in this codebase first, then the standard library, native platform features, and installed dependencies. Touch only the planned files and what they strictly need (their tests, an import site). Add no new dependency.
- Then run the **fast-path check** (3c).

### Full plan, with the `Workflow` tool (preferred)

It moves orchestration into deterministic JS, fires parallel components concurrently, and returns schema-validated results — fewer tokens than driving the loop turn-by-turn.

1. Call `Workflow({name: "5-implement", args})` with:

```json
{
  "feature": "{feature-name}",
  "paths": {"plan": "{plan-path}", "config": ".5/config.json"},
  "standards": {"repo": ["CONTRIBUTING.md"], "styles": ["/abs/path/.claude/skills/fowler-code-smells/SKILL.md"]},
  "baseline": [{"command": "...", "status": "passed|failed|skipped", "summary": "one line"}]
}
```

- `standards` holds the repository standards and style skill paths from Step 1. Executors follow them while writing code.
- `baseline` is the array from Step 2 (or `[]`); the workflow's verifier treats those failures as pre-existing and reuses passing results instead of rerunning them.
- The workflow reads the config **file** at `paths.config` itself; do not pass build/test/commit settings inline.

2. If the returned `verification.inline` is `true` (every component was mechanical and passed, so no verification agent ran), run the **fast-path check** (3c) and take its result as the verification.
3. Continue with Step 4.

### Full plan, without the `Workflow` tool (prose loop)

It produces the same outcome.

#### 3a. Derive the execution graph

Spawn `step-orchestrator-agent` with the plan path and config. It returns steps, dependencies, a model per component, `patternRefs` (line ranges/symbols), and verify commands. Check the graph: non-empty steps, and each component carrying `step`, `mode`, `model`, `patternRefs`, and `verifyCommands`.

#### 3b. Execute steps in waves

For each step:

1. Pre-check: every dependency component succeeded and its files still exist.
2. Spawn executors with the component's model. Run `opus` at `effort: "medium"`.
   - **Parallel step: emit all of the step's executor Agent calls in a single message so they run concurrently.**
   - Sequential step (same-file or dependency): one executor at a time.
   - Give each executor only its component block, required `patternRefs`, verify commands, the standards from Step 1, and the inline contract below — do not make it read `step-executor-agent.md`.

```text
Implement exactly the assigned component. Read only listed patternRefs ranges/symbols and the target file. Read the parts of the repository standards and style skills that apply to your target and follow them; repository standards win over the styles. Make the smallest coherent change — reuse existing codebase code first, then stdlib, native platform features, and installed dependencies; touch only the target file and what it strictly needs (its test, an import site) — run assigned verify commands, and stop (STATUS: failed) for missing dependencies, unplanned auth/schema/API changes, or unclear product decisions. If verify fails only from pre-existing unrelated issues, report it under DEVIATIONS with the exact evidence and keep STATUS: success — your change is complete. Do not make more than three attempts on the same failing issue.

End with:
---RESULT---
STATUS: success | failed
FILES_CREATED: [comma-separated paths]
FILES_MODIFIED: [comma-separated paths]
VERIFY: passed | failed | skipped
DEVIATIONS: none | {brief list}
SKIPPED: none | {what you deliberately did not build — add when ...}
ERROR: none | {error description}
---END---
```

3. Parse only the `---RESULT---` block from each executor. Trust the executor's report — do not re-read files you did not change to confirm them.

Retry failed components up to twice on `opus` at `effort: "medium"`. Never fix code in the orchestrator context.

#### 3c. Verify

- **Fast path:** when every component reported `success` with `verify` `passed` or `skipped`, every component was planned as `haiku`, and none needed a retry, run the **fast-path check** below and skip `verification-agent`.
- **Otherwise:** spawn `verification-agent` — it checks only that the plan was built and works; quality and correctness come from `/5:review` in Step 4 — on `opus` at `effort: "medium"` when any component was planned as or retried on `opus`, else on `sonnet` — with the plan path, the component results, the baseline from Step 2, the repository standards from Step 1, and config. It returns:

```text
---VERIFICATION---
STATUS: passed | partial | failed
COMPLETENESS: passed | partial | failed
INFRASTRUCTURE: passed | failed
ACCEPTANCE_CRITERIA: satisfied/total
SCOPE: passed | drift
ERRORS: none | {summary}
---END_VERIFICATION---
```

**Fast-path check** — used by compact plans and by the fast path of both full-plan routes:

1. Run the configured build and test commands once (skip any set to `none`). A command that passed in the baseline and fails now sets `STATUS: failed`; a failure the baseline already had is pre-existing and only goes into the report.
2. `git status --short` and `git diff HEAD --stat`: every changed file must be a planned target, its test, an import site it needs, or a file a repository standard requires (such as a changelog entry). Anything else is drift.
3. Changed dependency manifests or lockfiles: a dependency the plan does not require is drift.
4. `git diff HEAD` on the changed files plus the full contents of untracked (`??`) files — `git diff HEAD` omits files not yet committed — read against the plan: work the plan rules out or defers, or abstraction/configurability the plan does not ask for, is drift.

Set `SCOPE: passed | drift`. Drift never changes the verification status; it only goes into the report.

## Step 4: Review

Run `/5:review since {fixed-point} files: {run-files}` with the fixed point from Step 2. `{run-files}` lists the files this run created, modified, or deleted, so changes the user already had stay out of the review. `/5:review` runs every quality check exactly once — the built-in `code-review`, `security-review` for security-sensitive files, and `review-style` against the repository standards and the style skills — saves the findings, fixes the clear ones on its own, and asks the user only about real decisions, one at a time. Run it on every path, and before the auto-commit, so approved fixes land in the same commit.

## Step 5: Auto-commit

If `.5/config.json` `git.autoCommit` is `true` and verification passed, commit — including the review fixes from Step 4 for those files — once per step for a full plan, once for a compact plan:

1. Stage only files that step owns: each component's `file` for create/modify/delete, both `sourceFile` and `file` for rename, plus the executors' reported `FILES_CREATED`/`FILES_MODIFIED`. For a compact plan, stage the files you changed. Do not stage unrelated changes.
2. Build the message from `git.commitMessage.pattern`, replacing `{ticket-id}` with the ticket the plan or the branch name gives (or empty) and `{short-description}` with `step {number}: {step-name}` (compact plan: a short summary of the change); trim redundant whitespace/punctuation when the ticket is empty.
3. Commit.

No changed files → skip. Commit error → report it and continue; do not retry with broader paths. If `git.autoCommit` is missing/`false`, do not commit.

## Step 6: Report

Report: completed/failed component counts, verification status, auto-commit count and any failures, and any failed commands, missing tests, or unmet acceptance criteria. When verification failed, tell the user to fix the reported issues and rerun `/5:implement {feature-name}`. Also list, one line each:

- **Review:** the findings count from `/5:review` and how many were fixed.
- **Scope:** drift findings from verification, plus files an executor touched outside its planned target (the workflow returns these as `extraFiles`). Suggest `/5:lean-check {feature-name}` when there are any.
- **Skipped:** every non-`none` `SKIPPED` entry from the executors, so deliberate omissions stay visible.

Then stop.
