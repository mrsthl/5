---
name: configure-project
description: Analyzes codebase for CLAUDE.md and generates project-specific skills. Used during /5:implement-feature CONFIGURE.
allowed-tools: Read, Write, Bash, Glob, Grep
model: sonnet
context: fork
user-invocable: false
---

# Configure Project Skill

## Overview

This skill does the heavy lifting during Phase 3 (implement-feature) for the CONFIGURE feature. It is called by step-executor to create the actual configuration files.

It handles two distinct tasks, invoked with different parameters per component:

- **A. Analyze Codebase and Create/Update CLAUDE.md** - Maps codebase and documents conventions
- **B. Generate Project-Specific Skills** - Creates SKILL.md files for common project patterns

Note: config.json is written directly by `/5:configure` during the Q&A phase.

---

## Modes

This skill supports two modes. The analysis (A1), template filling (A2-A3), CLAUDE.md update (A4-A5), and skill generation (B) logic is the same in both modes — only the **input source** changes.

### Full Mode (default)

Used by `/5:configure` → `/5:implement-feature CONFIGURE` flow.

- **Input:** Pattern/command selections from feature spec (`.5/features/CONFIGURE/feature.md`)
- **Behavior:** Creates everything from scratch based on feature spec requirements

### Refresh Mode

Used by `/5:reconfigure` for lightweight refresh.

- **Input:** The Task prompt lists which skills to refresh, create, and remove (determined by `/5:reconfigure` after scanning `.claude/skills/` and comparing with detected codebase patterns)
- **Behavior:** Re-analyzes codebase, overwrites docs and refreshes/creates/removes skills as specified
- **Trigger:** Task prompt includes "REFRESH MODE"

In both modes, the analysis and generation logic is identical — only where the skill list comes from differs.

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

### A5. Preserve Existing Content

If CLAUDE.md already exists:
- Read current content
- Identify user-written custom sections (not matching template structure)
- Preserve under "Custom Documentation" section in new CLAUDE.md
- Ensure 6 mandatory coding guidelines are retained

---

## B. Generate Project-Specific Skills

### Using skill-creator plugin

If `tools.skillCreator.available` is `true` in `.5/config.json`, use the skill-creator plugin's tools (e.g., `create-skill`, `scaffold-skill`) to generate each SKILL.md instead of the template-based approach below. Pass the extracted patterns, conventions, and example file paths as context to the skill-creator tool so it can produce structured, high-quality skill files.

If skill-creator is not available, use the existing template-based generation below — no degradation in workflow behavior.

**Reads:** Pattern selections from feature spec (`.5/CONFIGURE/feature.md`)

**Creates:** SKILL.md files in `.claude/skills/{name}/SKILL.md`

### Pattern-Based Skill Generation

Skills are determined by what patterns exist in the codebase (detected during `/5:configure`) and what the user selected—NOT by project type.

For EACH pattern selected by the user in the feature spec:

1. **Find examples** - Read 2-3 files from the pattern's location
2. **Extract conventions:**
   - File naming (PascalCase, kebab-case, suffix patterns)
   - Directory structure (flat, nested, co-located tests)
   - Import patterns (absolute, relative, aliases)
   - Export patterns (default, named, barrel files)
   - Common boilerplate (decorators, annotations, base classes)
3. **Generate SKILL.md** with:
   - Detected conventions as instructions
   - Template derived from actual code
   - Checklist based on common elements found

### Skill Template Structure

For each skill, create `.claude/skills/create-{pattern}/SKILL.md`:

```yaml
---
name: create-{pattern}
description: Creates a {Pattern} following project conventions at {location}.
allowed-tools: Read, Write, Glob, Grep
model: haiku
context: fork
user-invocable: true
---
```

```markdown
# Create {Pattern}

## What This Skill Creates
A {pattern} following this project's conventions.

## Detected Conventions
- **Location:** {detected-location}
- **Naming:** {detected-naming-pattern}
- **Structure:** {detected-structure}
- **Imports:** {detected-import-pattern}

## Template
Based on {example-file}, new {patterns} should follow:

\`\`\`{language}
{template-derived-from-analysis}
\`\`\`

## Checklist
- [ ] File created at correct location
- [ ] Naming convention followed
- [ ] Required imports added
- [ ] {pattern-specific-items}
```

### Pattern to Skill Name Mapping

**Rule:** Skill name is `create-{pattern}` (e.g., `controller` → `create-controller`, `component` → `create-component`, `dto` → `create-dto`). For compound patterns, use the short form: `model/entity` → `create-model`, `api-route` → `create-api-route`.

---

## B2. Generate Command Skills (run-*)

**Reads:** Command selections from feature spec (`.5/CONFIGURE/feature.md`)

**Creates:** SKILL.md files in `.claude/skills/run-{command}/SKILL.md`

### Command-Based Skill Generation

For EACH command selected by the user in the feature spec:

1. **Read the source** - Check package.json scripts, Makefile, etc.
2. **Document the command:**
   - Exact command syntax
   - Available variants (e.g., test:unit, test:e2e)
   - Common flags and options
   - Expected output format
3. **Generate SKILL.md** with:
   - Command execution instructions
   - Output parsing guidance
   - Error handling patterns

### Command Skill Template Structure

For each skill, create `.claude/skills/run-{command}/SKILL.md`:

```yaml
---
name: run-{command}
description: Runs {command} for this project using {source}.
allowed-tools: Bash
model: haiku
context: fork
user-invocable: true
---
```

```markdown
# Run {Command}

## What This Skill Does
Executes the project's {command} command.

## Command
\`\`\`bash
{exact-command}
\`\`\`

## Variants
{if variants exist}
- `{variant1}` - {description}
- `{variant2}` - {description}

## Common Options
- `--watch` - Run in watch mode (if available)
- `--coverage` - Generate coverage report (for tests)
- `--fix` - Auto-fix issues (for lint/format)

## Expected Output
{describe what success/failure looks like}

## Error Handling
- If command fails, report the error output
- Common issues: {list common problems and solutions}
```

### Command to Skill Name Mapping

**Rule:** Skill name is `run-{category}` (e.g., `build` → `run-build`, `test`/`spec` → `run-tests`, `lint` → `run-lint`). Group variants under the primary category name.

---

## C. Generate Scoped Rules

If `rules.generate` is `true` in `.5/config.json`, generate `.claude/rules/` files with project-specific conventions scoped to relevant file types.

Rules are **concise directives** (15-40 lines each), NOT documentation. Documentation lives in `.5/*.md` files. Rules tell Claude what to do when working with specific file types.

### C1. Determine Which Rules to Generate

Based on the A1 analysis results, determine which rules apply:

| Rule File | Generate When | Source Analysis |
|-----------|---------------|-----------------|
| `code-style.md` | Always (if source files exist) | Conventions Analysis |
| `testing.md` | Test files detected | Testing Analysis |
| `api-patterns.md` | Controller/route/handler patterns detected | Architecture Analysis |
| `dependencies.md` | External integrations detected | Integration Analysis |

**Skip** any rule whose prerequisite patterns were not detected. Do NOT generate empty or placeholder rule files.

### C2. Extract Directives and Write Rules

For each applicable rule:

1. **Derive `paths:` globs** from detected file locations (e.g., if tests are at `src/**/*.test.ts` and `tests/**/*.spec.ts`, use those patterns)
2. **Convert analysis observations into imperative directives** — "Use X", "Always Y", "Never Z"
3. **Keep each file 15-40 lines** — be concise and actionable
4. **Do NOT repeat** the 6 mandatory coding guidelines from CLAUDE.md

Write files to `.claude/rules/`:

```bash
mkdir -p .claude/rules
```

### C3. Rule File Format

Each rule file uses YAML frontmatter with `paths:` for scoping. Rules without `paths:` load unconditionally.

**Example — `testing.md`:**

```markdown
---
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
---

# Testing Conventions

- Use `describe`/`it` blocks with descriptive names
- Mock external dependencies with jest.mock, never mock internal modules
- Use factory functions from `tests/factories/` for test data
- Each test file mirrors its source file path: `src/foo/Bar.ts` → `src/foo/__tests__/Bar.test.ts`
- Assert one behavior per test
```

**Example — `code-style.md`:**

```markdown
---
paths:
  - "src/**/*.{ts,tsx}"
---

# Code Style

- Use PascalCase for classes and types, camelCase for functions and variables
- Import order: external packages → internal modules → relative imports
- Use absolute imports with `@/` alias
- Prefer named exports over default exports
```

**Example — `dependencies.md` (unconditional):**

```markdown
# Dependency Conventions

- Database access through Prisma client only, never raw SQL
- HTTP requests use axios instance from `src/lib/http.ts`
- Environment variables accessed via `src/config/env.ts`, never `process.env` directly
```

### Refresh Mode Behavior for Rules

When running in REFRESH MODE:
- Re-analyze codebase and overwrite all existing rule files with updated directives
- Remove rule files for patterns no longer detected in the codebase
- Create new rule files if new patterns are detected that weren't present before

---

## Output Contract

Returns structured results for each component:

```
Component A (Documentation): SUCCESS - Created documentation files + CLAUDE.md
  - .5/ARCHITECTURE.md (Pattern: Layered, 4 layers identified)
  - .5/TESTING.md (mocking patterns, gotchas documented)
  - .5/CONCERNS.md (3 TODO items, 1 security note) [or "skipped — no concerns found"]
  - CLAUDE.md (updated with references)
Component B (Pattern Skills): SUCCESS - Generated 3 create-* skills (create-component, create-hook, create-context)
Component C (Command Skills): SUCCESS - Generated 2 run-* skills (run-tests, run-lint)
Component D (Rules): SUCCESS - Generated 3 rule files (code-style, testing, dependencies)
```

Or on failure:

```
Component A (Documentation): FAILED - Unable to read template files
Component B (Pattern Skills): FAILED - No patterns found in codebase
Component D (Rules): SKIPPED - rules.generate is false in config
```

## DO NOT

- DO NOT overwrite existing user-written CLAUDE.md sections
- DO NOT generate skills for patterns that don't exist in the project
- DO NOT generate command skills for commands that don't exist in the project
- DO NOT generate rules for patterns not detected in the codebase
- DO NOT include `steps` in config.json
- DO NOT hardcode conventions - always derive from actual project analysis
- DO NOT generate empty or placeholder skill or rule files
- DO NOT assume command syntax - always read from actual config files (package.json, Makefile, etc.)
- DO NOT repeat the 6 mandatory coding guidelines from CLAUDE.md in rule files
