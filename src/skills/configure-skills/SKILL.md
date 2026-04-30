---
name: configure-skills
description: Generates project-specific create-*/run-* skills and scoped rules from the current codebase. Used during /5:implement CONFIGURE.
allowed-tools: Read, Write, Bash, Glob, Grep
model: sonnet
context: fork
user-invocable: false
---

# Configure Skills Skill

## Overview

This skill handles skill and rule generation during implementation for the CONFIGURE feature. It is called by step-executor to create project-specific skills and scoped rules.

It handles two tasks:

- **Generate Project-Specific Skills** - Creates SKILL.md files for common project patterns
- **Generate Scoped Rules** - Creates `.claude/rules/*.md` files with file-type-specific directives

Note: config.json is written directly by `/5:configure` during the Q&A phase.

---

## Modes

This skill supports two modes. The skill generation and rule generation logic is the same in both modes — only the **input source** changes.

### Full Mode (default)

Used by `/5:configure` → `/5:implement CONFIGURE` flow.

- **Input:** Pattern/command selections from unified plan (`.5/features/CONFIGURE/plan.md`)
- **Behavior:** Creates all selected skills and rules from scratch based on unified plan requirements

### Refresh Mode

Used by `/5:reconfigure` for lightweight refresh.

- **Input:** The Task prompt lists which skills to refresh, create, and remove, and which rules to refresh or remove
- **Behavior:** Re-analyzes codebase, refreshes/creates/removes skills as specified, and refreshes workflow-generated rules
- **Trigger:** Task prompt includes "REFRESH MODE"

In both modes, the generation logic is identical — only where the requested skill/rule list comes from differs.

---

## A. Generate Project-Specific Skills

### Using skill-creator plugin

If `tools.skillCreator.available` is `true` in `.5/config.json`, use the skill-creator plugin's tools (e.g., `create-skill`, `scaffold-skill`) to generate each SKILL.md instead of the template-based approach below. Pass the extracted patterns, conventions, and example file paths as context to the skill-creator tool so it can produce structured, high-quality skill files.

If skill-creator is not available, use the existing template-based generation below — no degradation in workflow behavior.

**Reads:** Pattern selections from unified plan (`.5/features/CONFIGURE/plan.md`)

**Creates:** SKILL.md files in `.claude/skills/{name}/SKILL.md`

### A1. Pattern-Based Skill Generation

Skills are determined by what patterns exist in the codebase (detected during `/5:configure`) and what the user selected — not by project type.

For EACH pattern selected by the user in the unified plan:

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

### A2. Skill Template Structure

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

### A3. Pattern to Skill Name Mapping

**Rule:** Skill name is `create-{pattern}` (e.g., `controller` → `create-controller`, `component` → `create-component`, `dto` → `create-dto`). For compound patterns, use the short form: `model/entity` → `create-model`, `api-route` → `create-api-route`.

---

## B. Generate Command Skills (run-*)

**Reads:** Command selections from unified plan (`.5/features/CONFIGURE/plan.md`)

**Creates:** SKILL.md files in `.claude/skills/run-{command}/SKILL.md`

### B1. Command-Based Skill Generation

For EACH command selected by the user in the unified plan:

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

### B2. Command Skill Template Structure

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

### B3. Command to Skill Name Mapping

**Rule:** Skill name is `run-{category}` (e.g., `build` → `run-build`, `test`/`spec` → `run-tests`, `lint` → `run-lint`). Group variants under the primary category name.

---

## C. Generate Scoped Rules

If `rules.generate` is `true` in `.5/config.json`, generate `.claude/rules/` files with project-specific conventions scoped to relevant file types.

Rules are **concise directives** (15-40 lines each), not documentation. Documentation lives in `.5/*.md` files. Rules tell Claude what to do when working with specific file types.

### C1. Determine Which Rules to Generate

Based on the codebase analysis results, determine which rules apply:

| Rule File | Generate When | Source Analysis |
|-----------|---------------|-----------------|
| `code-style.md` | Always (if source files exist) | Conventions Analysis |
| `testing.md` | Test files detected | Testing Analysis |
| `api-patterns.md` | Controller/route/handler patterns detected | Architecture Analysis |
| `dependencies.md` | External integrations detected | Integration Analysis |

**Skip** any rule whose prerequisite patterns were not detected. Do not generate empty or placeholder rule files.

### C2. Extract Directives and Write Rules

For each applicable rule:

1. **Derive `paths:` globs** from detected file locations (e.g., if tests are at `src/**/*.test.ts` and `tests/**/*.spec.ts`, use those patterns)
2. **Convert analysis observations into imperative directives** — "Use X", "Always Y", "Never Z"
3. **Keep each file 15-40 lines** — be concise and actionable
4. **Do not repeat** the 6 mandatory coding guidelines from `AGENTS.md`

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
- Re-analyze codebase and overwrite all existing workflow-generated rule files with updated directives
- Remove rule files for patterns no longer detected in the codebase when instructed by the refresh prompt
- Create new rule files if new patterns are detected and selected
- Never modify or remove user-created rules outside the workflow-generated set

---

## Output Contract

Returns structured results for each component:

```
Component B (Pattern Skills): SUCCESS - Generated 3 create-* skills (create-component, create-hook, create-context)
Component C (Command Skills): SUCCESS - Generated 2 run-* skills (run-tests, run-lint)
Component D (Rules): SUCCESS - Generated 3 rule files (code-style, testing, dependencies)
```

Or on failure:

```
Component B (Pattern Skills): FAILED - No patterns found in codebase
Component D (Rules): SKIPPED - rules.generate is false in config
```

## DO NOT

- DO NOT generate skills for patterns that don't exist in the project unless the refresh/configure prompt explicitly told you to create them
- DO NOT generate command skills for commands that don't exist in the project
- DO NOT generate rules for patterns not detected in the codebase
- DO NOT include `steps` in config.json
- DO NOT hardcode conventions - always derive from actual project analysis
- DO NOT generate empty or placeholder skill or rule files
- DO NOT assume command syntax - always read from actual config files (package.json, Makefile, etc.)
- DO NOT repeat the 6 mandatory coding guidelines from `AGENTS.md` in rule files
