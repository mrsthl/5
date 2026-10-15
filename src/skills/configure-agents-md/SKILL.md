---
name: configure-agents-md
description: Writes the project AGENTS.md from the workflow template plus a CLAUDE.md shim, and links the repository's own standards. Used during /5:implement CONFIGURE and /5:reconfigure.
allowed-tools: Read, Write, Bash, Glob, Grep
model: sonnet
user-invocable: false
---

# Configure AGENTS.md Skill

## Overview

This skill writes the provider-agnostic `AGENTS.md` and the Claude Code `CLAUDE.md` shim. A step executor calls it for the CONFIGURE feature. `/5:reconfigure` calls it in refresh mode.

It generates no architecture, testing, concerns, or conventions docs and no codebase index. Agents explore the code themselves when a task needs it. Generated summaries of the code go stale and hold nothing an agent cannot derive on demand.

Note: config.json is written directly by `/5:configure` during the Q&A phase.

---

## Modes

Both modes run the same steps. Only the input source differs.

- **Full mode (default):** used by `/5:configure` → `/5:implement CONFIGURE`. Input is the plan at `.5/planning/CONFIGURE.md`.
- **Refresh mode:** used by `/5:reconfigure`. The prompt includes "REFRESH MODE" and points at `.5/reconfigure-manifest.json`.

---

## A1. Collect Inputs

- **Project overview:** 1-2 sentences from the README or the package manifest.
- **Build and run commands:** from `.5/config.json`, plus other detected scripts worth running.
- **Repository standards:** the files `.claude/skills/review-style/SKILL.md` step 2 counts as repository standards. Use the list in the CONFIGURE plan or the refresh manifest when it has one. Otherwise search for them yourself. Do not count workflow-generated files as repository standards.
- **Existing project docs:** `.5/ARCHITECTURE.md`, `.5/TESTING.md`, `.5/CONCERNS.md`, and `.5/CONVENTIONS.md`, when they exist. Earlier workflow versions generated them. A team may maintain them now, so link them and never rewrite or delete them.

## A2. Fill the Template

Use `.claude/templates/AGENTS.md` as the source template.

Placeholder mapping:
- `{PROJECT_OVERVIEW}` → the project overview.
- `{BUILD_RUN_COMMANDS}` → the build, test, and other detected commands.
- `{REPO_STANDARDS_LINKS}` → one bullet per repository standard, as `- [path](path)`. When there are none, write `- None documented yet. The style skills below set the baseline.`
- `{PROJECT_DOCUMENTATION_LINKS}` → one link per existing `.5/*.md` doc. When there are none, remove the whole `## Project Documentation` section.
- `{CUSTOM_DOCUMENTATION}` → preserved user-authored sections under `## Custom Documentation`. Remove the placeholder when there is no custom content.

Preserve the static template sections exactly as written, including the generated-file comment at the top. `review-style` reads that comment to tell the workflow rules apart from the repository's own standards.

## A3. Migrate and Preserve Existing Content

**Run this step BEFORE writing the CLAUDE.md shim** to avoid data loss.

**If `AGENTS.md` already exists:**
- Read its content.
- Identify user-written custom sections, meaning sections that do not match the template structure.
- Preserve them under "Custom Documentation" in the new AGENTS.md.
- Do not carry over sections that earlier workflow versions generated, such as `## Codebase Index` or `## Coding Guidelines`. The template replaces them.

**If `CLAUDE.md` already exists with real content (not just `@AGENTS.md`):**
- Read its content.
- Migrate the user-written sections into the new AGENTS.md under "Custom Documentation".

## A4. Create the CLAUDE.md Shim (Claude Code only)

After A3, create or overwrite `CLAUDE.md` with only:

```
@AGENTS.md
```

This line uses Claude Code's include syntax to pull in the full AGENTS.md. Claude Code users get the instructions automatically, and other AI tools such as Codex read AGENTS.md directly.

---

## Output Contract

```
Component A (AGENTS.md): SUCCESS - Wrote AGENTS.md and CLAUDE.md shim
  - AGENTS.md (3 repository standards linked, 1 custom section preserved)
  - CLAUDE.md (shim: @AGENTS.md)
```

Or on failure:

```
Component A (AGENTS.md): FAILED - Unable to read the AGENTS.md template
```

## DO NOT

- DO NOT overwrite user-written AGENTS.md sections.
- DO NOT generate architecture, testing, concerns, or conventions docs, index files, or rebuild scripts.
- DO NOT rewrite or delete existing `.5/*.md` docs.
- DO NOT restate repository standards in AGENTS.md. Link them.
