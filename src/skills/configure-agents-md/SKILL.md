---
name: configure-agents-md
description: Writes the workflow rules into AGENTS.md as one marked block, links the repository's own standards, and makes CLAUDE.md include AGENTS.md. Never changes content outside the block. Used during /5:implement CONFIGURE and /5:reconfigure.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
user-invocable: false
---

# Configure AGENTS.md Skill

## Overview

This skill writes the workflow rules into `AGENTS.md` as one block between `<!-- foifi:start` and `<!-- foifi:end -->`. Everything outside that block belongs to the repository. The skill never rewrites, moves, or deletes it, in `AGENTS.md` or in `CLAUDE.md`.

A step executor calls it for the CONFIGURE feature. `/5:reconfigure` calls it in refresh mode. Both modes run the same steps:

- **Full mode (default):** input is the plan at `.5/planning/CONFIGURE.md`.
- **Refresh mode:** the prompt includes "REFRESH MODE" and points at `.5/reconfigure-manifest.json`.

It generates no architecture, testing, concerns, or conventions docs and no codebase index. Agents explore the code themselves.

## 1. Collect Inputs

- **Build and run commands:** from `.5/config.json`, plus other detected scripts worth running. Skip commands that `AGENTS.md` or `CLAUDE.md` already document outside the block.
- **Commit message rule:** the repository's own commit convention when one is documented, such as in `CONTRIBUTING.md`. Then write `Follow the commit convention in {path}.` Otherwise use `git.commitMessage.pattern` from `.5/config.json` and write `Write commit messages as \`{pattern}\`. Take {ticket-id} from the branch name when it matches \`ticket.pattern\`; drop it otherwise.` Without a pattern, remove the `## Commit Messages` section.
- **Repository standards:** the files `.claude/skills/review-style/SKILL.md` step 2 counts as repository standards. Use the list in the CONFIGURE plan or the refresh manifest when it has one. Do not count workflow-generated files.
- **Existing project docs:** `.5/ARCHITECTURE.md`, `.5/TESTING.md`, `.5/CONCERNS.md`, and `.5/CONVENTIONS.md`, when they exist. Link them; never rewrite or delete them.

## 2. Fill the Template

Use `.claude/templates/AGENTS.md` as the block. Keep its marker comments and static sections exactly as written; `review-style` reads the markers to tell workflow rules apart from repository standards.

- `{BUILD_RUN_COMMANDS}` → the build, test, and other commands. Remove the section when there are none left.
- `{COMMIT_MESSAGE_RULE}` → the commit message rule.
- `{REPO_STANDARDS_LINKS}` → one bullet per repository standard, as `- [path](path)`. When there are none, write `- None documented yet. The style skills below set the baseline.`
- `{PROJECT_DOCUMENTATION_LINKS}` → one link per existing `.5/*.md` doc. When there are none, remove the whole `## Project Documentation` section.

## 3. Write AGENTS.md

- **No `AGENTS.md`:** create it with only the block.
- **`AGENTS.md` with a foifi block:** replace the text from the `<!-- foifi:start` line through the `<!-- foifi:end -->` line. Leave every other byte unchanged.
- **`AGENTS.md` without a block:** append a blank line and the block at the end. Leave the existing content unchanged.
- **Legacy file** (its first line starts with `<!-- Generated from the foifi AGENTS.md template`): an earlier version generated the whole file. Keep only what the user wrote: the content under its `## Custom Documentation` heading, unchanged. Write that content, then a blank line, then the block. Drop the rest; the block replaces it.

## 4. Include AGENTS.md from CLAUDE.md (Claude Code only)

Claude Code reads `CLAUDE.md`, and `@AGENTS.md` pulls in the full `AGENTS.md`.

- **No `CLAUDE.md`:** create it with only `@AGENTS.md`.
- **`CLAUDE.md` without an `@AGENTS.md` line:** append a blank line and `@AGENTS.md`. Leave the existing content unchanged.
- **`CLAUDE.md` with an `@AGENTS.md` line:** leave it as it is.

## Output Contract

```
Component A (AGENTS.md): SUCCESS - Wrote the foifi block in AGENTS.md
  - AGENTS.md (block replaced | appended | created, 3 repository standards linked)
  - CLAUDE.md (unchanged | @AGENTS.md appended | created)
```

Or on failure:

```
Component A (AGENTS.md): FAILED - Unable to read the AGENTS.md template
```

## DO NOT

- DO NOT change, move, or delete anything outside the foifi block, in `AGENTS.md` or `CLAUDE.md`.
- DO NOT generate architecture, testing, concerns, or conventions docs, index files, or rebuild scripts.
- DO NOT rewrite or delete existing `.5/*.md` docs.
- DO NOT restate repository standards in the block. Link them.
