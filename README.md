# 5-Phase Workflow

A systematic, AI-assisted feature development workflow for Claude Code that works with any tech stack.

## What is This?

The **5-Phase Workflow** is a structured approach to feature development that breaks down the process into clear, manageable phases:

1. **Feature Planning** - Understand requirements through intensive Q&A
2. **Implementation Planning** - Map requirements to technical components
3. **Orchestrated Implementation** - Execute with state tracking and parallel processing
4. **Verify Implementation** - Automated verification of completeness and correctness
5. **Code Review** - AI-powered review and quality improvements

## Why Use It?

- **Systematic**: Clear phases prevent missing requirements or skipping validation
- **Efficient**: Parallel execution and smart agents minimize context usage
- **Resumable**: State tracking allows pausing and continuing work across sessions
- **Technology-Agnostic**: Works with JavaScript, Python, Java, Go, Rust, and more
- **Transparent**: Visible progress tracking and clear handoffs between phases

## Installation

Install the workflow in your project using npx:

```bash
# Install locally in current project
npx 5-phase-workflow

# Or install globally for all projects
npx 5-phase-workflow --global
```

The installer will:
- Auto-detect your project type (JavaScript, Python, Java, etc.)
- Copy workflow commands, agents, and skills to `.claude/`
- Create a config file at `.claude/.5/config.json`
- Configure build and test commands for your project

## Quick Start

After installation, configure the workflow for your project:

```bash
# Open Claude Code in your project
# Run the configuration wizard
/5:configure
```

Then start your first feature:

```bash
# Phase 1: Plan the feature
/5:plan-feature

# Phase 2: Create implementation plan
/5:plan-implementation {ticket-id}-{description}

# Phase 3: Execute implementation
/5:implement-feature {ticket-id}-{description}

# Phase 4: Verify implementation
/5:verify-implementation

# Phase 5: Review code
/5:review-code
```

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

All commands are available under the `/5:` namespace:

| Command | Phase | Purpose |
|---------|-------|---------|
| `/5:configure` | Setup | Interactive project configuration |
| `/5:plan-feature` | 1 | Create feature specification with Q&A |
| `/5:discuss-feature` | 1 | Refine existing feature spec |
| `/5:plan-implementation` | 2 | Map feature to technical components |
| `/5:implement-feature` | 3 | Execute implementation with agents |
| `/5:verify-implementation` | 4 | Verify completeness and correctness |
| `/5:review-code` | 5 | AI-powered code review (CodeRabbit) |
| `/5:quick-implement` | Fast | Streamlined workflow for small tasks |

## Configuration

The workflow is configured via `.claude/.5/config.json`. Here's an example:

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

The output is a comprehensive feature spec at `.claude/.features/{ticket-id}.md`.

### Phase 2: Implementation Planning

Claude maps your feature to technical components:

- Analyzes your codebase structure
- Identifies affected modules
- Maps components to implementation steps
- Creates dependency graph

The output is an **atomic plan structure** at `.5/{ticket-id}/plan/`:
- `meta.md` - Feature metadata and risks
- `step-1.md`, `step-2.md`, ... - Per-step components with pre-built prompts (YAML format)
- `verification.md` - Build/test configuration

Each step file is self-contained and independently loadable, making large plans manageable and improving agent efficiency.

### Phase 3: Orchestrated Implementation

Claude executes the plan using specialized agents:

- **step-executor**: Creates each component using skills or direct file creation
- **step-verifier**: Compiles and checks for errors after each step
- **integration-agent**: Wires components and registers routes

State is tracked in `.claude/.implementations/state/{ticket-id}.json` for resumability.

### Phase 4: Verify Implementation

An agent performs comprehensive verification:

- All planned files exist
- No compilation/build errors
- Tests pass
- IDE diagnostics clean

Results are saved to a verification report.

### Phase 5: Code Review

Automated review using CodeRabbit (if installed):

- Finds code smells and potential issues
- Suggests improvements
- Applies approved fixes
- Re-verifies after changes

## Project Structure

After installation, your `.claude/` directory will contain:

```
.claude/
├── .5/
│   └── config.json           # Project configuration
├── commands/5/               # Workflow commands
│   ├── plan-feature.md
│   ├── plan-implementation.md
│   ├── implement-feature.md
│   ├── verify-implementation.md
│   ├── review-code.md
│   ├── discuss-feature.md
│   ├── quick-implement.md
│   └── configure.md
├── agents/                   # Specialized agents
│   ├── step-executor.md
│   ├── step-verifier.md
│   ├── integration-agent.md
│   ├── verification-agent.md
│   └── review-processor.md
├── skills/                   # Atomic operations
│   ├── build-project/
│   ├── run-tests/
│   └── generate-readme/
├── hooks/
│   └── statusline.js         # Status line integration
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
3. Update `.claude/.5/config.json` with correct commands

### "Cannot find project type"

The auto-detection failed. Run `/5:configure` and manually select your project type.

### State file issues

If implementation gets stuck:

1. Check `.claude/.implementations/state/{ticket-id}.json`
2. Note the `currentStep` value
3. Run `/5:implement-feature` again - it will resume from that step

### CodeRabbit not working

1. Install: https://docs.coderabbit.ai/cli/installation
2. Authenticate: `coderabbit auth login`
3. Run `/5:configure` to update config

## Updating

To upgrade to the latest version:

```bash
# Uninstall current version
npx 5-phase-workflow --uninstall

# Reinstall latest
npx 5-phase-workflow
```

Your configuration in `.claude/.5/config.json` will be preserved.

## Contributing

Found a bug or have a suggestion? Please open an issue or PR at:
https://github.com/anthropics/claude-code/issues

## License

MIT

## Learn More

- [Full Workflow Guide](./docs/workflow-guide.md) - Detailed documentation
- [Claude Code Docs](https://docs.anthropic.com/claude/docs/claude-code) - Claude Code features
- [Examples](./docs/examples/) - Real-world usage examples

## Credits

Built with [Claude Code](https://claude.com/claude-code) by Anthropic.
