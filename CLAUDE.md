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
- `src/agents/`
- `src/skills/`
- `src/hooks/`
- `src/templates/`

You **MUST** update the `getWorkflowManagedFiles()` function in `bin/install.js` to include it in the selective update system. Otherwise:
- ❌ New files won't be installed during user upgrades
- ❌ Renamed files will leave orphaned copies
- ❌ Users will run outdated versions of your changes

**See "Important Constraints" section below for detailed instructions.**

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

### 4-Layer System

The workflow uses a layered architecture where each layer has specific responsibilities:

```
Developer
    ↓
Commands (thin orchestrators, main context)
    ↓
Agents (heavy lifting, forked contexts, haiku model)
    ↓
Skills (atomic operations, called by agents)
    ↓
Tools (file I/O, bash, IDE integration)
```

**Why this architecture?**
- Commands stay in main context and remain thin (just orchestration)
- Agents do heavy work in forked contexts using haiku (token efficiency)
- Skills are reusable atomic operations
- Clear separation of concerns

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
├── agents/              # Specialized agents (forked contexts)
│   ├── step-executor.md        # Executes components
│   ├── step-verifier.md        # Builds/checks files
│   ├── integration-agent.md    # Wires components
│   ├── verification-agent.md   # Full verification
│   ├── review-processor.md     # Processes CodeRabbit
│   └── step-fixer.md           # Fixes build errors
│
├── skills/              # Atomic operations
│   ├── build-project/
│   ├── run-tests/
│   ├── configure-project/
│   └── generate-readme/
│
├── templates/           # Documentation templates
│   ├── ARCHITECTURE.md
│   ├── CONVENTIONS.md
│   ├── TESTING.md
│   └── ...
│
├── hooks/
│   └── statusline.js   # Status line integration
│
└── settings.json       # Claude Code settings

bin/
└── install.js          # Main installer script

docs/
└── workflow-guide.md   # Comprehensive workflow documentation
```

### The 5-Phase Workflow

1. **Feature Planning** (`/5:plan-feature`)
   - Intensive Q&A (5-10 questions) to understand requirements
   - Challenges assumptions, explores edge cases
   - Creates feature spec at `.5/{ticket-id}/feature.md`

2. **Implementation Planning** (`/5:plan-implementation`)
   - Maps feature to technical components
   - Identifies dependencies and execution order
   - Creates **atomic plan structure** at `.5/{ticket-id}/plan/`:
     - `meta.md` - feature metadata and risks
     - `step-N.md` - per-step components with pre-built prompts (YAML format)
     - `verification.md` - build/test configuration
   - Each step file is self-contained and independently loadable

3. **Orchestrated Implementation** (`/5:implement-feature`)
   - Command reads `plan/meta.md` for overview
   - Loads each `plan/step-N.md` on-demand during execution
   - Parses YAML components and delegates to agents
   - `step-executor` creates components using pre-built prompts
   - `step-verifier` builds and checks after each step
   - `integration-agent` wires everything together
   - State tracked in `.5/{ticket-id}/state.json`

4. **Verify Implementation** (`/5:verify-implementation`)
   - Reads `plan/verification.md` for build/test config
   - Aggregates expected files from all `plan/step-N.md` files
   - `verification-agent` checks all files exist
   - Runs build and tests
   - Generates verification report

5. **Code Review** (`/5:review-code`)
   - `review-processor` runs CodeRabbit CLI
   - Categorizes findings
   - Applies approved fixes

### Key Design Patterns

#### Atomic Plan Structure (Format Version 2.0)

Phase 2 creates an atomic, modular plan structure instead of a monolithic file:

**Directory structure:**
```
.5/{feature-name}/
├── plan/
│   ├── meta.md              # Feature metadata (YAML frontmatter + risks)
│   ├── step-1.md            # Step 1 components (YAML frontmatter + components YAML block)
│   ├── step-2.md            # Step 2 components
│   ├── step-N.md            # Step N components
│   └── verification.md      # Build/test config
├── state.json               # Implementation state tracking
├── feature.md               # From Phase 1 (feature spec)
└── verification.md          # From Phase 4 (verification report)
```

**Benefits:**
- **Modularity**: Each step is independently loadable
- **Scalability**: Large plans (50+ components) remain manageable
- **Navigation**: Developers can quickly find specific steps
- **Agent Efficiency**: Agents load only the step they need (smaller context)
- **Version Control**: Smaller diffs when steps change
- **Resumability**: Easier to resume from any step

**File formats:**
- `meta.md`: YAML frontmatter with feature, ticket, total_steps, total_components + risks section
- `step-N.md`: YAML frontmatter (step, name, mode) + components YAML block + expected outputs
- `verification.md`: Build/test commands and expected file lists (Markdown)

#### Pre-built Prompts
Phase 2 creates complete, self-contained prompts for each component. Agents in Phase 3 execute these prompts without exploring the codebase. This minimizes context usage.

#### State Tracking
Each feature has a state file (`.5/{feature-name}/state.json`) that tracks:
- Current step
- Completed/pending components
- Failed attempts
- Verification results

This enables resuming interrupted work across sessions.

#### Agent Spawning Pattern
Commands use the Task tool to spawn agents in forked contexts:
```markdown
Task tool with:
- subagent_type: "general-purpose"
- model: "haiku" (for token efficiency)
- prompt: Complete instructions + step block from plan
```

#### Configuration System
Projects configure the workflow via `.claude/.5/config.json`:
- Project type detection (Next.js, Django, Rust, etc.)
- Build/test commands
- Ticket pattern extraction
- Framework-specific patterns

#### Version Tracking
The installer automatically tracks installed versions in `.5/version.json`:
- Enables automatic update detection
- Shows update notifications during workflow usage
- Preserves user config during updates

## Installation Process (bin/install.js)

The installer follows this flow:

1. **Parse Arguments**: `--global`, `--local`, `--uninstall`, `--upgrade`, `--check`
2. **Version Detection**: Checks for existing installation and compares versions
3. **Detect Project Type**: Examines package.json, pom.xml, Cargo.toml, etc.
4. **Copy Directories**: Commands, agents, skills, hooks, templates → target `.claude/`
5. **Deep Merge settings.json**: Preserves nested user settings (recursive merge)
6. **Create config.json**: At `.claude/.5/config.json` with detected build/test commands
7. **Initialize version.json**: Tracks installed version and update check metadata

**Target Paths:**
- Global: `~/.claude/`
- Local: `./.claude/` (default)

**Update Behavior:**
- Detects existing installations and prompts for update
- Uses `--upgrade` flag to auto-update without prompting
- Preserves `.5/` directory (config, feature state files)
- Deep merges settings.json to preserve nested customizations
- **Selective updates**: Only updates workflow-managed files, preserves user-created content

**Preserved During Updates:**
- User-created commands (e.g., `commands/mycompany/`)
- User-created agents (e.g., `agents/my-agent.md`)
- User-created skills (e.g., `skills/my-skill/`)
- User-created hooks (e.g., `hooks/my-hook.js`)
- User-created templates (e.g., `templates/MY_TEMPLATE.md`)
- All config and feature state in `.5/` directory

**Updated During Updates:**
- `commands/5/` - Workflow commands only
- Specific workflow agents: `step-executor.md`, `step-verifier.md`, `integration-agent.md`, etc.
- Specific workflow skills: `build-project/`, `run-tests/`, `configure-project/`, `generate-readme/`
- Specific workflow hooks: `statusline.js`, `check-updates.js`
- Specific workflow templates: `ARCHITECTURE.md`, `CONVENTIONS.md`, `TESTING.md`, etc.

**Uninstall:** Removes workflow directories but preserves user config.

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

**Important:**
- Commands orchestrate but don't do heavy work themselves
- They spawn agents via Task tool for intensive operations
- They maintain state files and report progress to users

## Working with Agents

Agents are Markdown files designed for forked contexts:

```markdown
---
name: step-executor
description: Executes components...
tools: Skill, Read, Write, Edit, Glob, Grep
model: haiku
---

# Agent Instructions

Detailed instructions for what the agent should do...
```

**Agent Rules:**
- Run in forked context (isolated from main)
- Use haiku model for token efficiency
- Receive structured input, produce structured output
- Don't explore codebase (use pre-built prompts from plan)

## Working with Skills

Skills are atomic operations in their own directories:

```
skills/build-project/
├── SKILL.md        # Skill definition
└── EXAMPLES.md     # (optional) Usage examples
```

**Skill Pattern:**
- Small, focused operations
- Called by agents, not directly by users
- Framework-agnostic when possible

## Project Type Detection

The installer auto-detects project types by examining files:

| File | Detected Type |
|------|---------------|
| package.json + next dependency | nextjs |
| package.json + express dependency | express |
| package.json + @nestjs/core | nestjs |
| package.json (other) | javascript |
| build.gradle / build.gradle.kts | gradle-java |
| pom.xml | maven-java |
| Cargo.toml | rust |
| go.mod | go |
| requirements.txt + manage.py | django |
| requirements.txt + app.py | flask |
| requirements.txt (other) | python |

Each type gets default build/test commands in the config.

## Version Tracking System

The installer automatically tracks installed versions in `.5/version.json`.

### For Package Maintainers

When releasing a new version:
1. Update `package.json` version field
2. Add release notes to `RELEASE_NOTES.md`
3. Commit and tag: `git tag v1.x.x && git push --tags`
4. Publish: `npm publish`

Users will automatically see update notifications on next command execution.

### Version File Format

```json
{
  "packageVersion": "1.0.1",
  "installedVersion": "1.0.1",
  "installedAt": "2026-02-02T10:30:00Z",
  "lastUpdated": "2026-02-02T10:30:00Z",
  "installationType": "local",
  "updateCheckLastRun": "2026-02-02T10:35:00Z",
  "updateCheckFrequency": 86400
}
```

**Fields:**
- `packageVersion`: Version from package.json at install time
- `installedVersion`: Currently installed version (updated during upgrades)
- `installedAt`: Timestamp of initial installation
- `lastUpdated`: Timestamp of last update
- `installationType`: "local" or "global"
- `updateCheckLastRun`: Last time hook checked for updates
- `updateCheckFrequency`: Seconds between update checks (default: 86400 = 24h)

### Update Detection Flow

1. User runs `npx 5-phase-workflow`
2. Installer reads `.5/version.json` to get installed version
3. Compares with package.json version
4. If newer version available:
   - Shows prompt: "Update to latest version? (Y/n)"
   - User confirms or cancels
   - Performs update (preserves config)
5. If `--upgrade` flag used, skips prompt

### Update Notification Hook

The `check-updates.js` hook runs on every command start:
- Checks if 24h has passed since last check
- Compares installed vs available version
- Shows notification if update available
- Updates `updateCheckLastRun` timestamp

## Common Patterns

⚠️ **CRITICAL:** When adding **any** new workflow file (command, agent, skill, hook, or template), you **MUST** update `bin/install.js` to ensure it gets updated during user upgrades. See details below.

### Adding a New Phase
1. Create command in `src/commands/5/{phase-name}.md`
2. Define agent if needed in `src/agents/{agent-name}.md`
3. **UPDATE `bin/install.js`:** If adding a new agent, add it to `getWorkflowManagedFiles()` agents list
4. Update README.md workflow diagram

### Adding a New Project Type
1. Add detection logic in `detectProjectType()` (bin/install.js)
2. Add default config in `getDefaultConfig()` (bin/install.js)
3. Update README.md supported tech stacks section

### Adding a New Skill
1. Create directory: `src/skills/{skill-name}/`
2. Add `SKILL.md` with skill definition
3. Optionally add `EXAMPLES.md` for usage guidance
4. **UPDATE `bin/install.js`:** Add skill name to `getWorkflowManagedFiles()` skills list

### Adding a New Agent
1. Create file: `src/agents/{agent-name}.md`
2. Define agent with YAML frontmatter
3. **UPDATE `bin/install.js`:** Add `{agent-name}.md` to `getWorkflowManagedFiles()` agents list

### Adding a New Hook
1. Create file: `src/hooks/{hook-name}.js`
2. Make it executable: `chmod +x src/hooks/{hook-name}.js`
3. **UPDATE `bin/install.js`:** Add `{hook-name}.js` to `getWorkflowManagedFiles()` hooks list
4. Update `src/settings.json` if needed for hook configuration

### Adding a New Template
1. Create file: `src/templates/{TEMPLATE_NAME}.md`
2. **UPDATE `bin/install.js`:** Add `{TEMPLATE_NAME}.md` to `getWorkflowManagedFiles()` templates list

## State File Format

Implementation state is tracked at `.5/{feature-name}/state.json`:

```json
{
  "ticketId": "PROJ-1234",
  "featureName": "proj-1234-add-feature",
  "phase": "implementation",
  "status": "in-progress",
  "currentStep": 2,
  "totalSteps": 3,
  "completedComponents": ["component-1", "component-2"],
  "pendingComponents": ["component-3", "component-4"],
  "failedAttempts": [],
  "verificationResults": {},
  "startedAt": "2025-01-15T10:30:00Z",
  "lastUpdated": "2025-01-15T10:45:00Z"
}
```

## Important Constraints

### ⚠️ CRITICAL: Always Update install.js

**When making ANY change to this project that adds/removes/renames workflow files, you MUST update `bin/install.js`:**

1. **Adding new workflow files?**
   - Update `getWorkflowManagedFiles()` function
   - Add your file to the appropriate list (agents, skills, hooks, templates)
   - This ensures the file gets updated during user upgrades

2. **Renaming workflow files?**
   - Update the file name in `getWorkflowManagedFiles()`
   - Otherwise old file won't be removed, new file won't be installed

3. **Removing workflow files?**
   - Remove from `getWorkflowManagedFiles()`
   - Consider if old file should be deleted during upgrade

**Why this matters:**
- The installer uses selective updates to preserve user-created content
- Only files listed in `getWorkflowManagedFiles()` are updated
- Forgetting to update this list means users won't get your new files during upgrades
- This could cause silent failures or version mismatches

**Check before every commit:**
```bash
# Run the verification script
npm test

# Or run directly:
bash test/verify-install-js.sh

# Or manually check if you added/changed files in:
src/commands/5/
src/agents/
src/skills/
src/hooks/
src/templates/

# Then verify getWorkflowManagedFiles() in:
bin/install.js
```

**Verification script:** `test/verify-install-js.sh` automatically checks that all workflow files are listed in install.js. Run it before every commit that modifies workflow files.

### Don't Make These Changes
- **Don't add a build step** - files must remain static Markdown
- **Don't add tests** - workflow validation happens through usage
- **Don't add dependencies** - installer uses only Node.js stdlib
- **Don't change agent contexts** - agents must run in forked context with haiku

### File Naming Conventions
- Commands: `kebab-case.md`
- Agents: `kebab-case.md`
- Skills: `kebab-case/` directories with `SKILL.md`
- All command names namespaced under `5:` prefix

## Versioning & Publishing

Package version is in `package.json`. To release:

1. **Verify install.js is up to date:**
   ```bash
   # Run the verification script (REQUIRED before every release)
   npm test

   # This script checks that all workflow files are listed in getWorkflowManagedFiles()
   # If it fails, update bin/install.js before proceeding
   ```

2. Update version in package.json

3. Add release notes to `RELEASE_NOTES.md`

4. Commit changes

5. Tag and push: `git tag v1.x.x && git push --tags`

6. Publish: `npm publish`

Users upgrade by running `npx 5-phase-workflow` (will prompt) or `npx 5-phase-workflow --upgrade` (auto-updates).

## Troubleshooting Development

### Testing Installation
Always test the installer in a separate directory:
```bash
cd /tmp/test-project
node /path/to/this/repo/bin/install.js
ls -la .claude/
```

### Debugging Commands
Commands run in Claude Code context. To debug:
1. Install workflow in a test project
2. Open Claude Code in that project
3. Run command: `/5:command-name`
4. Check Claude Code output and agent results

### Verifying Files
After making changes:
```bash
# Check that all referenced files exist
grep -r "src/commands" bin/install.js
grep -r "src/agents" bin/install.js
grep -r "src/skills" bin/install.js
```

## References

- Full workflow guide: `docs/workflow-guide.md`
- Installation script: `bin/install.js`
- Example command: `src/commands/5/plan-feature.md`
- Example agent: `src/agents/step-executor.md`
- Example skill: `src/skills/build-project/SKILL.md`
