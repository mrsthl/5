---
name: 5:review
description: Reviews code changes for correctness via the built-in code-review skill, for security via security-review when the diff is security-sensitive, and for standards via review-style. Categorizes findings and saves them for /5:address-review-findings.
allowed-tools: Bash, Read, Glob, Grep, AskUserQuestion, Agent, Skill, mcp__jetbrains__*
argument-hint: [low|medium|high|max] [since {fixed-point} files: {paths} feature: {name} dirty: {paths}]
user-invocable: true
model: sonnet
---

<role>
You are a Code Reviewer. You review code, categorize findings, and save them to a findings file.
You do NOT apply fixes. Fix application is handled by /5:address-review-findings.
</role>

# Review

## Step 1: Determine Scope

When the arguments say `since {fixed-point} files: {paths} feature: {name} dirty: {paths}` — `/5:implement` passes this — review exactly those files' changes since that commit and skip the question. `/5:implement` runs this before it commits, so the changes are in the working tree. The working tree can also hold changes the user had before the run: in this scope, **drop every finding whose file is not in `{paths}`**, from every reviewer, before saving.

Otherwise ask what to review:

1. Staged changes (`git diff --cached`)
2. Unstaged changes (`git diff`)
3. All changes (`git diff HEAD`)
4. Current branch vs main/master (`git diff main...HEAD`)

## Step 2: Run the Review

Effort level: default `high`. If the user passed an argument matching `low`, `medium`, `high`, or `max`, use that instead.
`ultra` is not accepted here — it is user-triggered and billed and cannot be launched from a command. If the user passes it, say so and use `max`.

Never pass `--fix` or `--comment`. This command only records findings; applying fixes and posting PR comments is `/5:address-review-findings`.

**Primary path** — if the built-in `code-review` skill is available, invoke it:

```text
Skill(skill: "code-review", args: "{target} {effort}")
```

Derive `{target}` from the scope answer: options 1-3 and the `since … files:` scope review the current working-tree diff (no target argument needed); option 4 passes the branch. Use the findings it reports.

**Security review** — when the diff touches authentication, authorization, user input handling, secrets, cryptography, or SQL/shell/path construction, and the built-in `security-review` skill is available, invoke it on the same scope:

```text
Skill(skill: "security-review")
```

Use the vulnerabilities it reports. Skip it for diffs that touch none of these areas.

**Flow review** — a diff reviewer reads file by file and misses failures that only show across files and states. When the diff touches install, update, migration, deploy, or bootstrap paths, the order in which files are written, uploaded, or loaded, or is security-sensitive, spawn one agent on `opus` at `effort: "medium"`:

```text
Trace behavior ACROSS the changed files and the states they run in. Read the entry points, then follow each flow end to end:
- a fresh install with no earlier state: missing directories, files, config, or database rows;
- an upgrade from the previous version, and an update that stops halfway;
- the order of operations across files: what is written, uploaded, loaded, or required first, and what breaks when that order changes or one step fails;
- output, headers, or side effects that happen before guards, error handling, or error suppression are in place;
- files and helpers the change relies on but does not check, and tests that assert the old order or state.
Report only failures you can describe as a concrete sequence of states. Do not edit files.
Output the same blocks as the fallback path below.
```

**Standards review** — then invoke `review-style` in report-only mode. It checks the same changes against the repository's own standards and the style skills it lists, and repository standards win:

```text
Skill(skill: "review-style", args: "{mode} report only")
```

Derive `{mode}` from the scope answer: option 1 passes `staged`, option 2 `unstaged`, option 3 `uncommitted`, option 4 `{base-branch} committed only`, and the `since … files:` scope `{fixed-point} files: {paths}`.

**Fallback path** — on Codex, or when the `code-review` skill is unavailable, spawn one review agent instead:

```text
Review the diff for {scope} blind, on its merits.
Triage files by risk; read full files only for high-risk changes, public API boundaries,
security/auth, and data migrations. For everything else, review the diff alone.
Report bugs, security, performance, code quality, API design, missing tests, and
over-engineering (unnecessary abstractions, single-use indirection, speculative
generality, reinventing stdlib or existing dependencies).
Do not apply fixes. Keep findings concise; no raw diff excerpts.

Output:
Status: success | failed
Error: {if failed}
Summary: total: {N}, fixable: {N}, questions: {N}, manual: {N}
Fixable Issues:
- file: {path}, line: {N}, description: {what}, fix: {suggestion}
Questions:
- file: {path}, line: {N}, question: {what}
Manual Review:
- file: {path}, line: {N}, description: {what}, severity: {level}
```

On Codex, or when the `review-style` skill cannot be invoked, read `.claude/skills/review-style/SKILL.md` and follow it with the same arguments.

## Step 3: Save Findings

Use the `feature:` argument when given. Otherwise use the feature of the most recently modified plan in `.5/planning/` — its `feature` frontmatter field, or its file name without `.md` — or ask the user.

Write `.5/features/{feature-name}/review-findings-{YYYYMMDD-HHmmss}.md` using `.claude/templates/workflow/REVIEW-FINDINGS.md`.

When the findings come from the `code-review` skill, map its reported fields onto the template:

| Reported finding | Template field |
|---|---|
| `verdict: CONFIRMED` with a localized, single-file fix | **Category:** `Fixable` |
| `verdict: PLAUSIBLE` | read the code and confirm or refute it yourself: confirmed → as `CONFIRMED`, refuted → leave it out, still open → **Category:** `Question` |
| `verdict: CONFIRMED` but spanning files or needing a design decision | **Category:** `Manual` |
| `category: correctness` | **Severity:** `error` (`warning` when `PLAUSIBLE`) |
| `category: simplification` / `efficiency` / `test-coverage` | **Severity:** `suggestion` |
| `file`, `line` | **File:**, **Line:** |
| `summary` | **Description:** |
| the concrete fix, else `short_summary` | **Suggested Fix:** |
| `failure_scenario` | **Original Reviewer Message:** |

Findings from `security-review` map to **Category:** `Fixable` when the fix is local, otherwise `Manual`, always with **Severity:** `error`; its explanation of the exploit goes into **Original Reviewer Message:**.

Findings from the fallback path and the flow review map directly: Fixable Issues, Questions, and Manual Review become their matching categories.

Use `Question` sparingly: only for a finding whose fix depends on a decision the user must make. A clearly better way to do the same thing is `Fixable`, not a question.

Findings from `review-style` map like this. Leave out its Suppressed findings; a repository standard overrides them.

| Reported finding | Template field |
|---|---|
| ⛔️ hard breach of a repository standard | **Category:** `Fixable`, **Severity:** `error` |
| ⚠️ judgement call | **Category:** `Fixable`, **Severity:** `suggestion` |
| `path:line` | **File:**, **Line:** |
| ID, title, and what is wrong | **Description:** |
| the `→` fix | **Suggested Fix:** |
| the cited standards and rules | **Original Reviewer Message:** |

Do not ask the user to edit action markers in the findings file. The findings file is the review record; `/5:address-review-findings` decides on the findings and records the decisions separately.

## Step 4: Report and Hand Off

Output:

```text
Review complete.

- Fixable: {N}
- Questions: {N}
- Manual review needed: {N}

Findings saved at `.5/features/{feature-name}/review-findings-{timestamp}.md`
```

If there are no findings, stop here.

Otherwise run `/5:address-review-findings {feature-name}` right away — with `dirty: {dirty-paths}` when `/5:implement` called this review. It fixes the clear findings on its own, asks the user one question at a time only about real decisions, and then runs build, test, and lint. Do not ask before handing off: the user asked for the review, and the findings exist to be fixed. A user who wants to decide every finding runs `/5:address-review-findings {feature-name} --interactive`.
