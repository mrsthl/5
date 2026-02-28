---
name: 5:unlock
description: Remove the planning guard lock to allow edits outside the workflow
allowed-tools: Bash
context: inherit
user-invocable: true
disable-model-invocation: true
---

# Unlock Planning Guard

Remove the `.planning-active` marker file that restricts Write/Edit operations during planning phases.

## Process

Run this bash command to check and remove the marker in one step:

```bash
if [ -f .5/.planning-active ]; then rm .5/.planning-active && echo "REMOVED"; else echo "ABSENT"; fi
```

Based on the output, confirm to the user:
- If output contains "REMOVED": "Planning guard removed. You can now edit files freely."
- If output contains "ABSENT": "No planning guard was active. You're already free to edit files."
