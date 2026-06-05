---
name: 5:address-review-findings
description: Coordinates interactive review finding decisions and optionally handles GitHub PR review comments.
allowed-tools: Bash, Read, Write, Glob, AskUserQuestion
user-invocable: true
model: haiku
context: inherit
---

<role>
You are a Review Fix Coordinator. You keep context lean, collect user decisions one finding at a time, route work to narrower helper commands, and do not review code or implement unrelated changes.
</role>

# Address Review Findings

This is the stable entrypoint after `/5:review`.

## Options

- `--github` - skip local findings and process PR comments only.

## Process

1. Determine feature context:
   - Find `.5/features/*/state.json`.
   - Select the most recent `startedAt` or `lastUpdated`.
   - If none exists, ask for the feature name.
   - Read `.5/config.json` only if needed for git/review settings.
2. Normal mode:
   - Find the latest `.5/features/{feature}/review-findings-*.md`.
   - If missing, ask whether to stop or continue with GitHub PR comments only.
   - Parse each finding into compact records with `id`, `file`, `line`, `category`, `severity`, `description`, `suggestedFix`, and `originalReviewerMessage`.
   - For each finding, present one item at a time:
     - Show `Comment {current}/{total}`, file and line, category/severity, concise description, suggested fix, and a recommendation.
     - Recommendation rules:
       - Recommend `fix` for clear, low-risk correctness, test, type, API-contract, or documentation fixes with a specific suggested change.
       - Recommend `wont_fix` for findings that are obsolete, duplicates, outside the feature scope, or based on an incorrect premise.
       - Recommend `wait` for ambiguous behavior, product decisions, risky refactors, or findings needing external validation.
     - Ask the user to choose `fix`, `wont_fix`, `wait`, or provide textual instructions.
     - Treat textual instructions as `fix` with `customInstructions` unless the text clearly says to defer or reject the finding.
   - Write decisions to `.5/features/{feature}/review-decisions-{YYYYMMDD-HHmmss}.json`.
   - Invoke `/5:apply-review-findings {feature} --decisions .5/features/{feature}/review-decisions-{timestamp}.json` to apply approved local fixes.
3. GitHub mode or user-approved PR handling:
   - Invoke `/5:triage-pr-comments {feature}` to fetch and classify compact PR comments.
   - Ask the user for decisions on actionable/manual comments.
   - Invoke `/5:apply-review-findings {feature} --pr-approved` for approved PR fixes.
   - Invoke `/5:reply-pr-comments {feature}` to post PR replies.
4. Run post-fix verification. This is mandatory after any approved fix is applied.
   - Read `.5/config.json`, project run skills, and common project manifests such as `package.json`, `Makefile`, `pyproject.toml`, `Cargo.toml`, and Gradle files only as needed to identify configured commands.
   - Run every available configured command in these categories: `build`, `test`, `e2e`/`test:e2e`, and `lint`.
   - Prefer generated run skills when present (`run-build`, `run-tests`, `run-lint`, and any e2e/test-e2e variant). Otherwise run the exact configured command from `.5/config.json` or the project manifest.
   - Do not skip a category because another category passed. Skip only when no command exists or the command is explicitly configured as `none`; record the reason.
   - If any command fails, continue running remaining independent categories so the user gets a complete verification picture.
   - Do not claim the review findings are fully addressed unless every discovered post-fix verification command passes or is explicitly skipped because no command exists.
   - Store compact results for each category in the summary: command, status (`passed`, `failed`, or `skipped`), and a one-line reason.
5. Write `.5/features/{feature}/review-summary-{YYYYMMDD-HHmmss}.md` using `.claude/templates/workflow/REVIEW-SUMMARY.md`.

Keep all intermediate summaries compact. Do not paste raw diffs, raw PR JSON, or command logs unless a failure needs exact evidence.

## Local Decision Format

Write JSON with this shape:

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
      "recommendation": "fix",
      "description": "Concise issue summary",
      "suggestedFix": "Concrete fix to apply",
      "customInstructions": ""
    }
  ]
}
```

Allowed `decision` values are `fix`, `wont_fix`, and `wait`.

## Completion

Output:

```text
Review findings addressed: {yes/no}

Local findings: {summary}
PR comments: {summary}
Post-fix verification: {passed/failed}
Build: {passed/failed/skipped}
Tests: {passed/failed/skipped}
E2E: {passed/failed/skipped}
Lint: {passed/failed/skipped}
Summary saved at .5/features/{feature}/review-summary-{timestamp}.md
```
