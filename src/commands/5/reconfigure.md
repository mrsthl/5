---
name: 5:reconfigure
description: Lightweight refresh of the foifi block in AGENTS.md and the generated rules, without full Q&A. Points plan mode at .5/planning/ and removes the legacy .5/index/. Never touches skills or anything outside the foifi block.
allowed-tools: Read, Write, Bash, Glob, Grep, Agent, AskUserQuestion
user-invocable: true
---

<role>
You are a Project Reconfigurer. You refresh the foifi block in AGENTS.md and the workflow-generated rules using existing config.json preferences.
You do NOT modify user preferences (ticket patterns, branch conventions, commit patterns, etc.).
You detect codebase changes, confirm with the user, invoke the configuration refresh skills, then report.
After reporting what was updated, you are DONE.
</role>

# Reconfigure (Lightweight Refresh)

## Overview

Single-command refresh that skips the full Q&A of `/5:configure`. It is also the upgrade path after a major workflow update.

| Scenario | Command |
|----------|---------|
| First-time setup | `/5:configure` |
| Change preferences (ticket pattern, commit pattern, etc.) | `/5:configure` |
| Codebase or standards evolved, refresh the AGENTS.md block and rules | **`/5:reconfigure`** |
| After a major workflow upgrade | **`/5:reconfigure`** |

## ⚠️ CRITICAL SCOPE CONSTRAINT

Your job:
✅ Validate that config.json exists
✅ Re-detect repository standards and rule-relevant file types
✅ Show summary and ask for confirmation
✅ Point Claude Code plan mode at `.5/planning/` when it is not yet
✅ Invoke `configure-agents-md` and `configure-rules` in refresh mode
✅ Remove the legacy `.5/index/` after confirmation
✅ Update version.json timestamps and clean up the reminder flags
✅ Report what was updated

Your job is NOT:
❌ Ask preference questions or modify config.json preferences
❌ Skip confirmation — always show what will be regenerated
❌ Change anything in AGENTS.md or CLAUDE.md outside the foifi block
❌ Create, refresh, or remove any skill — skills belong to the user or to the installer
❌ Modify user-created rules
❌ Rewrite or delete existing `.5/*.md` docs — earlier versions generated them, but a team may maintain them now

## Process

### Step 1: Validate Config

Read `.5/config.json`. If it does not exist, tell the user: "No configuration found. Please run `/5:configure` first to set up your project." and **EXIT IMMEDIATELY**.

### Step 2: Re-detect

- **Repository standards** — same as configure Step 1e2. Note each path for the refresh manifest.
- **AGENTS.md state** — whether it has a foifi block, is a legacy fully generated file (first line starts with `<!-- Generated from the foifi AGENTS.md template`), or has no block yet. Whether `CLAUDE.md` includes `@AGENTS.md`.
- **Rules** (if `rules.generate` is `true`) — on Codex, the `###` subsections of the `File-Scoped Rules` section in the foifi block of `AGENTS.md`; all of them are workflow-generated. On Claude Code, list `.claude/rules/*.md`. A rule is workflow-generated when it contains `<!-- foifi:generated -->`, or, from earlier versions, when it is named `code-style.md`, `testing.md`, `api-patterns.md`, or `dependencies.md` and you confirm it with the user in Step 3. Everything else is user-created.
- For each workflow rule, check that its file types still exist (stale), and whether a missing rule from `configure-rules` step 1 now applies (new).

### Step 3: Confirm with User

Use `AskUserQuestion` to show a summary and get confirmation:

1. **AGENTS.md** — the foifi block will be replaced, appended, or (legacy file) rebuilt with the user's Custom Documentation kept above it. Nothing else changes. `CLAUDE.md` gets `@AGENTS.md` appended when it lacks it.
2. **Legacy files that will be removed** — `.5/index/` when it exists.
3. **Settings** — `plansDirectory` set to `.5/planning` in `.claude/settings.json`, when it is not already (Claude Code only).
4. **Rules** — which workflow rules will be refreshed, created, or removed (multi-select for new and stale ones). For legacy rules without the marker, ask whether foifi may manage them.

Options: "Proceed with refresh" or "Cancel".

### Step 4: Build Refresh Manifest

Write `.5/reconfigure-manifest.json`:

```json
{
  "mode": "refresh",
  "repoStandards": ["paths from Step 2"],
  "rules": {
    "refresh": ["rule files"],
    "create": ["new rule files"],
    "remove": ["stale rule files selected by user"]
  }
}
```

### Step 5: Regenerate

First, point plan mode at `.5/planning/` exactly as `/5:configure` Step 2.5 describes (Claude Code only — skip on Codex).

Then invoke the refresh skills in **refresh mode** via the Agent tool (`subagent_type: "general-purpose"`), one after the other — on Codex both write the foifi block of `AGENTS.md`:

```
Task prompt 1: "Run configure-agents-md skill in REFRESH MODE using `.5/reconfigure-manifest.json`. Refresh the foifi block in AGENTS.md and the CLAUDE.md include; change nothing outside the block."

Task prompt 2: "Run configure-rules skill in REFRESH MODE using `.5/reconfigure-manifest.json`. Refresh, create, and remove only the rules listed in the manifest."
```

Skip task 2 when `rules.generate` is `false`.

### Step 6: Track and Clean Up

Update `.5/version.json`: set `configuredAt` to the current ISO timestamp and `configuredAtCommit` to `git rev-parse --short HEAD`, preserving all other fields. Then:

```bash
rm -f .5/.reconfig-reminder .5/.migration-v*
rm -rf .5/index   # only when the user confirmed it in Step 3
```

### Step 7: Report

- How the AGENTS.md block was written, which repository standards it links, and whether `CLAUDE.md` changed
- Whether `plansDirectory` was set and the legacy `.5/index/` removed
- Rules refreshed, created, and removed
- Suggest running `/clear` to reset context

## Related Documentation
- [configure command](./configure.md) — full Q&A configuration
- [configure-agents-md skill](../../skills/configure-agents-md/SKILL.md)
- [configure-rules skill](../../skills/configure-rules/SKILL.md)
