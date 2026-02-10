---
name: 5:unlock
description: Remove the planning guard lock to allow edits outside the workflow
allowed-tools: Bash
context: inherit
user-invocable: true
---

# Unlock Planning Guard

Remove the `.planning-active` marker file that restricts Write/Edit operations during planning phases.

## Process

1. Check if `.claude/.5/.planning-active` exists
2. If it exists, remove it:

```bash
rm -f .claude/.5/.planning-active
```

3. Confirm to the user:
   - If the file existed: "Planning guard removed. You can now edit files freely."
   - If the file did not exist: "No planning guard was active. You're already free to edit files."
