---
name: 5:review
description: Reviews code changes via the built-in code-review skill. Categorizes findings and saves them for /5:address-review-findings.
allowed-tools: Bash, Read, Glob, Grep, AskUserQuestion, Agent, Skill, mcp__jetbrains__*
argument-hint: [low|medium|high|max]
user-invocable: true
model: sonnet
---

<role>
You are a Code Reviewer. You review code, categorize findings, and save them to a findings file.
You do NOT apply fixes. Fix application is handled by /5:address-review-findings.
</role>

# Review

## Step 1: Determine Scope

Ask what to review:

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

Derive `{target}` from the scope answer: options 1-3 review the current working-tree diff (no target argument needed); option 4 passes the branch. Use the findings it reports.

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

## Step 3: Save Findings

Determine feature name from the most recent `.5/features/*/state.json`, or ask the user.

Write `.5/features/{feature-name}/review-findings-{YYYYMMDD-HHmmss}.md` using `.claude/templates/workflow/REVIEW-FINDINGS.md`.

When the findings come from the `code-review` skill, map its reported fields onto the template:

| Reported finding | Template field |
|---|---|
| `verdict: CONFIRMED` with a localized, single-file fix | **Category:** `Fixable` |
| `verdict: PLAUSIBLE` | **Category:** `Question` |
| `verdict: CONFIRMED` but spanning files or needing a design decision | **Category:** `Manual` |
| `category: correctness` | **Severity:** `error` (`warning` when `PLAUSIBLE`) |
| `category: simplification` / `efficiency` / `test-coverage` | **Severity:** `suggestion` |
| `file`, `line` | **File:**, **Line:** |
| `summary` | **Description:** |
| the concrete fix, else `short_summary` | **Suggested Fix:** |
| `failure_scenario` | **Original Reviewer Message:** |

Findings from the fallback path map directly: Fixable Issues, Questions, and Manual Review become their matching categories.

Do not ask the user to edit action markers in the findings file. The findings file is the review record; `/5:address-review-findings` will present each finding interactively and record decisions separately.

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

Otherwise ask the user directly whether to continue:

- "Address these findings now?"
  - Options:
    1. "Yes, run `/5:address-review-findings {feature-name}`" — decide on each finding interactively, then apply approved fixes
    2. "No, stop here" — findings stay on disk for later

- If the user chooses yes: invoke `/5:address-review-findings {feature-name}`.
- If the user chooses no: tell them to run `/5:address-review-findings {feature-name}` when they are ready, and stop.
