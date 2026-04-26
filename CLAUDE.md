# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the **5-Phase Workflow** package - a systematic, AI-assisted feature development workflow for Claude Code. It's an npm package that installs commands, agents, skills, and hooks into `.claude/` directories to enable structured feature development.

**Key Concept:** This is NOT a traditional application to run/build. It's an installer that copies workflow files to users' projects. The workflow files (commands, agents, skills) are written in Markdown and consumed by Claude Code.

---

### ⚠️ CRITICAL DEVELOPMENT RULE

**ALWAYS check and update `bin/install.js` when making changes to workflow files!**

When you add, rename, or remove ANY file in:
- `src/commands/5/`
- `src/skills/`
- `src/hooks/`
- `src/templates/`

You **MUST** update the `getWorkflowManagedFiles()` function in `bin/install.js` to include it in the selective update system.

Always ensure the changes are compatible with **Claude and Codex**.

---

## Commands for Development

### Installation Testing

```bash
# Test local installation (in another project directory)
node bin/install.js

# Test with different options
node bin/install.js --global
node bin/install.js --uninstall
node bin/install.js --upgrade
node bin/install.js --check     # Check if update is available
```

### Package Testing

```bash
# Test the package locally via npx
npm link
npx 5-phase-workflow

# Or test directly
npm pack
# This creates a .tgz file you can install elsewhere
```

### Testing

```bash
npm test              # Run all tests
npm run test:install  # Verify install.js file list matches src/
npm run test:hook     # Test check-updates hook
npm run test:update   # Test update system
```

There is no build step. The workflow files are static Markdown copied during installation.

## Architecture

### Directory Structure

```
src/
├── commands/5/              # User-facing workflow commands
│   ├── configure.md         # Initial project setup
│   ├── reconfigure.md       # Re-run configuration
│   ├── plan-feature.md      # Phase 1: Feature planning
│   ├── plan-implementation.md # Phase 2: Implementation planning
│   ├── implement-feature.md # Phase 3: Orchestrated implementation
│   ├── verify-implementation.md # Phase 4: Verification
│   ├── review-code.md       # Phase 5: Code review
│   ├── address-review-findings.md # Fix review findings
│   ├── discuss-feature.md   # Feature discussion
│   ├── quick-implement.md   # Lightweight implementation
│   ├── unlock.md            # Unlock stuck workflows
│   └── update.md            # Update workflow version
│
├── skills/                  # Atomic operations
│   ├── build-project/
│   ├── run-tests/
│   ├── configure-docs-index/
│   ├── configure-skills/
│   └── generate-readme/
│
├── templates/               # Output templates
│   ├── workflow/            # Workflow output templates (PLAN.md, STATE.json, etc.)
│   ├── ARCHITECTURE.md      # Project documentation templates
│   ├── CONCERNS.md
│   ├── CONVENTIONS.md
│   ├── INTEGRATIONS.md
│   ├── STACK.md
│   ├── STRUCTURE.md
│   └── TESTING.md
│
├── hooks/
│   ├── statusline.js        # Status line integration
│   ├── check-updates.js     # Update notifications
│   ├── check-reconfig.js    # Reconfiguration prompts
│   ├── config-guard.js      # Configuration enforcement
│   └── plan-guard.js        # Plan phase enforcement
│
└── settings.json            # Claude Code settings

bin/
└── install.js               # Main installer script
```

### The 5-Phase Workflow

1. **Feature Planning** (`/5:plan-feature`)
   - Intensive Q&A (5-10 questions) to understand requirements
   - Challenges assumptions, explores edge cases
   - Creates feature spec at `.5/features/{ticket-id}/feature.md`

2. **Implementation Planning** (`/5:plan-implementation`)
   - Quick codebase scan to understand structure
   - Asks 2-3 technical questions
   - Creates simple plan at `.5/features/{ticket-id}/plan.md`
   - Plan describes WHAT to build, not complete code

3. **Orchestrated Implementation** (`/5:implement-feature`)
   - Reads plan.md
   - Spawns agents for each step (instructions embedded inline)
   - Agents explore codebase to find patterns
   - State tracked in `.5/features/{ticket-id}/state.json`

4. **Verify Implementation** (`/5:verify-implementation`)
   - Checks files exist
   - Runs build and tests
   - Generates verification report

5. **Code Review** (`/5:review-code`)
   - Runs CodeRabbit CLI (optional)
   - Categorizes findings
   - Applies approved fixes

**Context Management:** Running `/clear` between phases is optional. Phase 1→2 benefits from keeping context (plan-implementation detects live context and skips redundant steps). For Phase 2→3 and later, `/clear` is recommended to free context for implementation agents. Each phase is designed to work both with and without prior context.

### Key Design Patterns

#### Simple Plan Format

Phase 2 creates a single `plan.md` file:

```markdown
---
ticket: PROJ-1234
feature: PROJ-1234-add-schedule
created: 2026-01-28T10:00:00Z
---

# Implementation Plan: PROJ-1234

Add emergency schedule tracking.

## Components

| Step | Component | Action | File | Description | Pattern File | Verify | Complexity | Depends On |
|------|-----------|--------|------|-------------|-------------|--------|------------|------------|
| 1 | Schedule model | create | src/models/Schedule.ts | Schedule entity | src/models/User.ts | `grep -q 'class Schedule' src/models/Schedule.ts` | simple | — |
| 2 | Schedule service | create | src/services/ScheduleService.ts | CRUD + validation | src/services/UserService.ts | `npm test -- Schedule` | moderate | Schedule model |

## Implementation Notes

- [global] Follow pattern from src/services/UserService.ts
- [schedule-service] Date validation: endDate > startDate

## Verification

- Build: npm run build
- Test: npm test
```

**Key principle:** The plan describes WHAT to build. Agents figure out HOW by exploring existing code.

#### State Tracking

Simple state file (`.5/features/{feature-name}/state.json`):

```json
{
  "ticket": "PROJ-1234",
  "feature": "PROJ-1234-add-schedule",
  "status": "in-progress",
  "currentStep": 1,
  "completed": ["schedule-model"],
  "failed": [],
  "startedAt": "2026-01-28T10:30:00Z"
}
```

#### Agent Pattern

Agents explore the codebase to find patterns:
- Find similar files using Glob
- Read existing code to understand conventions
- Create new files following those patterns

#### Dynamic Model Selection

Each component in the plan has a `Complexity` column:
- **simple** → haiku (fast, cheap) - pattern-following, types, simple CRUD
- **moderate** → haiku or sonnet depending on context
- **complex** → sonnet (better reasoning) - business logic, integrations, refactoring

The orchestrator (`implement-feature`) selects the model per component.

#### Parallel Execution

Components within the same step are independent and run in parallel:

```
Step 1: [Model, Types] ← 2 parallel haiku agents
Step 2: [Service, Repository] ← 2 parallel agents
Step 3: [Controller, Routes] ← may be sequential if dependent
```

Plan structure determines parallelization:
- Group independent components in the same step → parallel
- Separate dependent components into different steps → sequential

## Installation and Configuration

### Required First Step: Configure

After installing the workflow with `node bin/install.js` or `npx 5-phase-workflow`, you **must** run the configure command:

```bash
/5:configure
```

**What configure does:**
1. Analyzes project (detects type, build commands, tools)
2. Gathers user preferences (ticket patterns, branch conventions, review tool)
3. Detects and optionally installs optional plugins (context7, skill-creator)
4. Creates feature spec at `.5/features/CONFIGURE/feature.md`
5. User runs standard workflow: plan-implementation → implement → verify
6. Results in: config.json, CLAUDE.md, a rebuildable `.5/index/` codebase index, and project-specific skills

### Optional Plugins

Configure detects and offers to install optional Claude plugins that enhance the workflow:

- **context7** (`context7@mcp-official`): Provides up-to-date, version-specific documentation during implementation. Detected by checking for `resolve-library-id` / `query-docs` tools.
- **skill-creator** (`skill-creator@claude-plugins-official`): Improves quality of generated project-specific skills. When available, the `configure-skills` skill uses its tools (`create-skill`, `scaffold-skill`) instead of template-based generation. Detected by checking for `create-skill` / `scaffold-skill` tools in the session.

Plugin availability is stored in `.5/config.json` under `tools.context7.available` and `tools.skillCreator.available`.

### Installation Process (bin/install.js)

The installer:

1. **Parses Arguments**: `--global`, `--local`, `--uninstall`, `--upgrade`, `--check`
2. **Detects Project Type**: Examines package.json, pom.xml, Cargo.toml, etc.
3. **Copies Directories**: Commands, agents, skills, hooks, templates → target `.claude/`
4. **Merges settings.json**: Preserves user settings
5. **Tracks Version**: In `.5/version.json`

**Selective Updates:** Only workflow-managed files are updated. User-created content is preserved.

## Working with Commands

Commands are Markdown files with YAML frontmatter:

```markdown
---
name: 5:plan-feature
description: Plans feature implementation...
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion
context: fork
user-invocable: true
---

# Command Content

Instructions for Claude Code...
```

## Spawned Agents

Commands spawn agents via the Task tool with inline instructions:
- Instructions are embedded directly in the Task prompt
- No separate agent files needed
- Agents run in forked context
- Explore codebase to find patterns
- Create/modify files following conventions

## Important Constraints

### Always Update install.js

When adding/removing/renaming workflow files, update `getWorkflowManagedFiles()` in `bin/install.js`.

### File Naming Conventions

- Commands: `kebab-case.md`
- Agents: `kebab-case.md`
- Skills: `kebab-case/` directories with `SKILL.md`
- All command names namespaced under `5:` prefix

## Versioning & Publishing

**NEVER manually update the `version` field in `package.json`.** The version is bumped automatically during the release process.

1. Add release notes to `RELEASE_NOTES.md`
2. Commit & Push (Don't mention Claude in the commits)
3. Create a new Release in GitHub

## References

- Full workflow guide: `docs/workflow-guide.md`
- Installation script: `bin/install.js`
- Example command: `src/commands/5/plan-feature.md`
