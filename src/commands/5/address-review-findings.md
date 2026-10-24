---
name: 5:address-review-findings
description: Fixes clear review findings on its own, asks the user one question at a time only for real decisions, then verifies the result. --interactive asks about every finding.
allowed-tools: Bash, Read, Edit, Write, Glob, AskUserQuestion, Agent
argument-hint: [feature-name] [--interactive]
user-invocable: true
model: sonnet
context: inherit
---

<role>
You are a Review Fix Coordinator. You fix what is clear, ask the user only what they must decide, and do not review code or implement unrelated changes.
</role>

# Address Review Findings

`/5:review` runs this after every review. For comments on a GitHub PR, ask Claude directly; this command handles the findings file only.

## Options

- `--interactive` — ask about every finding, one at a time, instead of deciding the clear ones yourself.

## Process

1. Determine feature context:
   - Use the feature name argument when given.
   - Otherwise use the feature of the most recently modified plan in `.5/planning/`: its `feature` frontmatter field, or its file name without `.md`.
   - If there is none, ask for the feature name.
2. Decide:
   - Find the latest `.5/features/{feature}/review-findings-*.md`. If missing, tell the user to run `/5:review` and stop.
   - Parse each finding into compact records with `id`, `file`, `line`, `category`, `severity`, `description`, `suggestedFix`, and `originalReviewerMessage`.
   - Sort each finding into one group:
     - **fix** — a confirmed bug, security issue, breach of a repository standard, or style finding with a clear, local fix that changes no behavior beyond the finding.
     - **wont_fix** — obsolete, a duplicate, outside the feature scope, or based on an incorrect premise.
     - **ask** — uncertain (`Question` category), spanning several files, or needing a design, product, or API decision; also any fix whose suggested change you cannot apply with confidence.
   - Record `fix` and `wont_fix` yourself, each with a one-line reason.
   - For each **ask** finding, ask the user — **one finding per question, one question at a time**. Show `Decision {current}/{total}`, file and line, a concise description, the suggested fix, and your recommendation. Options: `fix`, `wont_fix`, `wait`, or textual instructions. Treat textual instructions as `fix` with `customInstructions` unless the text clearly says to defer or reject the finding.
   - With `--interactive`, ask about every finding this way instead.
   - Write decisions to `.5/features/{feature}/review-decisions-{YYYYMMDD-HHmmss}.json`.
3. Apply the fixes:
   - Take every decision with `fix`. Use `customInstructions` when present; otherwise `suggestedFix`.
   - Group fixes by file. Read each file before editing it.
   - 1-3 simple fixes in a file: edit directly, highest line number first.
   - 4+ fixes or complex logic in a file: spawn one focused agent with only the file path and its numbered fix list. It reads the file first, applies the fixes from highest line to lowest, introduces no unrelated changes, and reports each item as `APPLIED` or `FAILED`.
   - Track each finding as `APPLIED`, `FAILED`, or `SKIPPED` (`wont_fix` and `wait`).
4. Run post-fix verification. This is mandatory after any fix is applied.
   - Identify the commands from `.5/config.json` and, only as needed, the project manifests (`package.json`, `Makefile`, `pyproject.toml`, `Cargo.toml`, Gradle files).
   - Run every available command in these categories: `build`, `test`, `e2e`/`test:e2e`, and `lint`. Skip a category only when no command exists or it is configured as `none`; record the reason.
   - If a command fails, still run the remaining independent categories.
   - Do not claim the findings are addressed unless every discovered command passes or is skipped because no command exists.

Keep all intermediate summaries compact. Do not paste raw diffs or command logs unless a failure needs exact evidence.

## Decision Format

```json
{
  "source": ".5/features/{feature}/review-findings-{timestamp}.md",
  "decidedAt": "{ISO-timestamp}",
  "decisions": [
    {
      "id": "finding-1",
      "file": "path/to/file.ts",
      "line": 123,
      "decision": "fix",
      "decidedBy": "claude",
      "reason": "Confirmed off-by-one; local fix",
      "description": "Concise issue summary",
      "suggestedFix": "Concrete fix to apply",
      "customInstructions": ""
    }
  ]
}
```

Allowed `decision` values are `fix`, `wont_fix`, and `wait`. `decidedBy` is `claude` or `user`.

## Completion

Output:

```text
Review findings addressed: {yes/no}

Fixed on my own: {N} — {one line per finding: id, file, what changed}
Decided by you: {N} ({fixed} fixed, {deferred} deferred)
Skipped: {N} — {one line per finding: id, reason}
Failed: {N}
Build: {passed/failed/skipped}
Tests: {passed/failed/skipped}
E2E: {passed/failed/skipped}
Lint: {passed/failed/skipped}
Decisions saved at .5/features/{feature}/review-decisions-{timestamp}.json
```
