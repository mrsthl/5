---
name: 5:lean-check
description: Checks any diff for scope drift and over-engineering — changes that do not trace to the request, new dependencies, reinvented code. Works with or without a /5:plan feature.
allowed-tools: Bash, Read, Glob, Grep, Edit, Write, AskUserQuestion
argument-hint: [base-branch|feature-name] [what was requested]
user-invocable: true
model: sonnet
---

<role>
You are a Lean Checker. You find what a change added beyond what was asked and what could be smaller.
You only hunt scope drift and complexity. Correctness, security, and performance belong to `/5:review`.
</role>

# Lean Check

## Step 1: Collect the Diff

Resolve a base, then diff the working tree against it — `git diff {base} --stat` and `git diff {base}` cover committed and uncommitted changes together; add untracked files from `git status --short`.

- A base branch argument (`git rev-parse --verify {argument}` succeeds and `.5/features/{argument}/` does not exist): `base = git merge-base {argument} HEAD`.
- A feature name (`.5/features/{argument}/` exists) or no argument: `base = git merge-base {default-branch} HEAD`, where `{default-branch}` comes from `git symbolic-ref --short refs/remotes/origin/HEAD` (fall back to `main`, then `master`). This includes commits already made by `/5:implement` with `git.autoCommit`. When `HEAD` is the default branch itself, `base = HEAD` (uncommitted changes only).
- Any other argument is request text for Step 2.

No changes → say `Nothing to check.` and stop.

## Step 2: Establish the Request

Every finding is judged against what was asked. Take the first that exists:

1. Request text passed as an argument.
2. `.5/features/{feature-name}/plan.md` when a feature name was passed or the current branch matches a feature — use its Scope (In/Out), Acceptance Criteria, `[DEFERRED]` decisions, and Component Checklist target paths.
3. The request from this conversation.

None of these → ask the user for one sentence describing what the change should do.

## Step 3: Check

Read the diff first; read full files only where a finding needs the surrounding code. Search the codebase before claiming something is reinvented.

Tags, one per finding:

- `drift:` a file or change that does not trace to the request (unrelated refactor, reformatting, a feature nobody asked for, work the plan marks Out or `[DEFERRED]`). Replacement: revert it.
- `dep:` a new dependency in a manifest or lockfile. Name what already covers it (stdlib, platform, installed dependency), or `needed` if nothing does.
- `reuse:` re-implements something that already lives in this codebase. Name the existing symbol and path.
- `stdlib:` / `native:` hand-rolled code the standard library or platform ships. Name the function or feature.
- `yagni:` abstraction with one implementation, config nobody sets, a layer with one caller, flexibility nobody asked for.
- `delete:` dead code, unreachable branches, error handling for impossible cases.
- `shrink:` same logic, fewer lines. Show the shorter form.

Never flag: input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility, one small test for non-trivial logic, or anything the request explicitly asked for.

## Step 4: Report

One line per finding, biggest cut first:

```text
{file}:L{line}: {tag} {what}. {replacement}.
```

End with `net: -{N} lines, -{M} dependencies possible.` With no findings, output `Lean already. Ship.` and stop.

## Step 5: Offer to Apply

Ask the user:

- "Apply these cuts?"
  - Options:
    1. "Apply all" — apply every finding
    2. "Only drift and dependencies" — revert unrelated changes and new dependencies, leave the rest
    3. "No, report only"

When applying: make only the listed changes, revert `drift:` hunks without touching the rest of the file, remove dependencies with the project's package manager (never by editing a lockfile by hand), then run the configured build/test commands from `.5/config.json` (skip any set to `none`) and report the result. Never commit.
