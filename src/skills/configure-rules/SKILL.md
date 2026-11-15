---
name: configure-rules
description: Generates `.claude/rules/` from the code patterns the codebase actually follows — one path-scoped rule per recurring building block (DTO, entity, mapper, component, ...) and a few project-wide rules. Used during /5:implement CONFIGURE and /5:reconfigure.
allowed-tools: Read, Write, Bash, Glob, Grep
model: sonnet
user-invocable: false
---

# Configure Rules Skill

Generates `.claude/rules/*.md`: short directives about how code is built here. A rule with `paths:` loads automatically when Claude works on matching files, so rules are the place for code patterns. Executable procedures (build, test, lint, codegen) are not rules: `configure-project-skills` turns them into skills.

- **Full mode (default):** used by `/5:implement CONFIGURE`. Generates the rules listed in Requirement 2 of `.5/planning/CONFIGURE.md`.
- **Refresh mode:** used by `/5:reconfigure`. The prompt includes "REFRESH MODE" and points at `.5/reconfigure-manifest.json`.

**On Codex** (this skill runs as part of `$5-configure` or `$5-reconfigure`), Codex has no path-scoped rules and reads only `AGENTS.md`. Write the rule files to `.5/rules/` and an index into the foifi block of `AGENTS.md` — see [Codex: rules in AGENTS.md](#codex-rules-in-agentsmd).

The repository's own standards win over rules. These are the files `.claude/skills/review-style/SKILL.md` step 2 lists, such as `CONTRIBUTING.md`. A rule never restates or contradicts them.

## 1. Rule Kinds

| Kind | Scope | Examples |
|------|-------|----------|
| Pattern rule | `paths:` globs that match one recurring building block | `dto.md`, `entity.md`, `mapper.md`, `controller.md`, `repository.md`, `component.md`, `migration.md`, `testing.md` |
| Project-wide rule | no `paths:`, loads in every session | `architecture.md` (layers, module boundaries, where new files go), `dependencies.md` (clients for external services, env var access) |

Keep project-wide rules few and short: they cost context in every session. Generate at most `architecture.md` and `dependencies.md`, and only with content from the list below.

A pattern needs a glob that tells its files apart — a directory (`**/dto/**`), a suffix (`**/*Mapper.java`), or a naming scheme (`**/use*.ts`). A pattern without one cannot be a path-scoped rule; put what matters about it into `architecture.md` or leave it out.

## 2. What a Rule Says

Claude reads an existing file before it writes a new one of the same kind. A rule carries what that one file does not show:

- **Obligations across files** — "A new entity needs a Flyway migration, a mapper method in `EntityMapper`, and a registration in `PersistenceConfig`."
- **Conventions tooling does not enforce** and that differ from common defaults — "DTOs are Java records; validation annotations sit on the record components."
- **A reference file** — "Template: `src/main/java/.../user/UserDto.java`."
- **Anti-patterns the code avoids** — "Never map entities by hand; MapStruct generates every mapper."

Skip a rule when it would only describe what any example file already shows. Skip a directive that a linter or formatter enforces.

## 3. Write Rules

For each rule in the plan or manifest:

1. Read the 2-3 example files it names, plus the files they wire into, to find the obligations.
2. **Check the globs** against the real files: they must match the pattern's files and little else. Count the matches (`git ls-files '<glob>' | wc -l` or Glob). Narrow a glob that pulls in unrelated files; drop the rule when no glob fits.
3. Write imperative directives — "Use X", "Always Y", "Never Z" — 15-40 lines per rule.
4. Do not repeat the general guidance from `AGENTS.md`, the style skills, or the repository's own standards.

```bash
mkdir -p .claude/rules
```

## 4. Rule File Format

YAML frontmatter with `paths:` for scoping, then the marker line `<!-- foifi:generated -->` as the first body line. Rules without `paths:` load unconditionally.

**Example — `entity.md`:**

```markdown
---
paths:
  - "src/main/java/**/domain/*Entity.java"
---
<!-- foifi:generated -->

# Entities

Template: `src/main/java/com/acme/order/domain/OrderEntity.java`

- Extend `BaseEntity`; never declare `id`, `createdAt`, or `version` yourself
- Use `@Enumerated(EnumType.STRING)` for every enum column
- Collections are `Set`, initialized inline, with `orphanRemoval = true` on owned children
- A new entity needs:
  - a Flyway migration in `src/main/resources/db/migration/V{next}__{name}.sql`
  - a mapper method in `com.acme.common.mapping.EntityMapper`
  - a repository extending `BaseRepository`
- Never expose an entity from a controller; map it to its DTO
```

**Example — `architecture.md` (unconditional):**

```markdown
<!-- foifi:generated -->
# Architecture

- Modules: `api` (controllers, DTOs) → `core` (services, entities) → `infra` (repositories, clients); never import upwards
- A new feature gets its own package under each module, named after the aggregate (`order`, `invoice`)
- Cross-module calls go through the service interfaces in `core/*/api/`
```

## Codex: rules in AGENTS.md

Write each rule as `.5/rules/{name}.md` in the format above. Then put one section just before the `<!-- foifi:end -->` line of `AGENTS.md`, replacing an existing one (a full-text section from earlier versions included):

```markdown
<!-- 5-sync:rules-start -->
## File-Scoped Rules

Before you work on a file that matches a rule below, read that rule file and follow it.

- `entity` — `src/main/java/**/domain/*Entity.java` → `.5/rules/entity.md`
- `dto` — `**/dto/**/*.java` → `.5/rules/dto.md`

### architecture
Applies to: all files

- Modules: `api` → `core` → `infra`; never import upwards
<!-- 5-sync:rules-end -->
```

Path-scoped rules get one index line each. Project-wide rules stay in full text as `###` subsections, because they apply everywhere. Change nothing else in `AGENTS.md`. Without a foifi block, stop and report that `configure-agents-md` must run first.

## Refresh Mode

When running in REFRESH MODE, read `.5/reconfigure-manifest.json`:

- `rules.refresh`, `rules.create`, `rules.remove`: refresh, create, and remove exactly these rules, as in steps 2-4.
- `proposals`: apply each accepted proposal whose `target` is a rule, or whose `action` is `migrate-to-rule`:
  - `migrate-to-rule` — write the new rule from the source skill's content and the code, following steps 2-4. Delete the source skill directory only after the rule is written.
  - `stale`, `outdated`, `trim`, `contradicts-standard`, `duplicate` — rewrite or remove the target rule as the proposal's `detail` says.
  - `convert-codex-index` (Codex only) — for each full-text `###` subsection of the `File-Scoped Rules` section whose `Applies to:` names globs, write `.5/rules/{name}.md` with those globs as `paths:`, the marker, and the subsection's directives. Subsections that apply to all files stay in full text. The section is then rewritten as the index below.
  - Every rule you write gets the `<!-- foifi:generated -->` marker, also when it was the user's before: the user agreed that foifi manages it from now on.
- Never modify or remove any rule file the manifest does not list.
- On Codex, rewrite the `File-Scoped Rules` section from all rules in `.5/rules/` after the changes. `/5:reconfigure` runs this skill last, so the index also reflects rules that `configure-project-skills` changed or deleted.

---

## Output Contract

```
Component B (Rules): SUCCESS - Generated 4 rule files (architecture, entity, dto, testing)
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
- DO NOT put executable procedures (build, test, lint, codegen, start) into rules; `configure-project-skills` owns those.
