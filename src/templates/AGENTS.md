<!-- Generated from the foifi AGENTS.md template. The repository standards in this file are the "Custom Documentation" section and the files linked under "Standards". All other sections are workflow rules. They rank below the repository standards and the style skills. -->

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

## Standards

These rules decide how code is written here, in this order:

1. **This repository's own standards always win.** They cover contributing, code style, and conventions:

{REPO_STANDARDS_LINKS}

2. **The workflow's style skills set the baseline** wherever the repository's standards say nothing: `fowler-code-smells`, `cognitive-load`, `documentation-style`, and `baseline-conventions`. Follow them when you write or review code. Where a repository standard endorses something a style would flag, the repository standard wins.
3. **The workflow rules below** (Simplicity First, Testing, Surgical Changes, Goal-Driven Execution) apply as well. When a repository standard asks for more, such as a changelog entry or a test, do what it asks.

Run the `review-style` skill to check a change against all of them.

## Simplicity First

Before writing code, walk this decision hierarchy and stop at the first step that solves the problem:

1. **Does this need to exist at all?** If the requirement is speculative, don't build it (YAGNI).
2. Does it **already exist in this codebase**? Search before you write — reuse the helper, util, type, or pattern that is already here instead of re-implementing it.
3. Does the **language or standard library** already solve it?
4. Is there a **native platform or framework** feature for it?
5. Does an **already-installed dependency** cover it? Don't add a new dependency for this.
6. Can it be a **single, clear expression** instead of a new abstraction?
7. Only then: write the **minimum viable implementation**.

The hierarchy shortens the solution, never the reading: understand the code the change touches before picking a step.

Non-negotiable regardless of the above: security, data integrity, correctness, and accessibility.

Then apply these rules:

- No features beyond what was asked.
- No abstractions for single-use code.
- No flexibility or configurability that was not requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Bug fix = root cause, not symptom: find every caller of the function you touch and fix the shared code path once.
- Large or ambiguous request: build the smallest version that satisfies it and ask about the rest in the same response instead of building it speculatively.
- When you finish, name what you deliberately left out in one line each (`skipped: X — add when Y`). No essays defending the simplification.

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

Before you report a task as done, check your own diff (`git status --short` and `git diff --stat`): revert files and changes that do not trace to the request, and remove new dependencies nobody asked for. For a deeper pass, run `/5:lean-check` (Codex: `$5-lean-check`).

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

{CUSTOM_DOCUMENTATION}
