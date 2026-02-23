---
name: 5:reconfigure
description: Lightweight refresh of project documentation and skills without full Q&A. Re-detects codebase changes, regenerates .5/*.md docs, updates CLAUDE.md, and refreshes all skills.
allowed-tools: Read, Write, Bash, Glob, Grep, Task, AskUserQuestion
context: fork
user-invocable: true
---

# Reconfigure (Lightweight Refresh)

## Overview

Single-command refresh that skips the full Q&A of `/5:configure`. Re-detects codebase state, regenerates documentation and skills based on existing `config.json` preferences.

**When to use which:**

| Scenario | Command |
|----------|---------|
| First-time setup | `/5:configure` |
| Change preferences (ticket pattern, review tool, etc.) | `/5:configure` |
| Codebase evolved, refresh docs/skills | **`/5:reconfigure`** |
| Add new skill patterns | `/5:configure` |

## ⚠️ CRITICAL SCOPE CONSTRAINT

**THIS COMMAND REGENERATES DOCS AND SKILLS. IT DOES NOT CHANGE USER PREFERENCES.**

Your job:
✅ Validate that config.json exists
✅ Re-detect codebase patterns and commands (same as configure Steps 1b-1h)
✅ Compare detected state with config.json skill selections
✅ Show summary and ask for confirmation
✅ Invoke configure-project skill in refresh mode
✅ Update version.json with artifacts and timestamps
✅ Clean up .reconfig-reminder flag
✅ Report what was updated

Your job is NOT:
❌ Ask preference questions (ticket pattern, branch convention, review tool, etc.)
❌ Modify config.json preferences (only the `skills` section may be updated if user confirms new patterns)
❌ Skip confirmation — always show what will be regenerated

## Process

### Step 1: Validate Config

Read `.5/config.json`. If it does not exist:
- Tell the user: "No configuration found. Please run `/5:configure` first to set up your project."
- **EXIT IMMEDIATELY**

Read `.5/version.json` for current state (configuredAt, configuredAtCommit).

### Step 2: Re-detect Codebase State

Perform the same detection as configure Steps 1b-1h:

**2a. Detect project type** — same table as configure Step 1b (package.json deps, build files, etc.)

**2b. Detect build/test commands** — same as configure Step 1c

**2c. Detect codebase patterns** — same as configure Step 1g:
- Scan for architectural patterns (Controllers, Services, Components, etc.)
- Use both suffix-based and directory-based globs
- For each pattern: count files, identify location, sample filename

**2d. Detect runnable commands** — same as configure Step 1h:
- Scan package.json scripts, Makefile targets, etc.
- Categorize: Build, Test, Lint, Format, Type Check, etc.

**2e. Scan existing skills** — list ALL skills in `.claude/skills/`:
- Read each skill's SKILL.md frontmatter
- Categorize as workflow-generated (create-*, run-*) or user-created

### Step 3: Compare and Prepare Summary

Use the existing skills in `.claude/skills/` (from Step 2e) as the source of truth — not config.json. Compare what's installed with what's detected in the codebase:

- **Existing `create-*` skills** — extract the pattern name from each (e.g., `create-controller` → `controller`)
- **Existing `run-*` skills** — extract the command name from each (e.g., `run-tests` → `tests`)
- **New patterns**: detected in codebase (Step 2c) but no matching `create-*` skill exists → offer to create
- **Stale patterns**: a `create-*` skill exists but the pattern is no longer detected in the codebase → offer to remove or keep
- **New commands**: detected (Step 2d) but no matching `run-*` skill exists → offer to create
- **Stale commands**: a `run-*` skill exists but the command is no longer detected → offer to remove or keep
- **User-created skills** (not matching `create-*` or `run-*` naming) → always refresh with current conventions, never remove

### Step 4: Confirm with User

Use `AskUserQuestion` to show a summary and get confirmation. Present:

1. **Documentation files that will be rewritten** — list all 7 `.5/*.md` files + CLAUDE.md
2. **Skills that will be refreshed** — list ALL skills found in `.claude/skills/` (both workflow-generated and user-created)
3. **New patterns detected** (if any) — "These patterns were found in your codebase but don't have skills yet: [list]. Create skills for them?"
4. **Stale patterns** (if any) — "These patterns are in your config but weren't found in the codebase: [list]. Remove them?"

Options:
- "Proceed with refresh" — regenerate everything as shown
- "Cancel" — exit without changes

If there are new or stale patterns, use additional `AskUserQuestion` calls with multiSelect to let the user pick which new patterns to add and which stale patterns to remove.

New skills will be created and stale skills removed based on the user's choices.

### Step 5: Regenerate

Invoke the `configure-project` skill in **refresh mode** via the Task tool:

```
Task prompt: "Run configure-project skill in REFRESH MODE.

Refresh ALL existing skills in .claude/skills/:
- Existing create-* skills: [list from Step 2e]
- Existing run-* skills: [list from Step 2e]
- User-created skills: [list from Step 2e]
- New skills to create: [list from user confirmation, if any]
- Skills to remove: [list from user confirmation, if any]

Re-analyze the entire codebase (A1 analysis) and:
1. Rewrite all 7 .5/*.md documentation files
2. Update CLAUDE.md (preserve user-written sections)
3. Refresh ALL skills in .claude/skills/ — read current conventions from codebase and update each skill
4. Create new skills for newly-added patterns
5. Remove skills the user chose to drop"
```

Use `subagent_type: "general-purpose"` for the Task.

### Step 6: Track

After the skill completes, update `.5/version.json`:

1. Read current version.json
2. Set `configuredAt` to current ISO timestamp
3. Set `configuredAtCommit` to current short commit hash (`git rev-parse --short HEAD`)
4. Write back version.json preserving all other fields

### Step 7: Clean Up

Remove the `.5/.reconfig-reminder` flag file if it exists:
```bash
rm -f .5/.reconfig-reminder
```

### Step 8: Report

Show the user a summary:
- List of documentation files updated
- List of skills refreshed
- List of new skills created (if any)
- List of skills removed (if any)
- Timestamp of reconfiguration
- Suggest running `/clear` to reset context

## Related Documentation
- [configure command](./configure.md) — full Q&A configuration
- [configure-project skill](../../skills/configure-project/SKILL.md) — the skill that does the heavy lifting
