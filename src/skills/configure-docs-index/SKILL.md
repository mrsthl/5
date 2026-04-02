---
name: configure-docs-index
description: Analyzes the codebase, creates project documentation, generates a rebuildable codebase index, and updates CLAUDE.md. Used during /5:implement-feature CONFIGURE.
allowed-tools: Read, Write, Bash, Glob, Grep
model: sonnet
context: fork
user-invocable: false
---

# Configure Docs And Index Skill

## Overview

This skill handles the documentation and indexing work during Phase 3 (implement-feature) for the CONFIGURE feature. It is called by step-executor to create the project docs, codebase index, and `CLAUDE.md`.

It handles one task:

- **Analyze Codebase and Create/Update Documentation + Index** - Maps codebase, writes `.5/*.md`, generates `.5/index/*`, and updates `CLAUDE.md`

Note: config.json is written directly by `/5:configure` during the Q&A phase.

---

## Modes

This skill supports two modes. The analysis (A1), template filling (A2-A3), index generation (A3.5), and CLAUDE.md update (A4-A5) logic is the same in both modes — only the **input source** changes.

### Full Mode (default)

Used by `/5:configure` → `/5:implement-feature CONFIGURE` flow.

- **Input:** Pattern/command selections from feature spec (`.5/features/CONFIGURE/feature.md`)
- **Behavior:** Creates documentation, index files, and `CLAUDE.md` from scratch based on feature spec requirements

### Refresh Mode

Used by `/5:reconfigure` for lightweight refresh.

- **Input:** The Task prompt tells it to refresh documentation and the codebase index
- **Behavior:** Re-analyzes codebase and overwrites docs, index files, and `CLAUDE.md`
- **Trigger:** Task prompt includes "REFRESH MODE"

In both modes, the analysis and generation logic is identical.

---

## A. Analyze Codebase and Create/Update CLAUDE.md

**Process:**

### A1. Codebase Analysis

Perform focused analysis to gather data for documentation templates. Only capture information that **cannot be derived** by reading project files directly — skip version numbers, dependency lists, directory layouts, linter configs, and other facts that Claude Code can look up on demand.

**Architecture Analysis** (for ARCHITECTURE.md):
- Identify architectural pattern (MVC, layered, modular, microservices) from directory structure
- Map layers by directory structure (controllers/, services/, models/, routes/, etc.)
- Trace data flow patterns (read 2-3 example files from different layers)
- Identify key abstractions (interfaces, base classes, common patterns)
- Identify non-obvious conventions: implicit rules not enforced by tooling (e.g., "all services extend BaseService", "barrel exports required per module"). Skip anything in .eslintrc, .prettierrc, tsconfig, etc.
- Determine where new code should go (new features, tests, utilities)

**Testing Analysis** (for TESTING.md):
- Determine test organization (co-located vs separate `test/` or `spec/`)
- Identify mocking framework and project-specific mocking conventions
- Find fixture/factory patterns
- Note gotchas: setup/teardown quirks, env requirements, flaky areas

**Concerns Analysis** (for CONCERNS.md — conditional):
- Grep for TODO/FIXME/HACK/XXX/DEPRECATED comments across all code
- Check for common security issues (SQL injection patterns, XSS vulnerabilities)
- Identify non-obvious integration details: auth flows, required env vars not documented elsewhere, webhook contracts, gotchas with external services
- Look for performance bottlenecks or scaling limits mentioned in comments/docs

### A2. Fill Templates

For each template in `.claude/templates/`:

1. Read template content with Read tool
2. Replace placeholders with analyzed data from A1
3. **Omit sections entirely if no data was found** — do not write "Not detected" or "None found"
4. For CONCERNS.md: if ALL sections would be empty, **do not create the file at all**

**Placeholder mapping examples**:

ARCHITECTURE.md:
- `{Pattern name}` → "Layered Architecture" or "MVC" or "Modular Monolith"
- `{Layer}` → "Controllers", "Services", "Repositories"
- `{path}` → "src/controllers/", "src/services/"

TESTING.md:
- Describe actual patterns observed, not framework names/versions (those are in config files)

CONCERNS.md:
- `{file paths}` → Actual file paths from grep results

### A3. Write Documentation Files

Write filled templates to `.5/` folder:

1. Ensure `.5/` directory exists: `mkdir -p .5`
2. Write filled templates:
   - `.5/ARCHITECTURE.md` — always created
   - `.5/TESTING.md` — always created
   - `.5/CONCERNS.md` — **only if concerns were found** (skip if all sections empty)

### A3.5. Generate Codebase Index Script and Index Files

Generate a repository-local codebase index that stays generic and works for any language or framework detected in the project.

**Requirements:**
- Create `.5/index/` if it does not exist
- Generate a script that rebuilds the index at `.5/index/rebuild-index.sh`
- Make the script self-contained and dependency-light:
  - Prefer portable shell plus standard tools already expected in a dev environment
  - If the project clearly has a better built-in runtime already available (for example Node.js or Python), it is acceptable to generate a small script in that runtime instead, but keep it local to the repo and avoid adding new dependencies
- The script must inspect the current codebase and write multiple focused Markdown index files into `.5/index/`
- Include `.5/index/README.md` as a manifest describing what each generated index file contains and how to rebuild the index
- Group content by concern and adapt to the actual project. Each file should be compact, easy to scan, and optimized for AI/context loading rather than prose documentation.
- Each generated index file should follow this style:
  - Short title and 1-line purpose statement
  - Bulleted or table-like entries only
  - One entry per route/component/module/model/command as applicable
  - Each entry should include the path and a short descriptor
  - Prefer signatures, exported names, HTTP methods, key fields, and relationships over long explanations
  - Keep entries factual and compact; avoid narrative paragraphs
- Suggested file shapes:
  - `commands.md` — runnable commands, entrypoints, scripts, key developer workflows
  - `routes.md` — routes, handlers, API endpoints, HTTP methods, notable middleware
  - `modules.md` — modules/packages/components/services and what they own
  - `models.md` — schemas, entities, tables, migrations, key relationships
  - `libraries.md` — shared utilities, helpers, exported functions/classes
- Suggested categories to create when applicable:
  - Entrypoints / runnable commands
  - Routes / handlers / API surface
  - Components / modules / packages
  - Data models / schemas / migrations
  - Libraries / utilities / shared code
- Skip categories that do not apply. Do not generate empty placeholder files.
- The script should overwrite previously generated index files on each run so rebuild is idempotent.

### A4. Create CLAUDE.md

Generate CLAUDE.md:

CLAUDE.md structure:
- **Project Overview:** 1-2 sentences from README/package.json
- **Build & Run Commands:** Build, test, and other detected commands
- **Workflow Rules:** Include this section verbatim:
  ```
  ## Workflow Rules
  When running `/5:` workflow commands, follow the command instructions exactly as written.
  Do not skip steps, combine phases, or proceed to actions not specified in the current command.
  Each phase produces a specific artifact — do not create artifacts belonging to other phases.
  ```
- **Coding Guidelines:** The 6 mandatory principles (types, concise docs, short files, extract methods, SRP/DRY, maintainable/modular)
- **Project Documentation:** Links to whichever `.5/` files were created (only list files that exist)
- **Codebase Index:** Add a section linking `.5/index/README.md`, the generated index files, and the rebuild script
- **Index Freshness Rule:** State clearly that if the index files are more than one day old, Claude should regenerate them by running `.5/index/rebuild-index.sh` before relying on them

### A5. Preserve Existing Content

If CLAUDE.md already exists:
- Read current content
- Identify user-written custom sections (not matching template structure)
- Preserve under "Custom Documentation" section in new CLAUDE.md
- Ensure 6 mandatory coding guidelines are retained

---

## Output Contract

Returns structured results for each component:

```
Component A (Documentation + Index): SUCCESS - Created documentation files, codebase index, and CLAUDE.md
  - .5/ARCHITECTURE.md (Pattern: Layered, 4 layers identified)
  - .5/TESTING.md (mocking patterns, gotchas documented)
  - .5/CONCERNS.md (3 TODO items, 1 security note) [or "skipped — no concerns found"]
  - .5/index/rebuild-index.sh (generated index rebuild script)
  - .5/index/*.md (focused codebase index files)
  - CLAUDE.md (updated with references)
```

Or on failure:

```
Component A (Documentation + Index): FAILED - Unable to read template files
```

## DO NOT

- DO NOT overwrite existing user-written CLAUDE.md sections
- DO NOT include `steps` in config.json
- DO NOT hardcode conventions - always derive from actual project analysis
- DO NOT generate empty or placeholder index files
