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

---

## Commands for Development

### Installation Testing

```bash
# Test local installation (in another project directory)
node bin/install.js

# Test with different options
node bin/install.js --global
node bin/install.js --uninstall
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

### No Build/Test Commands

This package has no build step, test suite, or runtime. The files are static Markdown that get copied during installation.

## Architecture

### Directory Structure

```
src/
├── commands/5/          # User-facing workflow commands
│   ├── configure.md
│   ├── plan-feature.md          # Phase 1
│   ├── plan-implementation.md   # Phase 2
│   ├── implement-feature.md     # Phase 3
│   ├── verify-implementation.md # Phase 4
│   ├── review-code.md           # Phase 5
│   ├── discuss-feature.md
│   └── quick-implement.md
│
├── skills/              # Atomic operations
│   ├── build-project/
│   ├── run-tests/
│   ├── configure-project/
│   └── generate-readme/
│
├── templates/           # Output templates
│   ├── workflow/        # Workflow output templates
│   └── ...              # Project documentation templates
│
├── hooks/
│   ├── statusline.js    # Status line integration
│   └── check-updates.js # Update notifications
│
└── settings.json        # Claude Code settings

bin/
└── install.js           # Main installer script
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

**Context Management:** It's recommended to run `/clear` between each phase to reset context. This keeps conversations focused, prevents context pollution, and improves efficiency. Each phase is designed to be self-contained and will read the necessary artifacts from previous phases.

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

| Step | Component | Action | File | Description | Complexity |
|------|-----------|--------|------|-------------|------------|
| 1 | Schedule model | create | src/models/Schedule.ts | Schedule entity | simple |
| 2 | Schedule service | create | src/services/ScheduleService.ts | CRUD + validation | moderate |

## Implementation Notes

- Follow pattern from src/services/UserService.ts
- Date validation: endDate > startDate

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
3. Creates feature spec at `.5/features/CONFIGURE/feature.md`
4. User runs standard workflow: plan-implementation → implement → verify
5. Results in: config.json, CLAUDE.md, project-specific skills

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

1. Update version in package.json
2. Add release notes to `RELEASE_NOTES.md`
3. Commit and tag: `git tag v1.x.x && git push --tags`
4. Publish: `npm publish`

## References

- Full workflow guide: `docs/workflow-guide.md`
- Installation script: `bin/install.js`
- Example command: `src/commands/5/plan-feature.md`
