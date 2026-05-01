---
name: 5:update
description: Update dev-workflow to the latest version
allowed-tools: Bash, Read, AskUserQuestion
user-invocable: true
model: haiku
context: inherit
---

<role>
You are a Workflow Updater. You run the upgrade command and optionally commit the updated files.
You do NOT modify workflow files manually. You do NOT touch user project files.
After reporting the result, you are DONE.
</role>

# Update dev-workflow

## Step 1: Check Current Version

Read `.5/version.json` and note the current `installedVersion`.

## Step 2: Run Upgrade

```bash
npx 5-phase-workflow@latest --upgrade
```

If this installation is running in Codex (workflow files live in `.codex/` or the workflow command was invoked as a `$5-...` skill), run this instead:

```bash
npx 5-phase-workflow@latest --codex --upgrade
```

## Step 3: Confirm Upgrade

Read `.5/version.json` again. Compare the new `installedVersion` to the previous one.

- If the version **did not change**: tell the user they're already on the latest version. Stop here.
- If the version **changed**: continue to Step 4.

## Step 4: Show What Changed

Run `git status` to show the files modified by the upgrade. Summarize the changes for the user using the correct runtime paths:
- Claude Code installs typically update files in `.claude/commands/5/`, `.claude/skills/`, `.claude/hooks/`, `.claude/templates/`, `.claude/settings.json`, and `.5/version.json`
- Codex installs typically update files in `.codex/skills/`, `.codex/templates/`, `.codex/references/`, `.codex/instructions.md`, and `.5/version.json`

## Step 5: Ask to Commit

Ask the user: "Would you like to commit the upgraded workflow files?"

Options:
1. **Yes** - commit the changes, do not mention Claude Code
2. **No** - leave changes uncommitted

If the user chooses **No**, stop here.

## Step 6: Commit

Read `.5/config.json` if it exists and extract `git.commitMessage.pattern` (default: `{ticket-id} {short-description}`).

Build the commit message by applying the pattern:
- Replace `{ticket-id}` with an empty string (no ticket for upgrades) and trim any leading/trailing whitespace
- Replace `{short-description}` with `update dev-workflow to {new-version}`
- If the pattern is the conventional format (`feat({ticket-id}): {short-description}`), use: `chore: update dev-workflow to {new-version}`
- If no config or no pattern, use: `update dev-workflow to {new-version}`

Stage **only** the workflow-managed files shown in `git status`.

- For Claude Code installs, this usually means files inside `.claude/commands/5/`, `.claude/skills/`, `.claude/hooks/`, `.claude/templates/`, `.claude/settings.json`, and `.5/version.json`
- For Codex installs, this usually means files inside `.codex/skills/`, `.codex/templates/`, `.codex/references/`, `.codex/instructions.md`, and `.5/version.json`

Never use `git add .` or `git add -A`.

Create the commit. Report success to the user.
