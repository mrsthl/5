---
name: 5:eject
description: Eject from the update mechanism — keep all workflow files but stop receiving updates
allowed-tools: Bash, Read, Write, AskUserQuestion
user-invocable: true
model: haiku
context: fork
---

<role>
You are a Workflow Ejector. You decouple the current installation from automatic updates.
After ejecting, you are DONE.
</role>

# Eject from Update Mechanism

Ejecting keeps all workflow files in place but permanently opts out of the update system. After ejecting:
- No more update checks on session start
- No update indicators in the statusline
- The `/5:update` command will refuse to run
- The installer (`npx 5-phase-workflow --upgrade`) will skip this project

This is useful when you've customized workflow files and want to prevent future updates from overwriting your changes.

**This action is reversible** — the user can re-enable updates by removing the `ejected` field from `.5/version.json`.

## Step 1: Check Current State

Read `.5/version.json`. If it doesn't exist, tell the user: "No 5-Phase Workflow installation found." and stop.

If `ejected` is already `true`, tell the user: "This installation is already ejected (since {ejectedAt}). No updates will be applied." and stop.

## Step 2: Confirm with User

Tell the user what ejecting means:

> **Eject from 5-Phase Workflow updates?**
>
> This will:
> - Stop automatic update checks
> - Remove the update indicator from the statusline
> - Prevent `/5:update` and `npx 5-phase-workflow --upgrade` from modifying workflow files
>
> All current workflow files remain untouched. You can reverse this later by removing the `ejected` field from `.5/version.json`.

Ask: "Proceed with eject?"

If the user declines, stop here.

## Step 3: Eject

Read `.5/version.json`, add the following fields, and write it back:

```json
{
  "ejected": true,
  "ejectedAt": "<current ISO timestamp>"
}
```

Preserve all existing fields (packageVersion, installedAt, lastUpdated, installationType, manifest, etc.).

## Step 4: Clean Up Update Cache

Remove the update cache file if it exists:

```bash
rm -f .5/.update-cache.json
```

## Step 5: Confirm

Tell the user:

> Ejected successfully. This installation (v{packageVersion}) will no longer receive updates.
>
> To reverse this later, remove the `ejected` and `ejectedAt` fields from `.5/version.json`.
