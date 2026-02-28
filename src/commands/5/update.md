---
name: 5:update
description: Update the 5-Phase Workflow to the latest version
allowed-tools: Bash, Read, AskUserQuestion
context: inherit
user-invocable: true
disable-model-invocation: true
---

# Update 5-Phase Workflow

## Step 1: Check Current Version

Read `.5/version.json` and note the current `installedVersion`.

## Step 2: Run Upgrade

```bash
npx 5-phase-workflow@latest --upgrade
```

## Step 3: Confirm Upgrade

Read `.5/version.json` again. Compare the new `installedVersion` to the previous one.

- If the version **did not change**: tell the user they're already on the latest version. Stop here.
- If the version **changed**: continue to Step 4.

## Step 4: Show What Changed

Run `git status` to show the files modified by the upgrade. Summarize the changes for the user (e.g., "Updated 12 files in `.claude/commands/5/`, `.claude/skills/`, `.claude/hooks/`").

## Step 5: Ask to Commit

Ask the user: "Would you like to commit the upgraded workflow files?"

Options:
1. **Yes** - commit the changes
2. **No** - leave changes uncommitted

If the user chooses **No**, stop here.

## Step 6: Commit

Read `.5/config.json` if it exists and extract `git.commitMessage.pattern` (default: `{ticket-id} {short-description}`).

Build the commit message by applying the pattern:
- Replace `{ticket-id}` with an empty string (no ticket for upgrades) and trim any leading/trailing whitespace
- Replace `{short-description}` with `update 5-Phase Workflow to {new-version}`
- If the pattern is the conventional format (`feat({ticket-id}): {short-description}`), use: `chore: update 5-Phase Workflow to {new-version}`
- If no config or no pattern, use: `update 5-Phase Workflow to {new-version}`

Stage **only** the workflow-managed files shown in `git status` (inside `.claude/commands/5/`, `.claude/skills/`, `.claude/hooks/`, `.claude/templates/`, `.claude/settings.json`, and `.5/version.json`). Never use `git add .` or `git add -A`.

Create the commit. Report success to the user.
