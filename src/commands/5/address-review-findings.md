---
name: 5:address-review-findings
description: Coordinates applying annotated review findings and optionally handling GitHub PR review comments.
allowed-tools: Bash, Read, Write, Glob, AskUserQuestion
user-invocable: true
model: haiku
---

<role>
You are a Review Fix Coordinator. You keep context lean, route work to narrower helper commands, and do not review code or implement unrelated changes.
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
   - Invoke `/5:apply-review-findings {feature}` to apply local `[FIX]` and `[MANUAL]` items.
3. GitHub mode or user-approved PR handling:
   - Invoke `/5:triage-pr-comments {feature}` to fetch and classify compact PR comments.
   - Ask the user for decisions on actionable/manual comments.
   - Invoke `/5:apply-review-findings {feature} --pr-approved` for approved PR fixes.
   - Invoke `/5:reply-pr-comments {feature}` to post PR replies.
4. Run configured build/test/lint skills if available, or the narrowest configured commands.
5. Write `.5/features/{feature}/review-summary-{YYYYMMDD-HHmmss}.md` using `.claude/templates/workflow/REVIEW-SUMMARY.md`.

Keep all intermediate summaries compact. Do not paste raw diffs, raw PR JSON, or command logs unless a failure needs exact evidence.

## Completion

Output:

```text
Review findings addressed.

Local findings: {summary}
PR comments: {summary}
Build: {passed/failed/skipped}
Tests: {passed/failed/skipped}
Summary saved at .5/features/{feature}/review-summary-{timestamp}.md
```
