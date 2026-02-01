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
  "reviewTool": "coderabbit" or "none"
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

**Creates:** SKILL.md files in `.claude/skills/{name}/SKILL.md`

Each skill follows the standard frontmatter pattern and contains instructions derived from analyzing the actual project structure (reads existing files to derive patterns/templates).

### Skill Detection by Project Type

| Project Type | Skills |
|---|---|
| Next.js | create-page, create-api-route, create-component |
| NestJS | create-module, create-service, create-controller |
| Express | create-route, create-middleware, create-service |
| React | create-component, create-hook, create-context |
| Django | create-model, create-view, create-serializer |
| Flask | create-blueprint, create-model |
| Java (Gradle/Maven) | create-entity, create-service, create-controller, create-repository |
| Rust | create-module |
| Go | create-handler, create-service |
| Rails | create-model, create-controller |
| Generic | create-module |

### Skill Generation Process

For each skill to generate:
1. Identify existing examples of that pattern in the codebase (e.g., find existing components for `create-component`)
2. Read 1-2 examples to extract the project's conventions and structure
3. Create a SKILL.md that instructs the agent to follow those conventions
4. Each generated SKILL.md should include:
   - Standard frontmatter (name, description, allowed-tools, model: sonnet, context: fork, user-invocable: false)
   - What the skill creates
   - File naming and location conventions (derived from existing code)
   - Template/pattern to follow (derived from existing code)
   - Checklist of what to include

### Example Generated Skill

```yaml
---
name: create-component
description: Creates a React component following project conventions.
allowed-tools: Read, Write, Glob, Grep
model: sonnet
context: fork
user-invocable: false
---
```

```markdown
# Create Component

## What This Skill Creates
A React component following this project's conventions.

## Conventions (from project analysis)
- Location: `src/components/{ComponentName}/`
- Files: `index.tsx`, `{ComponentName}.tsx`, `{ComponentName}.test.tsx`
- Style: CSS Modules at `{ComponentName}.module.css`
- Exports: Named export from component file, re-exported from index

## Template
{Derived from existing components in the project}

## Checklist
- [ ] Component file created
- [ ] Props interface defined
- [ ] Test file created
- [ ] Index file with re-export
- [ ] Follows naming conventions
```

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
Component C (Skills): SUCCESS - Generated 3 skills (create-component, create-hook, create-context)
```

Or on failure:

```
Component A (config.json): FAILED - Permission denied writing to .claude/.5/
Component B (Documentation): FAILED - Unable to read template files
```

## DO NOT

- DO NOT overwrite existing user-written CLAUDE.md sections
- DO NOT generate skills for patterns that don't exist in the project
- DO NOT include `steps` in config.json
- DO NOT hardcode conventions - always derive from actual project analysis
- DO NOT generate empty or placeholder skill files
