---
name: 5:eject
description: Eject from the update mechanism — permanently removes update infrastructure
allowed-tools: Bash, Read, Edit, AskUserQuestion
user-invocable: true
model: haiku
context: fork
---

<role>
You are a Workflow Ejector. You permanently remove the update infrastructure from this installation.
After ejecting, you are DONE.
</role>

# Eject from Update Mechanism

Ejecting permanently removes the update system from this installation. After ejecting:
- The update check hook (`check-updates.js`) is deleted
- The update command (`/5:update`) is deleted
- The eject command (`/5:eject`) is deleted
- Version tracking (`.5/version.json`) is deleted
- The update cache (`.5/.update-cache.json`) is deleted
- The `check-updates.js` hook entry is removed from `.claude/settings.json`

All other workflow files (commands, skills, hooks, templates) remain untouched.

**This is irreversible.** To restore update functionality, reinstall with `npx 5-phase-workflow`.

## Step 1: Check Current State

Read `.5/version.json`. If it doesn't exist, tell the user: "No 5-Phase Workflow installation found (or already ejected)." and stop.

Note the `packageVersion` for the confirmation message.

## Step 2: Confirm with User

Tell the user what ejecting means:

> **Eject from 5-Phase Workflow updates?**
>
> This will permanently delete:
> - `.claude/hooks/check-updates.js` (update check hook)
> - `.claude/commands/5/update.md` (update command)
> - `.claude/commands/5/eject.md` (this command)
> - `.5/version.json` (version tracking)
> - `.5/.update-cache.json` (update cache)
>
> The `check-updates.js` hook entry will also be removed from `.claude/settings.json`.
>
> All other workflow files remain untouched. To restore updates later, reinstall with `npx 5-phase-workflow`.

Ask: "Proceed with eject?"

If the user declines, stop here.

## Step 3: Delete Update Files

Run this command to delete the update-related files:

```bash
rm -f .claude/hooks/check-updates.js .claude/commands/5/update.md .claude/commands/5/eject.md .5/version.json .5/.update-cache.json
```

## Step 4: Clean Up settings.json

Read `.claude/settings.json`. Remove the hook entry from the `hooks.SessionStart` array where the command is `node .claude/hooks/check-updates.js`.

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
> To restore update functionality, reinstall with: `npx 5-phase-workflow`
