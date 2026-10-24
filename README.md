# foifi

## Vision

Install foifi in a project and it sets up Claude Code (or Codex) for you, so you don't have to micromanage the AI setup. The result is an assistant that:

- **plans well**, and backs its plans with diagrams where a picture explains more than text
- **writes good, stable, well-structured, and secure code**, and prefers clean code
- **reviews its own work automatically** before you see it

Two rules keep foifi honest:

- **Stay lean.** What Claude Code already does well — plan mode, code review, exploring the code — foifi uses as it is. foifi adds only the glue: conventions, durable artifacts, and checks. It never runs a parallel process that competes with the native one.
- **Your standards win.** foifi reads the standards a project already has, such as `CONTRIBUTING.md`, a code style guide, or an existing `CLAUDE.md` / `AGENTS.md`, and follows them. It never overwrites them. Its own style rules only fill the gaps a project leaves open.

## Overview

**foifi** is an opinionated AI development workflow layer that sits on top of Claude Code and Codex. It handles project setup, structured feature implementation, and code review — so you spend less time managing the AI and more time shipping.

### What it does

**Project setup** — The `/5:configure` command detects your stack, adds the workflow rules to `AGENTS.md` as one marked block that links your repository's own standards, points Claude Code's plan mode at `.5/planning/`, and generates file-scoped rules from your conventions. Nothing outside that block changes: an existing `CLAUDE.md` only gets an `@AGENTS.md` line if it lacks one, and settings you already set, such as your own status line, are kept. Every AI session gets the rules that matter from the start; the code itself it explores on demand.

**Clean code by default** — foifi ships review styles as skills: `fowler-code-smells`, `cognitive-load`, `documentation-style`, and `baseline-conventions`. `review-style` checks a change against them and against the repository's own standards, such as `CONTRIBUTING.md` or `CODESTYLE.md`. Repository standards always win. Where a repository documents nothing, the styles still keep the codebase clean.

**Status line** — foifi installs a Claude Code status line that surfaces the installed version, available updates, and pending reconfigure/migration reminders directly in the terminal footer. If you already have a status line, yours stays.

**Structured implementation workflow** — Instead of asking Claude or Codex to "just implement this," foifi enforces a three-phase loop:
1. **Plan** (`/5:plan`) — wraps Claude Code's native plan mode, which saves the approved plan in `.5/planning/`: one human-reviewed file with scope, acceptance criteria, component checklist, decisions, and a mermaid diagram where the change has a flow worth drawing. Run it again on the same feature, or on any plan file, to refine that plan. Small plans are implemented right there on approval; larger ones hand off to step 2.
2. **Implement** (`/5:implement`) — an orchestrator agent turns the plan into a typed execution graph, then delegates each component to a focused executor agent, firing independent components in parallel waves. A verification agent checks completeness, correctness, and test coverage at the end of every run, and `review-style` checks the change against the repository's standards and the style skills.
3. **Review** (`/5:review`) — wraps Claude Code's built-in `code-review` skill for correctness, its `security-review` skill for security-sensitive changes, and `review-style` for standards, produces structured findings, and feeds them into `/5:address-review-findings` for interactive fix decisions.

This separation keeps planning readable, implementation mechanical, and review structured. Where Claude Code ships a native capability, foifi wraps it rather than reimplementing it — what foifi adds is the durable repo-local artifact and the ticket/config conventions around it.

**Code review and findings** — `/5:review` produces structured `review-findings-*.md`. `/5:address-review-findings` presents each finding interactively, records `fix`/`wont_fix`/`wait` decisions, applies the approved fixes, and verifies the result — all without losing context between sessions.

**Diagrams** — Plans carry a mermaid diagram when a flow, state machine, or component relationships explain the change better than text. `/5:analyze-feature` documents an existing feature or dataflow end-to-end with mermaid diagrams.

**Maintenance** — `/5:reconfigure` refreshes the AGENTS.md block and the generated rules when the project evolves, and is the upgrade path after a major update.

**Codex support** — Every command has a `$5-*` Codex equivalent. Codex runs are token-budgeted: simple steps use a lighter model and low reasoning, complex or security-sensitive steps escalate automatically.

### The name

"foifi" is Swiss German for *five*. The name comes from the project's original 5-phase workflow. That workflow has since been streamlined into the current 3-phase plan → implement → review loop, but the name stuck — and all commands still carry the `/5:` prefix.

## Install

```bash
npx foifi
npx foifi --codex
```

Global installs are also supported:

```bash
npx foifi --global
npx foifi --codex --global
```

Claude Code installs commands under `.claude/`. Codex installs converted skills under `.codex/skills/`.

## Configure

Run configuration once per project:

```bash
/5:configure
# or in Codex
$5-configure
```

Configuration writes `.5/config.json`, sets `plansDirectory` to `.5/planning` in `.claude/settings.json`, and writes `.5/planning/CONFIGURE.md`. Then run:

```bash
/5:implement CONFIGURE
# or
$5-implement CONFIGURE
```

That writes the foifi block into AGENTS.md, makes CLAUDE.md include AGENTS.md, and generates the selected scoped rules.

## Workflow

```bash
/5:plan
/5:implement {feature-name}
/5:review
/5:address-review-findings {feature-name}
```

Codex equivalents:

```bash
$5-plan
$5-implement {feature-name}
$5-review
$5-address-review-findings {feature-name}
```

Verification runs at the end of `/5:implement` and records a concise result in `state.json`. A standards review with `review-style` follows and asks which findings to fix.

## Commands

| Command | Purpose |
|---------|---------|
| `/5:configure` / `$5-configure` | Detect project settings and write the CONFIGURE plan |
| `/5:plan` / `$5-plan` | Create one plan in `.5/planning/` from requirements, codebase exploration, and user decisions — or refine an existing one |
| `/5:implement` / `$5-implement` | Derive the execution graph, execute steps with agents, and verify inline |
| `/5:review` / `$5-review` | Review code changes for correctness and standards, and save findings |
| `/5:lean-check` / `$5-lean-check` | Check any diff for scope drift and over-engineering — works without a plan |
| `/5:address-review-findings` / `$5-address-review-findings` | Decide on review findings interactively, then apply the approved fixes |
| `/5:analyze-feature` / `$5-analyze-feature` | Document a feature or dataflow with mermaid diagrams |
| `/5:reconfigure` / `$5-reconfigure` | Refresh the AGENTS.md block and the generated rules |
| `/5:update` / `$5-update` | Upgrade installed workflow files |
| `/5:eject` / `$5-eject` | Stop workflow-managed updates |
| `/5:synchronize-agents` / `$5-synchronize-agents` | Sync user content between Claude Code and Codex |

## Artifacts

Plans live in `.5/planning/`. Claude Code's plan mode names the files; the `feature` field in each plan's frontmatter ties it to its feature.

Each feature's runtime state lives under `.5/features/{feature-name}/`:

- `state.json` - small resume record: status, completed components, verification result
- `review-findings-*.md` - review output for `/5:address-review-findings`
- `review-decisions-*.json` - interactive fix/wont-fix/wait decisions

## Design

Planning stays human-readable. Claude Code's native plan mode does the exploring, the asking, and the approval gate, and saves the plan in `.5/planning/`; `/5:plan` contributes the ticket lookup, the feature name, and the plan schema. There is no second copy and no scan cache: what the implementation needs, such as the patterns to follow, goes into the plan itself. The plan contains scope, acceptance criteria, decisions, module impact, and a clean component checklist. Small low-risk changes can use the compact plan template. Plans intentionally do not ask the planner to fill model choices, verify commands, step grouping, or pattern-file wiring.

Delegation is matched to the size of the job. Approving a plan means you want it built, so `/5:plan` finishes compact plans itself — for one or two files, the already-warm session beats anything an orchestrator can set up. Full plans go to `/5:implement`, where the cost is repaid: `step-orchestrator-agent` reads the plan and returns an execution graph, then each component goes to a `step-executor-agent` with an inline executor contract, independent components firing in parallel. Pattern context is passed as targeted references instead of broad file lists so executors read only the relevant ranges, and mechanical components run on a cheaper model than the ones that need reasoning.

State is kept to what is actually read. The execution graph is derived fresh on every run and never written to disk; `state.json` persists only the status, the completed component names, and the verification result, which is all a resume needs. Component names are copied verbatim from the plan's checklist, so a re-derived graph still matches what already ran. Live progress comes from the task list, not from a file.

Verification uses a dedicated agent. `/5:implement` runs `verification-agent` at the end, passing it the pre-change baseline so pre-existing failures are not blamed on the change, and records a concise final status without generating an extra report.

Standards come in a fixed order. The repository's own standards always win. The style skills set the baseline wherever the repository says nothing, and the workflow's rules in `AGENTS.md` apply on top. Executors read the standards that apply to their target before writing code. After every implementation, `review-style` runs one reviewer for the repository standards and one per style, and reports each finding as a hard breach or a judgement call.

Review delegates to Claude Code's built-in `code-review` skill (default effort `high`, override with `/5:review {low|medium|high|max}`) and maps its findings into the workflow's findings file. Where that skill is unavailable — Codex, for example — a built-in review agent takes over and triages changed files by risk instead. When the diff touches authentication, user input, secrets, cryptography, or SQL/shell/path construction, the built-in `security-review` skill runs as well; `/5:implement` does the same at the end of a run. `/5:address-review-findings` presents each finding one by one with a recommendation, records `fix`/`wont_fix`/`wait` decisions, applies the approved fixes, and verifies the result. For comments on a GitHub PR, ask Claude directly.

Scope drift is checked, not just discouraged, and not only inside the workflow. The generated `AGENTS.md` carries a simplicity ladder and a "check your own diff before finishing" rule for every session. `/5:lean-check` checks any diff against the request for drift, new dependencies, and over-engineering. On Claude Code, the `dependency-guard` Stop hook makes Claude justify or remove any dependency the uncommitted diff adds, once per session; Codex gets the same rule through its generated instructions. Inside `/5:implement`, executors report what they deliberately skipped and verification reports `SCOPE: passed | drift`.

Reconfiguration uses a compact `.5/reconfigure-manifest.json` to pass refresh decisions to the AGENTS.md and rule generation helpers without duplicating long detection summaries in prompts.

foifi generates no project-specific skills. Claude explores the code itself, and per-pattern skills went stale like the codebase index did. Build and test commands and the commit convention live in the AGENTS.md block instead. Skills from earlier versions stay untouched.

foifi no longer generates a codebase index or architecture, testing, concerns, and conventions docs. Agents explore the code on demand, and generated summaries went stale. Existing `.5/*.md` docs stay untouched and linked, since a team may maintain them.

For Codex installs, the workflow is token-budgeted: exploration, orchestration, and simple executors default to `gpt-5.4-mini` with low reasoning. Complex logic, security-sensitive work, data migrations, public API changes, final verification that needs deeper review, and failed retries escalate to `gpt-5.4` with medium reasoning.

## Updating

```bash
npx foifi --upgrade
npx foifi --codex --upgrade
```