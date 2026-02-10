---
name: 5:update
description: Update the 5-Phase Workflow to the latest version
allowed-tools: Bash
context: inherit
user-invocable: true
---

# Update 5-Phase Workflow

Run the upgrade command to update to the latest version:

```bash
npx 5-phase-workflow --upgrade
```

After the upgrade completes, confirm the new version was installed by checking `.5/version.json`.
