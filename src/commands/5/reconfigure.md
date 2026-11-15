---
name: 5:reconfigure
description: Refreshes the foifi block in AGENTS.md, the generated rules, and the generated project skills without full Q&A. Analyzes every project skill and rule, proposes optimizations and skill↔rule migrations, and applies only the proposals the user selects. Points plan mode at .5/planning/ and removes the legacy .5/index/.
allowed-tools: Read, Write, Bash, Glob, Grep, Agent, AskUserQuestion
user-invocable: true
---

<role>
You are a Project Reconfigurer. You refresh the foifi block in AGENTS.md and the workflow-generated rules and project skills using existing config.json preferences, and you propose optimizations for every other project skill and rule.
You do NOT modify user preferences (ticket patterns, branch conventions, commit patterns, etc.).
You detect codebase changes, analyze skills and rules, confirm with the user, invoke the configuration refresh skills, then report.
After reporting what was updated, you are DONE.
</role>

# Reconfigure (Lightweight Refresh)

## Overview

Single-command refresh that skips the full Q&A of `/5:configure`. It is also the upgrade path after a major workflow update.

| Scenario | Command |
|----------|---------|
| First-time setup | `/5:configure` |
| Change preferences (ticket pattern, commit pattern, etc.) | `/5:configure` |
| Codebase or standards evolved, refresh the AGENTS.md block, rules, and project skills | **`/5:reconfigure`** |
| Check skills and rules for stale content, duplicates, or the wrong mechanism | **`/5:reconfigure`** |
| After a major workflow upgrade | **`/5:reconfigure`** |

Rules carry how code looks (code patterns); skills carry how to run procedures that take more than one plain command. `/5:reconfigure` moves content to the right mechanism when the user agrees.

## ⚠️ CRITICAL SCOPE CONSTRAINT

Your job:
✅ Validate that config.json exists
✅ Re-detect repository standards, rule candidates, and skill candidates
✅ Analyze every project skill and rule and turn problems into proposals
✅ Show summary and ask for confirmation, one option per proposal
✅ Point Claude Code plan mode at `.5/planning/` when it is not yet
✅ Invoke `configure-agents-md`, `configure-rules`, and `configure-project-skills` in refresh mode
✅ Remove the legacy `.5/index/` after confirmation
✅ Update version.json timestamps and clean up the reminder flags
✅ Report what was updated

Your job is NOT:
❌ Ask preference questions or modify config.json preferences (only `rules.generate` / `skills.generate`, when the refresh leaves rules or skills where there were none)
❌ Skip confirmation — always show what will be regenerated
❌ Change anything in AGENTS.md or CLAUDE.md outside the foifi block
❌ Change a skill or rule without the `<!-- foifi:generated -->` marker unless the user selected that proposal
❌ Touch the workflow's own skills (`configure-*`, `review-style`, the style skills, `5-*`)
❌ Rewrite or delete existing `.5/*.md` docs — earlier versions generated them, but a team may maintain them now

## Process

### Step 1: Validate Config

Read `.5/config.json`. If it does not exist, tell the user: "No configuration found. Please run `/5:configure` first to set up your project." and **EXIT IMMEDIATELY**.

### Step 2: Re-detect and Inventory

- **Repository standards** — same as configure Step 1e2. Note each path for the refresh manifest.
- **AGENTS.md state** — whether it has a foifi block, is a legacy fully generated file (first line starts with `<!-- Generated from the foifi AGENTS.md template`), or has no block yet. Whether `CLAUDE.md` includes `@AGENTS.md`.
- **Skills** — every directory in `.claude/skills/` except the workflow's own (`configure-agents-md`, `configure-rules`, `configure-project-skills`, `review-style`, `fowler-code-smells`, `cognitive-load`, `documentation-style`, `baseline-conventions`, and on Codex every `5-*`).
- **Rules** — on Claude Code, every `.claude/rules/*.md`. On Codex, every `.5/rules/*.md` plus the `File-Scoped Rules` section in the foifi block of `AGENTS.md`.

Classify each skill and rule:

| Class | How to recognize it | What reconfigure may do |
|-------|---------------------|-------------------------|
| foifi-generated | contains `<!-- foifi:generated -->` | refresh, or remove when stale — listed in the summary, no single question |
| legacy foifi | skill named `run-*`, or whose description starts with "Creates or updates a" and ends with "following project conventions" (v2/v3.0 pattern skills); rule named `code-style.md`, `testing.md`, `api-patterns.md`, or `dependencies.md` without the marker; on Codex, a `File-Scoped Rules` section with full-text `###` subsections for path-scoped rules | proposals only |
| user-owned | everything else | proposals only |

### Step 3: Analyze

Spawn one Agent (`subagent_type: "general-purpose"`, on Codex do it inline) with the inventory, the repository standards, and `configure-rules` sections 1-2 and `configure-project-skills` sections 1-2. It reads every listed skill and rule, checks it against the code, and returns proposals:

| Action | When |
|--------|------|
| `migrate-to-rule` | A skill describes how code looks (a pattern, a template, conventions) instead of a procedure to run. |
| `migrate-to-skill` | A rule holds an executable procedure that passes the skill threshold. |
| `stale` | A glob matches no file, or a path, class, or command the file names no longer exists. |
| `outdated` | The file contradicts what the current code does — check it against 2-3 current files it applies to. |
| `duplicate` | It overlaps another rule or skill, the foifi block, or a repository standard; name which one is kept. |
| `contradicts-standard` | It contradicts a repository standard (the standard wins). |
| `trim` | It only restates what an example file shows, or a rule is over 40 lines / a skill over 50. |
| `new` | A pattern or procedure that has no rule or skill yet. Look at the code changed since `configuredAtCommit` in `.5/version.json` (`git diff --stat {commit}..HEAD`) and at candidates as in configure Step 1f. |
| `convert-codex-index` | Codex only: the `File-Scoped Rules` section holds path-scoped rules in full text; move them to `.5/rules/` and write the index. |

Each proposal has `target` (file path, or the new name for `new`), `action`, `class`, and `detail` (one line on what changes). Report nothing for a file that is fine. Do not propose wording or style changes to user-owned files — only the actions above.

For foifi-generated files, `stale` means remove, every other finding means refresh; they go straight into the manifest.

### Step 4: Confirm with User

Use `AskUserQuestion`. First one question with the summary:

1. **AGENTS.md** — the foifi block will be replaced, appended, or (legacy file) rebuilt with the user's Custom Documentation kept above it. Nothing else changes. `CLAUDE.md` gets `@AGENTS.md` appended when it lacks it.
2. **Legacy files that will be removed** — `.5/index/` when it exists.
3. **Settings** — `plansDirectory` set to `.5/planning` in `.claude/settings.json`, when it is not already (Claude Code only).
4. **foifi-generated rules and skills** — which will be refreshed and which removed.

Options: "Proceed with refresh" or "Cancel".

Then, when there are proposals, ask one multi-select question per group of up to 4 proposals (up to 4 questions per call; call again for more), grouped by action. Each option: label = `{action}: {name}`, description = `detail`, plus "— foifi manages this file from now on" for a legacy or user-owned target. Nothing the user leaves unselected changes.

### Step 5: Build Refresh Manifest

Write `.5/reconfigure-manifest.json`:

```json
{
  "mode": "refresh",
  "repoStandards": ["paths from Step 2"],
  "rules": {
    "refresh": ["foifi-generated rule files"],
    "create": [{ "name": "mapper.md", "detail": "**/*Mapper.java; examples: ..." }],
    "remove": ["stale foifi-generated rule files"]
  },
  "skills": {
    "refresh": ["foifi-generated skill names"],
    "create": [{ "name": "codegen", "detail": "npm run openapi && npm run build:types, from package.json" }],
    "remove": ["stale foifi-generated skill names"]
  },
  "proposals": [
    { "target": ".claude/skills/dto/SKILL.md", "action": "migrate-to-rule", "class": "legacy", "detail": "DTO conventions → rule dto.md scoped to **/dto/**" }
  ]
}
```

`proposals` holds only the proposals the user selected. A selected `new` proposal goes into `rules.create` or `skills.create` instead, as `{ "name": ..., "detail": ... }`, where `detail` names the globs and example files, or the commands and the file they come from.

### Step 6: Regenerate

First, point plan mode at `.5/planning/` exactly as `/5:configure` Step 2.5 describes (Claude Code only — skip on Codex).

Then invoke the refresh skills in **refresh mode** via the Agent tool (`subagent_type: "general-purpose"`), one after the other in this order. The rules task runs last: a `migrate-to-skill` proposal changes or deletes a rule in the skills task, and on Codex the rules task rebuilds the `File-Scoped Rules` index from the rule files that are left.

```
Task prompt 1: "Run configure-agents-md skill in REFRESH MODE using `.5/reconfigure-manifest.json`. Refresh the foifi block in AGENTS.md and the CLAUDE.md include; change nothing outside the block."

Task prompt 2: "Run configure-project-skills skill in REFRESH MODE using `.5/reconfigure-manifest.json`. Apply the manifest's skills lists and the proposals that target skills or migrate to skills; change no other file."

Task prompt 3: "Run configure-rules skill in REFRESH MODE using `.5/reconfigure-manifest.json`. Apply the manifest's rules lists and the proposals that target rules, migrate to rules, or convert the Codex index; change no other file."
```

Skip task 2 when the manifest lists no skill work. Skip task 3 when the manifest lists no rule work — on Codex, unless task 2 changed or deleted a rule, because the index must then be rebuilt. A migration writes the target before it deletes the source.

When rules or skills now exist and `rules.generate` or `skills.generate` in `.5/config.json` is `false`, set it to `true`; set it to `false` when none are left.

### Step 7: Track and Clean Up

Update `.5/version.json`: set `configuredAt` to the current ISO timestamp and `configuredAtCommit` to `git rev-parse --short HEAD`, preserving all other fields. Then:

```bash
rm -f .5/.reconfig-reminder .5/.migration-v*
rm -rf .5/index   # only when the user confirmed it in Step 4
```

### Step 8: Report

- How the AGENTS.md block was written, which repository standards it links, and whether `CLAUDE.md` changed
- Whether `plansDirectory` was set and the legacy `.5/index/` removed
- foifi-generated rules and skills refreshed and removed
- Proposals applied, and proposals the user declined (one line each)
- Suggest running `/clear` to reset context

## Related Documentation
- [configure command](./configure.md) — full Q&A configuration
- [configure-agents-md skill](../../skills/configure-agents-md/SKILL.md)
- [configure-rules skill](../../skills/configure-rules/SKILL.md)
- [configure-project-skills skill](../../skills/configure-project-skills/SKILL.md)
