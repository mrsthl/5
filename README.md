# foifi

**foifi** is an opinionated AI development workflow layer that sits on top of Claude Code and Codex. It handles project setup, structured feature implementation, and code review — so you spend less time managing the AI and more time shipping.

### What it does

**Project setup** — The `/5:configure` command detects your stack, generates a `CLAUDE.md` / `AGENTS.md` tailored to your project, writes a `.5/index/` knowledge base, and installs project-specific skills and rules. This gives every AI session the right context from the start rather than letting the model guess.

**Status line** — foifi installs a Claude Code status line that surfaces the installed version, available updates, and pending reconfigure/migration reminders directly in the terminal footer.

**Structured implementation workflow** — Instead of asking Claude or Codex to "just implement this," foifi enforces a three-phase loop:
1. **Plan** (`/5:plan`) — wraps Claude Code's native plan mode and persists the approved result as a single human-reviewed `plan.md` with scope, acceptance criteria, component checklist, and decisions. Run it again on the same feature to refine that plan. Small plans are implemented right there on approval; larger ones hand off to step 2.
2. **Implement** (`/5:implement`) — an orchestrator agent turns the plan into a typed execution graph, then delegates each component to a focused executor agent, firing independent components in parallel waves. A verification agent checks completeness, correctness, and test coverage at the end of every run.
3. **Review** (`/5:review`) — wraps Claude Code's built-in `code-review` skill, produces structured findings, and feeds them into `/5:address-review-findings` for interactive fix decisions and PR replies.

This separation keeps planning readable, implementation mechanical, and review structured. Where Claude Code ships a native capability, foifi wraps it rather than reimplementing it — what foifi adds is the durable repo-local artifact and the ticket/config conventions around it.

**Code review and findings** — `/5:review` triages changed files and produces structured `review-findings-*.md`. `/5:address-review-findings` presents each finding interactively, records `fix`/`wont_fix`/`wait` decisions, applies approved local fixes, handles PR comment replies, and keeps a decision log — all without losing context between sessions.

**Plan management helpers** — `/5:split` breaks a large plan into smaller linked child plans. `/5:reconfigure` refreshes docs and skills when the project evolves.

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

Configuration writes `.5/config.json` and `.5/features/CONFIGURE/plan.md`. Then run:

```bash
/5:implement CONFIGURE
# or
$5-implement CONFIGURE
```

That generates project documentation, a rebuildable `.5/index/`, AGENTS.md, a CLAUDE.md shim, and selected project-specific skills/rules.

## Workflow

```bash
/5:plan
/5:split {feature-name}
/5:implement {feature-name}
/5:review
/5:address-review-findings {feature-name}
```

Codex equivalents:

```bash
$5-plan
$5-split {feature-name}
$5-implement {feature-name}
$5-review
$5-address-review-findings {feature-name}
```

Verification runs at the end of `/5:implement` and records a concise result in `state.json`.

## Commands

| Command | Purpose |
|---------|---------|
| `/5:configure` / `$5-configure` | Detect project settings and write the CONFIGURE plan |
| `/5:plan` / `$5-plan` | Create one unified `plan.md` from requirements, codebase exploration, and user decisions — or refine an existing one |
| `/5:split` / `$5-split` | Split an existing plan into smaller linked plans for separate implementation |
| `/5:implement` / `$5-implement` | Derive the execution graph, execute steps with agents, and verify inline |
| `/5:review` / `$5-review` | Review code changes and save findings |
| `/5:lean-check` / `$5-lean-check` | Check any diff for scope drift and over-engineering — works without a plan |
| `/5:commit` / `$5-commit` | Create a git commit using the configured commit message template |
| `/5:address-review-findings` / `$5-address-review-findings` | Decide on review findings interactively, then apply approved fixes and PR comments |
| `/5:reconfigure` / `$5-reconfigure` | Refresh docs, index, skills, and rules |
| `/5:update` / `$5-update` | Upgrade installed workflow files |
| `/5:eject` / `$5-eject` | Stop workflow-managed updates |
| `/5:synchronize-agents` / `$5-synchronize-agents` | Sync user content between Claude Code and Codex |

## Artifacts

Each feature lives under `.5/features/{feature-name}/`:

- `plan.md` - single human-reviewed planning artifact
- `codebase-scan.md` - cached discovery used to reduce repeated scanning
- `state.json` - small resume record: status, completed components, verification result
- `split-manifest-*.json` - parent feature record for child plans created by `/5:split`
- `review-findings-*.md` - review output for `/5:address-review-findings`
- `review-decisions-*.json` - interactive fix/wont-fix/wait decisions for local findings
- `pr-comment-decisions.json` - PR review comment decisions when PR handling is used

## Design

Planning stays human-readable. Claude Code's native plan mode does the exploring, the asking, and the approval gate; `/5:plan` contributes the ticket lookup, the feature folder convention, and the artifact schema, then persists the approved plan. `plan.md` contains scope, acceptance criteria, decisions, module impact, and a clean component checklist. Small low-risk changes can use the compact plan template. Plans intentionally do not ask the planner to fill model choices, verify commands, step grouping, or pattern-file wiring.

Delegation is matched to the size of the job. Approving a plan means you want it built, so `/5:plan` finishes compact plans itself — for one or two files, the already-warm session beats anything an orchestrator can set up. Full plans go to `/5:implement`, where the cost is repaid: `step-orchestrator-agent` reads `plan.md` and `codebase-scan.md` and returns an execution graph, then each component goes to a `step-executor-agent` with an inline executor contract, independent components firing in parallel. Pattern context is passed as targeted references instead of broad file lists so executors read only the relevant ranges, and mechanical components run on a cheaper model than the ones that need reasoning.

State is kept to what is actually read. The execution graph is derived fresh on every run and never written to disk; `state.json` persists only the status, the completed component names, and the verification result, which is all a resume needs. Component names are copied verbatim from the plan's checklist, so a re-derived graph still matches what already ran. Live progress comes from the task list, not from a file.

Verification uses a dedicated agent. `/5:implement` runs `verification-agent` at the end, passing it the pre-change baseline so pre-existing failures are not blamed on the change, and records a concise final status without generating an extra report.

Review delegates to Claude Code's built-in `code-review` skill (default effort `high`, override with `/5:review {low|medium|high|max}`) and maps its findings into the workflow's findings file. Where that skill is unavailable — Codex, for example — a built-in review agent takes over and triages changed files by risk instead. `/5:address-review-findings` presents each finding one by one with a recommendation, records `fix`/`wont_fix`/`wait` decisions, then coordinates narrower helpers for approved local fixes, PR comment triage, and PR replies so the common path stays compact.

Scope drift is checked, not just discouraged, and not only inside the workflow. The generated `AGENTS.md` carries a simplicity ladder and a "check your own diff before finishing" rule for every session. `/5:lean-check` checks any diff against the request for drift, new dependencies, and over-engineering. On Claude Code, the `dependency-guard` Stop hook makes Claude justify or remove any dependency the uncommitted diff adds, once per session; Codex gets the same rule through its generated instructions. Inside `/5:implement`, executors report what they deliberately skipped and verification reports `SCOPE: passed | drift`.

Reconfiguration uses a compact `.5/reconfigure-manifest.json` to pass refresh decisions to documentation and skill generation helpers without duplicating long detection summaries in prompts.

For Codex installs, the workflow is token-budgeted: exploration, orchestration, and simple executors default to `gpt-5.4-mini` with low reasoning. Complex logic, security-sensitive work, data migrations, public API changes, final verification that needs deeper review, and failed retries escalate to `gpt-5.4` with medium reasoning.

## Updating

```bash
npx foifi --upgrade
npx foifi --codex --upgrade
```

v2.0.0 is a hard migration. Finish in-progress v1.9.5 features before upgrading; v1 `feature.md` and old `state.json` formats are not supported.
