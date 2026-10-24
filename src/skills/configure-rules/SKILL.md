---
name: configure-rules
description: Generates file-scoped `.claude/rules/` from the conventions the codebase actually follows. Used during /5:implement CONFIGURE and /5:reconfigure.
allowed-tools: Read, Write, Bash, Glob, Grep
model: sonnet
user-invocable: false
---

# Configure Rules Skill

Generates `.claude/rules/*.md`: short directives that load only when Claude works on matching files. Claude explores the code on its own, so rules carry only what exploration gets wrong: conventions that tooling does not enforce and that differ from common defaults.

- **Full mode (default):** used by `/5:implement CONFIGURE`. Runs when `rules.generate` is `true` in `.5/config.json`.
- **Refresh mode:** used by `/5:reconfigure`. The prompt includes "REFRESH MODE" and points at `.5/reconfigure-manifest.json`.

**On Codex** (this skill runs as part of `$5-configure` or `$5-reconfigure`), write no rule files: Codex reads only `AGENTS.md`. Write the same rules, in the same order, into the foifi block of `AGENTS.md` instead — see [Codex: rules in AGENTS.md](#codex-rules-in-agentsmd).

Rules are **concise directives** (15-40 lines each), not documentation. Rules tell Claude what to do when working with specific file types.

The repository's own standards win over rules. These are the files `.claude/skills/review-style/SKILL.md` step 2 lists, such as `CONTRIBUTING.md`. A rule never restates or contradicts them.

## 1. Determine Which Rules to Generate

Scan the codebase for the file types each rule needs, then pick the rules that apply:

| Rule File | Generate When | What to Analyze |
|-----------|---------------|-----------------|
| `code-style.md` | Always (if source files exist) | 2-3 source files: naming, imports, exports, and structure that tooling does not enforce |
| `testing.md` | Test files detected | 3-5 test files: organization, assertions, mocking, fixtures, setup gotchas |
| `api-patterns.md` | Controller/route/handler patterns detected | 2-3 handlers: validation, error responses, auth checks |
| `dependencies.md` | External integrations detected | Clients for external services, env var access, required setup |

**Skip** any rule whose prerequisite patterns were not detected. Do not generate empty or placeholder rule files.

## 2. Extract Directives and Write Rules

For each applicable rule:

1. **Derive `paths:` globs** from detected file locations (e.g., if tests are at `src/**/*.test.ts` and `tests/**/*.spec.ts`, use those patterns)
2. **Convert analysis observations into imperative directives** — "Use X", "Always Y", "Never Z"
3. **Keep each file 15-40 lines** — be concise and actionable
4. **Do not repeat** the general guidance sections from `AGENTS.md`, the style skills, or the repository's own standards

Write files to `.claude/rules/`:

```bash
mkdir -p .claude/rules
```

## 3. Rule File Format

Each rule file uses YAML frontmatter with `paths:` for scoping, followed by the marker line `<!-- foifi:generated -->` as the first body line. Rules without `paths:` load unconditionally.

**Example — `testing.md`:**

```markdown
---
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
---
<!-- foifi:generated -->

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
<!-- foifi:generated -->

# Code Style

- Use PascalCase for classes and types, camelCase for functions and variables
- Import order: external packages → internal modules → relative imports
- Use absolute imports with `@/` alias
- Prefer named exports over default exports
```

**Example — `dependencies.md` (unconditional):**

```markdown
<!-- foifi:generated -->
# Dependency Conventions

- Database access through Prisma client only, never raw SQL
- HTTP requests use axios instance from `src/lib/http.ts`
- Environment variables accessed via `src/config/env.ts`, never `process.env` directly
```

## Codex: rules in AGENTS.md

Put one section just before the `<!-- foifi:end -->` line of `AGENTS.md`, replacing an existing one:

```markdown
<!-- 5-sync:rules-start -->
## File-Scoped Rules

### testing
Applies to: `**/*.test.ts`, `**/*.spec.ts`

- Use `describe`/`it` blocks with descriptive names
<!-- 5-sync:rules-end -->
```

One `###` subsection per rule, named like the rule file, starting with `Applies to:` and its globs (`Applies to: all files` for an unconditional rule). Change nothing else in `AGENTS.md`. Without a foifi block, stop and report that `configure-agents-md` must run first.

## Refresh Mode

When running in REFRESH MODE:
- Refresh, create, and remove only the rule files `.5/reconfigure-manifest.json` lists.
- A rule file counts as workflow-generated only when it contains the `<!-- foifi:generated -->` marker line, or, for files from earlier versions without the marker, when the manifest lists it. Never modify or remove any other rule file.
- On Codex, rewrite the `File-Scoped Rules` section with the manifest's refreshed and new rules, minus the removed ones.

---

## Output Contract

```
Component B (Rules): SUCCESS - Generated 3 rule files (code-style, testing, dependencies)
```

Or:

```
Component B (Rules): SKIPPED - rules.generate is false in config
```

## DO NOT

- DO NOT generate rules for file types that do not exist in the project.
- DO NOT generate empty or placeholder rule files.
- DO NOT hardcode conventions - always derive them from the actual code.
- DO NOT repeat the general guidance from `AGENTS.md` in rule files.
- DO NOT restate or contradict the repository's own standards.
- DO NOT generate skills. Earlier versions generated pattern and `run-*` skills; leave any that exist untouched.
