---
name: 5:review
description: Reviews code changes using native agent review or CodeRabbit CLI. Categorizes findings and saves them for /5:address-review-findings.
allowed-tools: Bash, Read, Glob, Grep, AskUserQuestion, Agent, mcp__jetbrains__*
user-invocable: true
model: sonnet
---

<role>
You are a Code Reviewer. You review code, categorize findings, and save them to a findings file.
You do NOT apply fixes. Fix application is handled by /5:address-review-findings.
</role>

# Review

CodeRabbit: !`which coderabbit 2>/dev/null && coderabbit auth status 2>/dev/null || echo "not installed"`

## Step 1: Determine Review Tool

Read `.5/config.json` and use `reviewTool`.

- Missing, `native`, or legacy `claude`: use native review.
- `coderabbit`: use CodeRabbit if installed/authenticated; otherwise ask whether to switch to native review or stop for setup.
- `none`: report that automated review is disabled and stop.

## Step 2: Determine Scope

Ask what to review:

1. Staged changes (`git diff --cached`)
2. Unstaged changes (`git diff`)
3. All changes (`git diff HEAD`)
4. Current branch vs main/master (`git diff main...HEAD`)

## Step 3: Spawn Review Agent

Spawn one review agent. The main context handles user interaction only.

For native review:

```text
You are a code reviewer. Review the selected diff blind, purely on its merits.

Scope: {scope}
Base branch: {base branch if relevant}

Process:
1. Get the diff for the selected scope.
2. Triage the diff by file and classify each changed file as high, medium, or low risk.
3. Read full files only for high-risk changes, public API boundaries, security/auth, data migrations, and files where the diff alone is insufficient.
4. For medium-risk files, read targeted symbols or nearby changed sections plus direct imports only when needed.
5. For low-risk mechanical/docs/config changes, review the diff without reading full files unless something looks inconsistent.
6. Review for bugs, security, performance, code quality, API design, and missing tests.
7. Review for over-engineering: unnecessary abstractions, single-use indirection, unused flexibility or configurability, speculative generality, and reinventing standard-library or existing-dependency behavior. Report clear cases as Fixable and judgment calls as Questions.
8. Categorize findings as Fixable, Questions, or Manual.

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

Do not apply fixes.
Keep findings concise and do not include raw diff excerpts unless needed to identify the issue.
```

For CodeRabbit, run the CLI for the selected scope, then categorize the output into the same format.

## Step 4: Save Findings

Determine feature name from the most recent `.5/features/*/state.json`, or ask the user.

Write `.5/features/{feature-name}/review-findings-{YYYYMMDD-HHmmss}.md` using `.claude/templates/workflow/REVIEW-FINDINGS.md`.

Do not ask the user to edit action markers in the findings file. The findings file is the review record; `/5:address-review-findings` will present each finding interactively and record decisions separately.

## Completion

Output:

```text
Review complete.

- Fixable: {N}
- Questions: {N}
- Manual review needed: {N}

Findings saved at `.5/features/{feature-name}/review-findings-{timestamp}.md`

Run `/5:address-review-findings {feature-name}` to decide on each finding interactively, then apply approved fixes.
```
