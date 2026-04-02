# 5-Phase Workflow

A systematic, AI-assisted feature development workflow for Claude Code and Codex that works with any tech stack.

## What is This?

The **5-Phase Workflow** is a structured approach to feature development that breaks down the process into clear, manageable phases:

1. **Feature Planning** - Understand requirements through intensive Q&A
2. **Implementation Planning** - Map requirements to technical components
3. **Orchestrated Implementation** - Execute with state tracking and parallel processing
4. **Verify Implementation** - Automated verification of completeness and correctness
5. **Code Review** - AI-powered review, findings annotation, and fix application

## Why Use It?

- **Systematic**: Clear phases prevent missing requirements or skipping validation
- **Efficient**: Parallel execution and smart agents minimize context usage
- **Resumable**: State tracking allows pausing and continuing work across sessions
- **Technology-Agnostic**: Works with JavaScript, Python, Java, Go, Rust, and more
- **Transparent**: Visible progress tracking and clear handoffs between phases

## Installation

Install the workflow in your project using npx:

```bash
# Install locally for Claude Code
npx 5-phase-workflow

# Install locally for Codex
npx 5-phase-workflow --codex

# Or install globally
npx 5-phase-workflow --global
npx 5-phase-workflow --codex --global
```

The installer will:
- For Claude Code: copy workflow commands, agents, and skills to `.claude/`, then set up hooks and settings
- For Codex: convert workflow commands into skills in `.codex/skills/` and generate `.codex/instructions.md`
- Create `.5/features/` directory for feature tracking

**After installation, you must configure your project:**

## Required: Configure Your Project

```bash
# Claude Code
/5:configure

# Codex
$5-configure
```

This will:
- Auto-detect your project type (JavaScript, Python, Java, etc.)
- Set up build and test commands
- Configure ticket tracking patterns
- Generate comprehensive CLAUDE.md documentation
- Generate a rebuildable codebase index in `.5/index/`
- Create project-specific skills (create-component, create-service, etc.)

Follow the standard workflow after configuration:
1. Claude Code: `/5:plan-implementation CONFIGURE`
2. Codex: `$5-plan-implementation CONFIGURE`
3. Claude Code: `/5:implement-feature CONFIGURE`
4. Codex: `$5-implement-feature CONFIGURE`
5. Claude Code: `/5:verify-implementation`
6. Codex: `$5-verify-implementation`

**The workflow is ready to use after completing configuration.**

## Start Your First Feature

After configuration is complete, start your first feature:

```bash
# Claude Code
/5:plan-feature
/5:plan-implementation {ticket-id}-{description}
/5:implement-feature {ticket-id}-{description}
/5:verify-implementation
/5:review-code
/5:address-review-findings

# Codex
$5-plan-feature
$5-plan-implementation {ticket-id}-{description}
$5-implement-feature {ticket-id}-{description}
$5-verify-implementation
$5-review-code
$5-address-review-findings
```

**Tip:** Running `/clear` between phases in Claude Code resets context and keeps conversations focused. In Codex, start a fresh turn or keep the next phase focused. Each phase reads necessary artifacts from previous phases, so no context is lost.

## Supported Tech Stacks

The workflow auto-detects and supports:

**JavaScript/TypeScript**:
- Node.js (npm, yarn, pnpm)
- Next.js
- NestJS
- Express
- React
- Vue

**Python**:
- Django
- Flask
- FastAPI
- Generic Python projects

**Java**:
- Gradle
- Maven
- Spring Boot

**Other**:
- Rust (Cargo)
- Go
- Ruby on Rails
- Custom projects (via manual config)

## Available Commands

Claude Code exposes the workflow under the `/5:` namespace. Codex exposes the same workflow as `$5-...` skills:

| Command | Phase | Purpose |
|---------|-------|---------|
| `/5:configure` or `$5-configure` | Setup | Interactive project configuration |
| `/5:plan-feature` or `$5-plan-feature` | 1 | Create feature specification with Q&A |
| `/5:discuss-feature` or `$5-discuss-feature` | 1 | Refine existing feature spec |
| `/5:plan-implementation` or `$5-plan-implementation` | 2 | Map feature to technical components |
| `/5:implement-feature` or `$5-implement-feature` | 3 | Execute implementation with agents |
| `/5:verify-implementation` or `$5-verify-implementation` | 4 | Verify completeness and correctness |
| `/5:review-code` or `$5-review-code` | 5 | AI-powered code review (Claude, Codex, or CodeRabbit workflows) |
| `/5:address-review-findings` or `$5-address-review-findings` | 5 | Apply annotated findings and address PR comments |
| `/5:quick-implement` or `$5-quick-implement` | Fast | Streamlined workflow for small tasks |
| `/5:eject` or `$5-eject` | Utility | Permanently remove update infrastructure |
| `/5:unlock` or `$5-unlock` | Utility | Remove planning guard lock |

## Configuration

The workflow is configured via `.5/config.json`. Here's an example:

```json
{
  "projectType": "nextjs",
  "ticket": {
    "pattern": "[A-Z]+-\\d+",
    "extractFromBranch": true
  },
  "build": {
    "command": "npm run build",
    "testCommand": "npm test"
  },
  "steps": [
    { "name": "foundation", "mode": "parallel" },
    { "name": "logic", "mode": "sequential" },
    { "name": "integration", "mode": "sequential" }
  ],
  "reviewTool": "coderabbit"
}
```

### Configuration Options

#### Required Fields

- **`projectType`**: Detected project type (e.g., `"nextjs"`, `"django"`, `"rust"`)
- **`build.command`**: Command to build the project
- **`build.testCommand`**: Command to run tests

#### Optional Fields

- **`ticket.pattern`**: Regex pattern for ticket IDs (e.g., `"PROJ-\\d+"`)
- **`ticket.extractFromBranch`**: Auto-extract ticket from branch name
- **`steps`**: Implementation step configuration
- **`framework`**: Framework-specific patterns (routes, models, etc.)
- **`integration`**: Integration point configuration
- **`tools`**: Available development tools (CodeRabbit, IDE, etc.)

Run `/5:configure` to set up or update your configuration.

## How It Works

### Phase 1: Feature Planning

Claude asks 5-10 clarifying questions to understand your requirements:

- What exactly should this feature do?
- What are the edge cases?
- How will we verify it works?
- Are there simpler alternatives?

The output is a comprehensive feature spec at `.5/features/{ticket-id}/feature.md`.

### Phase 2: Implementation Planning

Claude maps your feature to technical components:

- Analyzes your codebase structure
- Identifies affected modules
- Maps components to implementation steps
- Creates dependency graph

The output is an **atomic plan structure** at `.5/features/{ticket-id}/`:
- `feature.md` - Feature specification (Phase 1)
- `plan.md` - Implementation plan (Phase 2)
- `state.json` - Implementation state tracking (Phase 3)

Each step file is self-contained and independently loadable, making large plans manageable and improving agent efficiency.

### Phase 3: Orchestrated Implementation

Claude executes the plan using specialized agents:

- **step-executor**: Creates each component using skills or direct file creation
- **step-verifier**: Compiles and checks for errors after each step
- **integration-agent**: Wires components and registers routes

State is tracked in `.5/features/{ticket-id}/state.json` for resumability.

### Phase 4: Verify Implementation

An agent performs comprehensive verification:

- All planned files exist
- No compilation/build errors
- Tests pass
- IDE diagnostics clean

Results are saved to a verification report.

### Phase 5: Code Review

Two commands work together to handle the review workflow:

**`/5:review-code`** — runs the automated review and presents findings:
- Supports Claude (built-in, no setup) or CodeRabbit CLI
- Reviews staged changes, unstaged changes, or branch diff
- Categorizes findings as Fixable, Questions, or Manual
- Lets you fix immediately or save findings for later

**`/5:address-review-findings`** — applies annotated findings from a saved file:
- Reads the `review-findings-*.md` file generated by `/5:review-code`
- Applies `[FIX]` items, skips `[SKIP]` items, and follows `[MANUAL]` instructions
- Optionally fetches and addresses GitHub PR review comments
- Posts threaded replies to processed PR comments
- Runs build, tests, and lint after applying fixes
- Saves a summary report

## Project Structure

After installation, your `.claude/` directory will contain:

```
.5/
├── config.json               # Project configuration
├── version.json              # Version tracking
├── index/                    # Generated codebase index + rebuild script
│   ├── rebuild-index.sh
│   └── *.md
└── features/                 # Feature tracking

.claude/
├── commands/5/               # Workflow commands
│   ├── plan-feature.md
│   ├── plan-implementation.md
│   ├── implement-feature.md
│   ├── verify-implementation.md
│   ├── review-code.md
│   ├── address-review-findings.md
│   ├── discuss-feature.md
│   ├── quick-implement.md
│   ├── configure.md
│   ├── eject.md
│   └── unlock.md
├── skills/                   # Atomic operations
│   ├── build-project/
│   ├── run-tests/
│   └── generate-readme/
├── hooks/
│   ├── statusline.js         # Status line integration
│   ├── check-updates.js      # Update notifications
│   ├── plan-guard.js         # Planning phase edit guard
│   └── config-guard.js       # Configuration guard
└── settings.json             # Claude Code settings
```

## Examples

### Example 1: Adding a REST API endpoint

```bash
/5:plan-feature
# Claude asks about the endpoint: path, methods, request/response format, validation, etc.
# Creates feature spec

/5:plan-implementation PROJ-1234-add-user-endpoint
# Claude maps to: route file, controller, service, tests
# Creates technical plan

/5:implement-feature PROJ-1234-add-user-endpoint
# Creates route, controller, service, tests
# Registers route in app
# Runs build and tests

/5:verify-implementation
# Verifies all files created
# Checks build passes
# Confirms tests pass
```

### Example 2: Small bug fix

```bash
/5:quick-implement
# Describe the fix
# Claude implements, builds, tests in one step
```

## Troubleshooting

### Build/Test commands not working

1. Run `/5:configure` to verify configuration
2. Test commands manually in terminal
3. Update `.5/config.json` with correct commands

### "Cannot find project type"

The auto-detection failed. Run `/5:configure` and manually select your project type.

### State file issues

If implementation gets stuck:

1. Check `.5/features/{ticket-id}/state.json`
2. Note the `currentStep` value
3. Run `/5:implement-feature` again - it will resume from that step

### CodeRabbit not working

1. Install: https://docs.coderabbit.ai/cli/installation
2. Authenticate: `coderabbit auth login`
3. Run `/5:configure` to update config

## Updating

The workflow automatically detects when a new version is available.

### Automatic Update (Recommended)

```bash
# Interactive upgrade (shows prompt)
npx 5-phase-workflow

# Force upgrade (no prompts)
npx 5-phase-workflow --upgrade

# Check version without updating
npx 5-phase-workflow --check
```

### Legacy Upgrade Method

```bash
npx 5-phase-workflow --uninstall
npx 5-phase-workflow
```

**Note:** During updates:
- Config files in `.5/` are preserved
- User-created commands, agents, skills, hooks, and templates are preserved
- Only workflow-managed files are updated

### Ejecting

If you want to permanently opt out of the update system (e.g., to customize workflow files without future updates overwriting them), run:

```bash
# Claude Code
/5:eject

# Codex
$5-eject
```

This permanently removes the update infrastructure:
- Deletes `check-updates.js` hook, `update.md` and `eject.md` commands
- Deletes `.5/version.json` and `.5/.update-cache.json`
- For Claude Code, removes the update check hook entry from `.claude/settings.json`
- For Codex, removes the converted update/eject skills from `.codex/skills/`

All other workflow files remain untouched. **This is irreversible.** To restore update functionality, reinstall with `npx 5-phase-workflow`.

## Development

### Running Tests

The project includes automated verification to ensure all workflow files are properly configured:

```bash
# Run verification tests
npm test

# Or run directly
bash test/verify-install-js.sh
```

This verifies that all workflow files (commands, agents, skills, hooks, templates) are properly listed in `bin/install.js` for selective updates.

### Continuous Integration

A GitHub Actions workflow runs on every push to verify the install.js configuration. The workflow:
- Checks that all workflow files are listed in `getWorkflowManagedFiles()`
- Ensures selective updates will work correctly
- Prevents accidental omissions that could break user upgrades

See `.github/workflows/test.yml` for details.

### Adding New Workflow Files

When adding new commands, agents, skills, hooks, or templates:

1. Create the file in the appropriate `src/` directory
2. **Update `bin/install.js`** - Add the file to `getWorkflowManagedFiles()`
3. Run `npm test` to verify
4. Commit only if tests pass

See `CLAUDE.md` for detailed development guidelines.

## License

MIT

## Learn More

- [Full Workflow Guide](./docs/workflow-guide.md) - Detailed documentation
- [Claude Code Docs](https://docs.anthropic.com/claude/docs/claude-code) - Claude Code features
