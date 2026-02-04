---
name: configure-project
description: Creates project configuration files, analyzes codebase for CLAUDE.md, and generates project-specific skills. Used during /5:implement-feature CONFIGURE.
allowed-tools: Read, Write, Bash, Glob, Grep
model: sonnet
context: fork
user-invocable: false
---

# Configure Project Skill

## Overview

This skill does the heavy lifting during Phase 3 (implement-feature) for the CONFIGURE feature. It is called by step-executor to create the actual configuration files.

It handles three distinct tasks, invoked with different parameters per component:

- **A. Write config.json** - Creates the project configuration file
- **B. Analyze Codebase and Create/Update CLAUDE.md** - Maps codebase and documents conventions
- **C. Generate Project-Specific Skills** - Creates SKILL.md files for common project patterns

---

## A. Write config.json

**Receives:** project type, ticket config, branch config, build/test commands, tool availability

**Creates:** `.claude/.5/config.json`

**Schema (no `steps` array):**

```json
{
  "projectType": "{type}",
  "ticket": {
    "pattern": "{regex-pattern-or-null}",
    "extractFromBranch": true
  },
  "branch": {
    "convention": "{convention}"
  },
  "build": {
    "command": "{build-command}",
    "testCommand": "{test-command}",
    "timeout": {
      "compile": 120000,
      "test": 300000
    }
  },
  "tools": {
    "coderabbit": {
      "available": false,
      "authenticated": false
    },
    "ide": {
      "available": false,
      "type": null
    }
  },
  "reviewTool": "claude" or "coderabbit" or "none"
}
```

**Process:**
1. Read all values from the feature spec (`.5/CONFIGURE/feature.md`)
2. Ensure `.claude/.5/` directory exists (create with `mkdir -p` if needed)
3. Write `config.json` with pretty-printed JSON
4. Read back to verify correctness

---

## B. Analyze Codebase and Create/Update CLAUDE.md

**Process:**

### B1. Unified Codebase Analysis

Perform comprehensive analysis once to gather data for ALL templates:

**Structure Analysis** (for STRUCTURE.md):
- Use Glob to map directory tree: `**/*` (with depth limits to avoid overwhelming results)
- Identify source directories (`src/`, `lib/`, `app/`, etc.)
- Identify test directories and their organization
- Identify configuration directories
- Determine file naming conventions (camelCase, kebab-case, PascalCase)
- Locate key files (entry points, configurations)

**Stack Analysis** (for STACK.md):
- Read package manifests: `package.json`, `Cargo.toml`, `go.mod`, `pom.xml`, `requirements.txt`, `Gemfile`
- Extract: language, version, runtime, package manager
- Identify frameworks in dependencies (React, Express, Django, Rails, etc.)
- List critical dependencies and their versions
- Find config files: `tsconfig.json`, `.eslintrc`, etc.

**Architecture Analysis** (for ARCHITECTURE.md):
- Identify architectural pattern (MVC, layered, modular, microservices) from directory structure
- Map layers by directory structure (controllers/, services/, models/, routes/, etc.)
- Trace data flow patterns (read 2-3 example files from different layers)
- Identify key abstractions (interfaces, base classes, common patterns)
- Find entry points (`index.ts`, `main.go`, `app.py`, `server.js`)
- Analyze error handling strategy (try/catch, Result types, middleware, error boundaries)

**Conventions Analysis** (for CONVENTIONS.md):
- Sample 5-10 files from main source directory
- Extract naming patterns: files, functions, variables, types/classes
- Find formatters/linters: `.prettierrc`, `.eslintrc`, `black.toml`, `.rubocop.yml`
- Identify import organization patterns (order, grouping, aliases)
- Determine logging approach (console, winston, log4j, etc.)
- Check comment/documentation patterns (JSDoc, Javadoc, etc.)

**Testing Analysis** (for TESTING.md):
- Find test files: `**/*.test.{ts,js}`, `**/*.spec.{ts,js}`, `**/*_test.go`, `test_*.py`, `*_spec.rb`
- Read test config: `jest.config.js`, `vitest.config.ts`, `pytest.ini`, `spec/spec_helper.rb`
- Determine test organization (co-located vs separate `test/` or `spec/`)
- Extract test naming patterns
- Identify mocking framework (jest.mock, sinon, pytest-mock, etc.)
- Find fixture/factory patterns
- Extract test run commands from package.json, Makefile, or similar

**Integration Analysis** (for INTEGRATIONS.md):
- Scan dependencies for SDK packages (axios, @aws-sdk, stripe, @google-cloud, etc.)
- Identify database clients/ORMs (prisma, mongoose, sqlalchemy, activerecord, etc.)
- Find auth providers (passport, next-auth, devise, etc.)
- Detect monitoring/logging services (datadog, sentry, newrelic)
- Read CI/CD config: `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/config.yml`
- Grep for environment variables: `process.env`, `os.getenv`, `ENV[`, etc.

**Concerns Analysis** (for CONCERNS.md):
- Grep for TODO/FIXME/HACK/XXX/DEPRECATED comments across all code
- Check for common security issues (SQL injection patterns, XSS vulnerabilities)
- Identify deprecated dependencies (check for warnings in package manifests)
- Look for complex code sections (deeply nested conditionals, long functions)

### B2. Fill Templates

For each template in `src/templates/`:

1. Read template content with Read tool
2. Replace placeholders with analyzed data:
   - Date placeholders: `{YYYY-MM-DD}`, `{date}` → current date (format: YYYY-MM-DD)
   - Template-specific placeholders → actual project data from B1 analysis
3. Handle missing data gracefully: mark sections as "Not detected" or "None found" rather than omitting

**Placeholder mapping examples**:

ARCHITECTURE.md:
- `{Pattern name}` → "Layered Architecture" or "MVC" or "Modular Monolith"
- `{Layer Name}` → "Controllers", "Services", "Repositories"
- `{path}` → "src/controllers/", "src/services/"

STACK.md:
- `{Language} {Version}` → "TypeScript 5.3.3", "Python 3.11"
- `{Framework} {Version}` → "Express 4.18.2", "Django 4.2"
- `{Package} {Version}` → "axios 1.6.0"

CONVENTIONS.md:
- `{Pattern observed}` → "PascalCase for classes, camelCase for functions"
- `{Tool used}` → "Prettier with 2-space indent"

TESTING.md:
- `{Framework} {Version}` → "Jest 29.5.0"
- `{command}` → "npm test", "pytest"

INTEGRATIONS.md:
- `{Service}` → "PostgreSQL", "Stripe API"
- `{package}` → "@stripe/stripe-js"

CONCERNS.md:
- `{file paths}` → Actual file paths from grep results

### B3. Write Documentation Files

Write filled templates to `.5/` folder:

1. Ensure `.5/` directory exists: `mkdir -p .5`
2. Write each filled template:
   - `.5/ARCHITECTURE.md`
   - `.5/STACK.md`
   - `.5/STRUCTURE.md`
   - `.5/CONVENTIONS.md`
   - `.5/TESTING.md`
   - `.5/INTEGRATIONS.md`
   - `.5/CONCERNS.md`

### B4. Create Master CLAUDE.md

Generate CLAUDE.md as a navigation hub:

```markdown
# {Project Name}

> Generated: {YYYY-MM-DD}
> Documentation is organized into focused files for better maintainability

## Quick Reference

- [Technology Stack](./.5/STACK.md) - Languages, frameworks, dependencies
- [Codebase Structure](./.5/STRUCTURE.md) - Directory layout and organization
- [Architecture](./.5/ARCHITECTURE.md) - Patterns, layers, and data flow
- [Coding Conventions](./.5/CONVENTIONS.md) - Naming, style, and patterns
- [Testing Patterns](./.5/TESTING.md) - Test framework and patterns
- [External Integrations](./.5/INTEGRATIONS.md) - APIs, databases, services
- [Codebase Concerns](./.5/CONCERNS.md) - Tech debt, bugs, and risks

## Project Overview

{1-2 paragraph summary from README or package.json description}

## Build & Run Commands

- Build: `{build-command}`
- Test: `{test-command}`
- {Other detected scripts}

## Coding Guidelines

When working with this codebase, follow these principles:

1. Types should be clear and types should be available when possible
2. Use doc (jsdoc, javadoc, pydoc, etc) concisely. No doc is better than meaningless doc
3. Keep files short and structured
4. Extract methods, classes
5. Respect SRP and DRY
6. Make code maintainable and modular

## Getting Started

**For new developers:**
1. Review [Stack](./.5/STACK.md) for technology overview
2. Read [Structure](./.5/STRUCTURE.md) to understand organization
3. Study [Conventions](./.5/CONVENTIONS.md) for coding standards
4. Check [Architecture](./.5/ARCHITECTURE.md) for design patterns

**For specific tasks:**
- Adding features → See [Architecture](./.5/ARCHITECTURE.md)
- Writing tests → See [Testing](./.5/TESTING.md)
- Integration work → See [Integrations](./.5/INTEGRATIONS.md)
- Reviewing concerns → See [Concerns](./.5/CONCERNS.md)
```

### B5. Preserve Existing Content

If CLAUDE.md already exists:
- Read current content
- Identify user-written custom sections (not matching template structure)
- Preserve under "Custom Documentation" section in new CLAUDE.md
- Ensure 6 mandatory coding guidelines are retained

---

## C. Generate Project-Specific Skills

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

| Detected Pattern | Skill Name |
|------------------|------------|
| **Core Architecture** | |
| controller | create-controller |
| service | create-service |
| repository | create-repository |
| model/entity | create-model |
| handler | create-handler |
| **Data Transfer** | |
| dto | create-dto |
| request | create-request |
| response | create-response |
| mapper | create-mapper |
| validator | create-validator |
| schema | create-schema |
| **Frontend** | |
| component | create-component |
| hook | create-hook |
| context | create-context |
| store | create-store |
| page | create-page |
| layout | create-layout |
| **API/Routes** | |
| api-route | create-api-route |
| middleware | create-middleware |
| guard | create-guard |
| interceptor | create-interceptor |
| filter | create-filter |
| **Testing** | |
| test | create-test |
| spec | create-spec |
| fixture | create-fixture |
| factory | create-factory |
| mock | create-mock |
| **Utilities** | |
| util | create-util |
| helper | create-helper |
| constant | create-constant |
| type | create-type |
| config | create-config |
| **Framework-Specific** | |
| module | create-module |
| pipe | create-pipe |
| decorator | create-decorator |
| blueprint | create-blueprint |
| view | create-view |
| serializer | create-serializer |
| **Background/Async** | |
| job | create-job |
| worker | create-worker |
| event | create-event |
| listener | create-listener |
| command | create-command |
| **Database** | |
| migration | create-migration |
| seed | create-seed |
| **Error Handling** | |
| exception | create-exception |
| error | create-error |

### Why `user-invocable: true`

Generated skills are user-invocable so users can invoke them directly:
- `/create-controller UserController`
- `/create-component Button`
- `/create-service AuthService`

This is more useful than internal-only skills.

### Why `model: haiku`

Pattern-following is simple once conventions are documented:
- Faster and cheaper than sonnet
- Deep analysis already happened during generation
- The skill just needs to follow the documented template

---

## C2. Generate Command Skills (run-*)

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

| Detected Command | Skill Name |
|------------------|------------|
| build | run-build |
| test, spec | run-tests |
| lint, eslint | run-lint |
| format, prettier | run-format |
| typecheck, tsc | run-typecheck |
| dev, start | run-dev |
| db:migrate, migrate | run-migrate |
| db:seed, seed | run-seed |
| docker:build | run-docker-build |
| docker:up, compose up | run-docker-up |
| clean | run-clean |
| generate, codegen | run-generate |

---

## Output Contract

Returns structured results for each component:

```
Component A (config.json): SUCCESS - Created .claude/.5/config.json
Component B (Documentation): SUCCESS - Created 7 documentation files + index
  - .5/ARCHITECTURE.md (Pattern: Layered, 4 layers identified)
  - .5/STACK.md (TypeScript + Express, 23 dependencies)
  - .5/STRUCTURE.md (8 top-level directories mapped)
  - .5/CONVENTIONS.md (PascalCase/camelCase, Prettier formatting)
  - .5/TESTING.md (Jest framework, 45 test files)
  - .5/INTEGRATIONS.md (PostgreSQL, 2 APIs, GitHub Actions)
  - .5/CONCERNS.md (3 TODO items, 1 deprecated dependency)
  - CLAUDE.md (index with references)
Component C (Pattern Skills): SUCCESS - Generated 3 create-* skills (create-component, create-hook, create-context)
Component D (Command Skills): SUCCESS - Generated 2 run-* skills (run-tests, run-lint)
```

Or on failure:

```
Component A (config.json): FAILED - Permission denied writing to .claude/.5/
Component B (Documentation): FAILED - Unable to read template files
```

## DO NOT

- DO NOT overwrite existing user-written CLAUDE.md sections
- DO NOT generate skills for patterns that don't exist in the project
- DO NOT generate command skills for commands that don't exist in the project
- DO NOT include `steps` in config.json
- DO NOT hardcode conventions - always derive from actual project analysis
- DO NOT generate empty or placeholder skill files
- DO NOT assume command syntax - always read from actual config files (package.json, Makefile, etc.)
