# foifi

## Vision

Install foifi in a project and it sets up Claude Code (or Codex) for you, so you don't have to micromanage the AI setup. The result is an assistant that:

- **plans well**, and backs its plans with diagrams where a picture explains more than text
- **writes good, stable, well-structured, and secure code**, and prefers clean code
- **reviews its own work automatically** before you see it

Two rules keep foifi honest:

- **Stay lean.** What Claude Code already does well — plan mode, code review, exploring the code — foifi uses as it is. foifi adds only the glue: conventions, durable artifacts, and checks. It never runs a parallel process that competes with the native one.
- **Your standards win.** foifi reads the standards a project already has, such as `CONTRIBUTING.md`, a code style guide, or an existing `CLAUDE.md` / `AGENTS.md`, and follows them. It never overwrites them. Its own style rules only fill the gaps a project leaves open.

## Install

```bash
npx foifi              # Claude Code, this project
npx foifi --codex      # Codex
npx foifi --global     # all projects (~/.claude/)
```

Then configure the project once:

```bash
/5:configure
```

This adds the foifi rules to `AGENTS.md` as one marked block, links your existing standards from it, and makes `CLAUDE.md` include it. Nothing else in your files or settings changes.

## Workflow

1. **Plan** — use Claude Code's plan mode (shift+tab). Plans include a mermaid diagram where it helps.
2. **Approve** — Claude runs `/5:implement` on its own: small plans directly, larger ones with parallel agents. It checks that the build and tests pass.
3. **Review** — runs automatically after the implementation: correctness, security, and your standards. Claude fixes the clear findings itself and asks you only about real decisions, one question at a time.

On Codex, start with `$5-plan`; the rest is the same.

## Commands

| Command | Purpose |
|---------|---------|
| `/5:implement [plan]` | Implement a plan (runs automatically after approval) |
| `/5:review [low\|medium\|high\|max]` | Review any change on its own |
| `/5:address-review-findings [--interactive]` | Address saved review findings again; `--interactive` asks about each one |
| `/5:lean-check` | Check a diff for scope drift and over-engineering |
| `/5:analyze-feature` | Document an existing feature with diagrams |
| `/5:configure` / `/5:reconfigure` | Set up the project / refresh the AGENTS.md block and rules |
| `/5:update` / `/5:eject` | Update foifi / stop automatic updates |
| `/5:synchronize-agents` | Sync your own skills and rules between Claude Code and Codex |

Codex uses `$5-…` instead of `/5:…`.

## Updating

```bash
npx foifi --upgrade
npx foifi --codex --upgrade
```

The status line shows when an update is available. Run `/5:reconfigure` after a major version.

## The name

"foifi" is Swiss German for *five*. The name comes from the original 5-phase workflow; the commands still carry the `/5:` prefix.
