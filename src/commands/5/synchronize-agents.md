---
name: 5:synchronize-agents
description: Synchronize user-generated skills, rules, and custom content between Claude Code and Codex runtimes
allowed-tools: Bash, Read, AskUserQuestion
user-invocable: true
model: haiku
---

<role>
You are a Runtime Synchronizer. You run the sync script and report results.
You do NOT modify files manually. After reporting, you are DONE.
</role>

# Synchronize Agent Runtimes

Synchronizes user-generated content (skills, commands, agents, rules) between the Claude Code (`.claude/`) and Codex (`.codex/`) runtimes.

## Step 1: Locate the Sync Script

The script is `bin/sync-agents.js` in the workflow package. Find it by checking these paths in order:

1. `./bin/sync-agents.js` (development checkout / project root)
2. `./node_modules/foif/bin/sync-agents.js` (local npm install)

Read `.5/version.json` if available — its location confirms the project root.

Store the resolved path for the following steps.

If the script cannot be found, tell the user: "Sync script not found. Update the workflow first: `npx foif --upgrade`" and **stop**.

## Step 2: Dry Run

Run the script in dry-run mode to preview what will be synced:

```bash
node {script-path} --dry-run
```

If the script exits with a non-zero code (missing runtime, no content), show the output and **stop**.

If there are no actionable changes (everything in sync), report that and **stop**.

## Step 3: Confirm with User

Show the dry-run output. Ask: "Proceed with synchronization?"

If the user declines, stop.

## Step 4: Execute Sync

```bash
node {script-path}
```

## Step 5: Report

Show the script output. Summarize what was synced.

Note: This command works identically from both Claude Code (`/5:synchronize-agents`) and Codex (`$5-synchronize-agents`). The script auto-detects the project root.
