# Repository Guide

{PROJECT_OVERVIEW}

## Build & Run Commands

{BUILD_RUN_COMMANDS}

## Skill Usage

Before implementing changes, always check the available skills for relevant implementation guidance.

Use skills to understand project-specific workflows, commands, testing expectations, and implementation conventions before editing code.

## Commit Messages

Use the `/5:commit` command or `$5-commit` skill when creating commits. It reads `.5/config.json` and applies the configured `git.commitMessage.pattern`, including ticket IDs from branch names when configured.

## Workflow Rules

When running `/5:` workflow commands, follow the command instructions exactly as written.
Do not skip steps, combine phases, or proceed to actions not specified in the current command.
Each phase produces a specific artifact - do not create artifacts belonging to other phases.

## Coding Guidelines

1. Prefer explicit types or contracts for public APIs, data transfer shapes, service methods, hooks, and async return values where the language supports them.
2. Keep comments and docs concise; document constraints and non-obvious behavior, not the obvious.
3. Keep files focused and bounded; split broad controllers, services, hooks, and components early.
4. Extract helpers or classes when logic starts mixing orchestration, parsing, IO, and mapping in one place.
5. Favor SRP and DRY, but follow surrounding module conventions before introducing new abstractions.
6. Keep features modular: wire backend providers in feature modules, keep UI state in hooks, and avoid cross-layer shortcuts.

## Simplicity First

Before writing code, walk this decision hierarchy and stop at the first step that solves the problem:

1. **Does this need to exist at all?** If the requirement is speculative, don't build it (YAGNI).
2. Does the **language or standard library** already solve it?
3. Is there a **native platform or framework** feature for it?
4. Does an **already-installed dependency** cover it? Don't add a new dependency for this.
5. Can it be a **single, clear expression** instead of a new abstraction?
6. Only then: write the **minimum viable implementation**.

Non-negotiable regardless of the above: security, data integrity, correctness, and accessibility.

Then apply these rules:

- No features beyond what was asked.
- No abstractions for single-use code.
- No flexibility or configurability that was not requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## Testing

- Add unit tests for business logic when they provide real value.
- Do not create unit tests just to satisfy coverage or test trivial code.
- New features must be covered by e2e or integration tests where practical.
- Bug fixes should include a regression test when practical.

## Surgical Changes

Touch only what you must. Clean up only your own mess.
When editing existing code:

- Do not improve adjacent code, comments, or formatting.
- Do not refactor things that are not broken.
- Match existing style, even if you would do it differently.
- If you notice unrelated dead code, mention it; do not delete it.

When your changes create orphans:

- Remove imports, variables, functions, and files that your changes made unused.
- Do not remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" -> "Write tests for invalid inputs, then make them pass"
- "Fix the bug" -> "Write a test that reproduces it, then make it pass"
- "Refactor X" -> "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Project Documentation

{PROJECT_DOCUMENTATION_LINKS}

## Codebase Index

{CODEBASE_INDEX_LINKS}

Use the `use-index` skill before running broad Glob/Grep scans. It handles freshness checks, file selection by task type, and fallback strategies. If index files are more than one day old, regenerate them by running `.5/index/rebuild-index.sh` before relying on them.

{CUSTOM_DOCUMENTATION}
