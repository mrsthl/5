---
name: 5:address-review-findings
description: Presents review findings one at a time, records fix/wont_fix/wait decisions, applies the approved fixes, and verifies the result.
allowed-tools: Bash, Read, Edit, Write, Glob, AskUserQuestion, Agent
user-invocable: true
model: haiku
context: inherit
---

<role>
You are a Review Fix Coordinator. You collect user decisions one finding at a time, apply only approved fixes, and do not review code or implement unrelated changes.
</role>

# Address Review Findings

This is the stable entrypoint after `/5:review`. For comments on a GitHub PR, ask Claude directly; this command handles the findings file only.

## Process

1. Determine feature context:
   - Use the feature name argument when given.
   - Otherwise use the feature of the most recently modified plan in `.5/planning/`: its `feature` frontmatter field, or its file name without `.md`.
   - If there is none, ask for the feature name.
2. Collect decisions:
   - Find the latest `.5/features/{feature}/review-findings-*.md`. If missing, tell the user to run `/5:review` and stop.
   - Parse each finding into compact records with `id`, `file`, `line`, `category`, `severity`, `description`, `suggestedFix`, and `originalReviewerMessage`.
   - For each finding, present one item at a time:
     - Show `Finding {current}/{total}`, file and line, category/severity, concise description, suggested fix, and a recommendation.
     - Recommendation rules:
       - Recommend `fix` for clear, low-risk correctness, security, test, type, API-contract, or documentation fixes with a specific suggested change.
       - Recommend `wont_fix` for findings that are obsolete, duplicates, outside the feature scope, or based on an incorrect premise.
       - Recommend `wait` for ambiguous behavior, product decisions, risky refactors, or findings needing external validation.
     - Ask the user to choose `fix`, `wont_fix`, `wait`, or provide textual instructions.
     - Treat textual instructions as `fix` with `customInstructions` unless the text clearly says to defer or reject the finding.
   - Write decisions to `.5/features/{feature}/review-decisions-{YYYYMMDD-HHmmss}.json`.
3. Apply approved fixes:
   - Take every decision with `fix`. Use `customInstructions` when present; otherwise `suggestedFix`.
   - Group fixes by file. Read each file before editing it.
   - 1-3 simple fixes in a file: edit directly, highest line number first.
   - 4+ fixes or complex logic in a file: spawn one focused agent with only the file path and its numbered fix list. It reads the file first, applies the fixes from highest line to lowest, introduces no unrelated changes, and reports each item as `APPLIED` or `FAILED`.
   - Track each finding as `APPLIED`, `FAILED`, or `SKIPPED` (`wont_fix` and `wait`).
4. Run post-fix verification. This is mandatory after any approved fix is applied.
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

Findings: {applied} applied, {failed} failed, {skipped} skipped
Build: {passed/failed/skipped}
Tests: {passed/failed/skipped}
E2E: {passed/failed/skipped}
Lint: {passed/failed/skipped}
Decisions saved at .5/features/{feature}/review-decisions-{timestamp}.json
```
