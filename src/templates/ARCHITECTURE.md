# Architecture

## Pattern

**Overall:** {Pattern name — e.g., Layered, MVC, Modular Monolith}

{1-2 sentences explaining the architectural approach and key design decisions}

## Layers & Data Flow

| Layer | Location | Depends On | Notes |
|-------|----------|------------|-------|
| {Layer} | `{path}` | {Dependencies} | {Key responsibility or constraint} |

## Key Abstractions

**{Abstraction Name}:**
- Purpose: {What it represents}
- Pattern: {How it's used across the codebase}
- Examples: `{file paths}`

## Non-Obvious Conventions

{ONLY conventions not enforced by tooling or visible in config files. Skip anything in .eslintrc, .prettierrc, tsconfig, etc.}

- {e.g., "All services must extend BaseService for lifecycle hooks"}
- {e.g., "Barrel exports required in each module directory"}

## Where to Add New Code

- New feature: `{path}`
- New tests: `{path}`
- Shared utilities: `{path}`
