---
name: 5:eject
description: Eject from the update mechanism — permanently removes update infrastructure
allowed-tools: Bash, Read, Edit, AskUserQuestion
user-invocable: true
context: inherit
---

<role>
You are a Workflow Ejector. You permanently remove the update infrastructure from this installation.
After ejecting, you are DONE.
</role>

# Eject from Update Mechanism

Determine which runtime is installed before making any changes:
- Claude Code install: workflow files live in `.claude/`
- Codex install: workflow files live in `.codex/`

Use runtime-appropriate paths in every step below.

Ejecting permanently removes the update system from this installation. After ejecting:
- The update infrastructure files are deleted
- Version tracking (`.5/version.json`) is deleted
- The update cache (`.5/.update-cache.json`) is deleted
- Claude Code installs also remove the `check-updates.js` hook entry from `.claude/settings.json`

All other workflow files (commands, skills, hooks, templates) remain untouched.

**This is irreversible.** To restore update functionality, reinstall with `npx foifi`.

## Step 1: Check Current State

Read `.5/version.json`. If it doesn't exist, tell the user: "No dev-workflow installation found (or already ejected)." and stop.

Note the `packageVersion` for the confirmation message.

## Step 2: Confirm with User

Tell the user what ejecting means:

> **Eject from dev-workflow updates?**
>
> This will permanently delete:
> - `.5/version.json` (version tracking)
> - `.5/.update-cache.json` (update cache)
>
> For Claude Code installs:
> - `.claude/hooks/check-updates.js` (update check hook)
> - `.claude/commands/5/update.md` (update command)
> - `.claude/commands/5/eject.md` (this command)
> - The `check-updates.js` hook entry in `.claude/settings.json`
>
> For Codex installs:
> - `.codex/skills/5-update/` (update skill)
> - `.codex/skills/5-eject/` (this skill)
> - `.codex/instructions.md` is removed only if it is workflow-managed and no longer needed for remaining installed workflow files
>
> All other workflow files remain untouched. To restore updates later, reinstall with `npx foifi`.

Ask: "Proceed with eject?"

If the user declines, stop here.

## Step 3: Delete Update Files

Run this command to delete the update-related files:

```bash
rm -f .claude/hooks/check-updates.js .claude/commands/5/update.md .claude/commands/5/eject.md .5/version.json .5/.update-cache.json
```

For Codex installs, remove the runtime-appropriate files instead:

```bash
rm -rf .codex/skills/5-update .codex/skills/5-eject
rm -f .5/version.json .5/.update-cache.json
```

## Step 4: Clean Up settings.json

Claude Code installs only: read `.claude/settings.json`. Remove the hook entry from the `hooks.SessionStart` array where the command is `node .claude/hooks/check-updates.js`.

Codex installs do not use `.claude/settings.json` or Claude hooks for updates, so skip this step for Codex.

Specifically, find and remove the object in the `SessionStart` array that looks like:

```json
{
  "matcher": "startup",
  "hooks": [
    {
      "type": "command",
      "command": "node .claude/hooks/check-updates.js",
      "timeout": 10
    }
  ]
}
```

If the `SessionStart` array becomes empty after removal, remove the `SessionStart` key entirely. Write the updated settings back.

## Step 5: Confirm

Tell the user:

> Ejected successfully. Update infrastructure has been removed from this installation (was v{packageVersion}).
>
> To restore update functionality, reinstall with: `npx foifi`
>
> If this was a Codex install, use: `npx foifi --codex`
