---
name: configure-project-skills
description: Generates project skills for executable procedures that take more than one plain command — running a single test, lint with autofix, codegen, migrations, starting the app. Used during /5:implement CONFIGURE and /5:reconfigure.
allowed-tools: Read, Write, Bash, Glob, Grep
model: sonnet
user-invocable: false
---

# Configure Project Skills Skill

Generates `.claude/skills/{name}/SKILL.md` for the procedures a developer runs in this project. A skill tells Claude how to *do* something; how code *looks* belongs in a rule (`configure-rules`).

- **Full mode (default):** used by `/5:implement CONFIGURE`. Generates the skills listed in Requirement 3 of `.5/planning/CONFIGURE.md`.
- **Refresh mode:** used by `/5:reconfigure`. The prompt includes "REFRESH MODE" and points at `.5/reconfigure-manifest.json`.

## 1. When a Procedure Earns a Skill

Generate a skill only when running the procedure takes knowledge beyond one command:

- **Variants** — one test, one module, one package, watch mode (`./gradlew :core:test --tests '*OrderServiceTest'`)
- **Prerequisites** — a container, a database, env vars, a codegen step that must run first
- **More than one command** in a fixed order — generate, then build; migrate, then seed
- **Reading the result** — where reports land, which failures are known flakes, how to tell a real failure

A procedure that is one plain command (`npm test`, `cargo build`) gets no skill: it stays a line under "Build & Run Commands" in `AGENTS.md`.

Typical names: `test`, `lint`, `codegen`, `db-migrate`, `start-app`. Name the app launcher `start-app`, not `run`: Claude Code's built-in `run` skill looks for a project skill that launches the app, and must not be shadowed.

## 2. Derive, Never Invent

Take every command from the project: `package.json` scripts, `build.gradle`/`pom.xml`, `Makefile`, `justfile`, `docker-compose.yml`, CI config (`.github/workflows/`, `.gitlab-ci.yml`), `CONTRIBUTING.md`. The CI config shows the real order and the prerequisites. When you cannot confirm a command exists, leave it out.

## 3. Skill File Format

```markdown
---
name: test
description: Runs this project's tests — all, one module, or a single test class — including the database container they need. Use when running or debugging tests.
allowed-tools: Bash, Read
user-invocable: true
---
<!-- foifi:generated -->

# Run Tests

## Prerequisites
- PostgreSQL via `docker compose up -d db` (tests fail with `Connection refused` on port 5432 otherwise)

## Commands
- All: `./gradlew test`
- One module: `./gradlew :core:test`
- One class: `./gradlew :core:test --tests '*OrderServiceTest'`

## Result
- Reports: `*/build/reports/tests/test/index.html`
- Success: exit code 0 and `BUILD SUCCESSFUL`
```

- `description` says what the skill does and when to use it: Claude picks skills by their description.
- The marker `<!-- foifi:generated -->` is the first body line.
- Never add `context: fork` — it makes skills loop by re-invoking themselves.
- Keep each skill under 50 lines.

## 4. Write Skills

For each skill in the plan or manifest:

1. If `.claude/skills/{name}/SKILL.md` exists **without** the marker, it belongs to the user: do not write it. Report it as a conflict.
2. Otherwise write it in the format above.

```bash
mkdir -p .claude/skills/{name}
```

## Refresh Mode

When running in REFRESH MODE, read `.5/reconfigure-manifest.json`:

- `skills.refresh`, `skills.create`, `skills.remove`: refresh, create, and remove exactly these skills. Re-derive every command (step 2): a command that no longer exists is removed from the skill.
- `proposals`: apply each accepted proposal whose `target` is a skill, or whose `action` is `migrate-to-skill`:
  - `migrate-to-skill` — write the new skill from the procedure in the source rule and the project files. Then remove the procedure from the source rule; delete the rule only when nothing else is left in it.
  - `stale`, `outdated`, `trim`, `duplicate` — rewrite or remove the target skill as the proposal's `detail` says.
  - Every skill you write gets the marker, also when it was the user's before: the user agreed that foifi manages it from now on.
- Never modify or remove any skill the manifest does not list.

---

## Output Contract

```
Component C (Project Skills): SUCCESS - Generated 2 skills (test, codegen)
```

Or:

```
Component C (Project Skills): SKIPPED - skills.generate is false in config
```

## DO NOT

- DO NOT generate a skill for a procedure that is one plain command.
- DO NOT invent commands, flags, or prerequisites.
- DO NOT describe how code looks in a skill; `configure-rules` owns that.
- DO NOT overwrite a skill without the `<!-- foifi:generated -->` marker unless an accepted proposal names it.
- DO NOT touch the workflow's own skills (`configure-*`, `review-style`, the style skills, `5-*`).
