---
name: use-index
description: Navigate the .5/index/ codebase index to quickly identify target files and understand project structure. Use before running broad Glob/Grep scans when you need to find where a feature lives, where new code should go, which routes exist, or what the data model looks like.
allowed-tools: Read, Bash
user-invocable: false
---

# Use Index

Use `.5/index/` to orient in the codebase quickly before resorting to broad file scans.

## Step 1: Check existence

```bash
ls .5/index/ 2>/dev/null
```

If the directory is missing or empty, inform the user they can run `/5:reconfigure` to generate it, then fall back to Glob/Grep.

## Step 2: Read the manifest

Read `.5/index/README.md`. It lists every generated index file, its purpose, and the generation timestamp.

## Step 3: Check freshness

Look for the `Generated:` timestamp in README.md.

- **Fresh (≤ 1 day):** proceed with the index.
- **Stale (> 1 day):** run `.5/index/rebuild-index.sh` to rebuild it, then proceed with the refreshed index.

## Step 4: Read only the relevant file(s)

Pick the file that matches the task. Skip unrelated ones.

| Task | File |
|------|------|
| Where does new code go / what modules exist? | `modules.md` |
| API surface, HTTP routes, or handlers | `routes.md` |
| Data models, schemas, or migrations | `models.md` |
| Shared helpers, utilities, or exported functions | `libraries.md` |
| Build, run, test, or dev-workflow commands | `commands.md` |

## Step 5: Interpret entries

Each file has compact entries — path plus a short descriptor (HTTP method, exported name, key field, etc.). Use them to identify target files directly. Do not read the full index file if a handful of entries answer the question.

## Step 6: Fall back gracefully

If a file is too sparse or an area is missing from the index, note the gap and fall back to a targeted Grep/Glob for that area only. Do not re-scan sections already covered by a fresh index entry.
