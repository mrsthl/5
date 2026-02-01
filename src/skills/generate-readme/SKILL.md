---
name: generate-readme
description: Generates concise README.md files for monorepo modules by analyzing module structure, dependencies, key components, and testing patterns. Use when creating module documentation, documenting architecture, updating READMEs, or when user asks to generate/create README for a module.
allowed-tools: Read, Glob, Grep, Write
---

# Generate Module README

## Overview

Analyzes a module's structure, dependencies, build configuration, and code patterns to generate concise, focused
README.md files following the standardized template.

READMEs should be **top-level overviews only** - not exhaustive documentation. Focus on:

- Module purpose (1-3 sentences)
- 3-5 key components only
- Critical patterns that developers must know
- Testing approach

## Instructions

When generating a README, follow these steps:

### 1. Identify Module Information

- **Module path**: Determine the full path to the module
- **Module name**: Extract from path (e.g., `user-service`, `auth-middleware`)
- **Module type**: Determine layer/purpose (models, services, controllers, routes, middleware, utils, etc.)
- **Domain**: Extract domain/feature name (e.g., `user` from `user-service`)

### 2. Analyze Module Structure

Use `Glob` or `Read` to understand:

- Key source files (detect from project structure: `src/`, `lib/`, `app/`, etc.)
- Test files (`.test.ts`, `.spec.ts`, `_test.go`, `test_*.py`, etc.)
- Build/config files (`package.json`, `Cargo.toml`, `go.mod`, `setup.py`, etc.)

### 3. Identify Key Components (3-5 only)

**DO NOT list every file.** Only identify the most important components:

For **model/entity** modules:

- Main data models or entities
- Schema definitions
- Validation logic

For **service/business logic** modules:

- Core service classes or functions
- Repository/data access interfaces
- Key business logic components

For **API/route** modules:

- Main route handlers or controllers
- Request/response types
- Middleware components

For **utility** modules:

- Main utility functions or helpers
- Configuration handlers

### 4. Document Testing Approach

Check for:

- Test files colocated with source or in separate test directory
- Test fixtures or factories
- Key test patterns (unit tests, integration tests)

### 5. Identify Critical Patterns

Look for patterns in project documentation:

- Check `.5/ARCHITECTURE.md` for architectural patterns (MVC, Clean Architecture, etc.)
- Check `.5/CONVENTIONS.md` for coding conventions and design patterns
- Check `.5/TESTING.md` for test patterns and conventions
- Fall back to CLAUDE.md if `.5/` documentation not present
- Check module-specific documentation

Use these patterns to identify what's critical for the module README.

### 6. Generate README

Use the template from `TEMPLATE.md` to generate the README.

**Critical guidelines:**

- Keep Purpose to 1-3 sentences
- List only 3-5 Key Components (never exhaustive lists)
- Use package references instead of listing many files (e.g., "Validators in `validation/` package")
- Focus Critical Patterns on what developers must know to avoid breaking things
- Omit sections if not relevant (e.g., no Testing section if module has no fixtures)

### 7. Write README

Use the `Write` tool to create `README.md` in the module's root directory.

## What to Provide

When a user asks to generate a README, they should provide:

- The module name or path (e.g., "user-service" or "/path/to/services/user-service")

If not provided, ask for clarification.

## Examples

See [EXAMPLES.md](EXAMPLES.md) for complete examples of generated READMEs for different module types.

## Template Structure

See [TEMPLATE.md](TEMPLATE.md) for the standard README template structure.

## Important Notes

1. **Conciseness is key**: READMEs should be under 100 lines for most modules
2. **Top-level overview only**: Don't document every class or method
3. **Focus on "must know"**: What will break if developer doesn't know it?
