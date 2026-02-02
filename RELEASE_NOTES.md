# Release Notes

## v1.1.1

**Release Date:** February 2, 2026

### Bug Fixes

**Hook Configuration**
- Fixed invalid hook event name in `settings.json` (changed `onCommandStart` to `SessionStart`)
- Corrected hook structure to use proper nesting format as per Claude Code hooks specification
- Update check hook now runs correctly when sessions start or resume

---

## v1.1.0

**Release Date:** February 2, 2026

### What's New

**Automatic Update Detection**
- New `check-updates.js` hook automatically notifies users when updates are available
- Version tracking in `.5/version.json` with 24-hour check frequency
- Smart update prompts during installation
- `--upgrade` flag for automatic updates without prompting

**Selective Update System**
- Preserves user-created commands, agents, skills, hooks, and templates during updates
- Only updates workflow-managed files, protecting custom content
- Deep merge of settings.json to preserve nested user customizations
- Automated test suite to verify update behavior (`test/test-update-system.sh`)

**Atomic Plan Structure (Format Version 2.0)**
- Switched from monolithic `plan.md` to modular plan directory structure:
  - `plan/meta.md` - Feature metadata and risks
  - `plan/step-N.md` - Individual step components (independently loadable)
  - `plan/verification.md` - Build/test configuration
- Improved scalability for large plans (50+ components)
- Smaller context usage - agents load only the step they need
- Better version control with smaller diffs
- Easier resumability from any step

**Agent Color Coding**
- Assigned unique colors to all agents for better visual categorization
- Improved agent identification in logs and status displays

**Context Management Improvements**
- Added clear context suggestions after each phase completion
- Helps users manage context usage more effectively
- Prevents context overflow in complex workflows

**Development Infrastructure**
- Added comprehensive `CLAUDE.md` with development guidelines
- Automated verification script (`test/verify-install-js.sh`) to ensure workflow files are properly tracked
- GitHub Actions CI workflow for automated testing
- Enhanced contribution guidelines and architectural documentation

### Improvements

**Installation & Updates**
- Enhanced `bin/install.js` with version comparison and update detection
- Better handling of existing installations
- Improved user experience during updates with clear prompts

**Documentation**
- Extensive updates to README.md with update behavior details
- Enhanced workflow-guide.md with atomic plan structure documentation
- Better contribution guidelines for maintainers

**Phase Commands**
- Updated `/5:plan-implementation` to generate atomic plan structure
- Updated `/5:implement-feature` to load steps on-demand from atomic plan
- Updated `/5:verify-implementation` to aggregate files from step files
- Enhanced verification agent to work with new plan format

### Bug Fixes

- Fixed potential issues with nested settings.json preservation during updates
- Improved error handling in version detection

---

## v1.0.1

**Release Date:** February 2, 2026

### What's New

**Documentation**
- Added `RELEASE_NOTES.md`
- Added repository URL to `package.json`

---

## v1.0.0

**Release Date:** February 2, 2026

## Overview

We're excited to announce the first release of **5-Phase Workflow** - a systematic, AI-assisted feature development workflow for Claude Code that works with any tech stack.

## What's New

### Initial Release Features

**Complete 5-Phase Development Workflow**
- **Phase 1: Feature Planning** - Intensive Q&A to understand requirements and create comprehensive specs
- **Phase 2: Implementation Planning** - Map requirements to technical components with dependency tracking
- **Phase 3: Orchestrated Implementation** - Execute with state tracking and parallel processing using specialized agents
- **Phase 4: Verify Implementation** - Automated verification of completeness, compilation, and tests
- **Phase 5: Code Review** - AI-powered review with CodeRabbit integration

**Universal Tech Stack Support**
- **JavaScript/TypeScript**: Node.js, Next.js, NestJS, Express, React, Vue (npm, yarn, pnpm)
- **Python**: Django, Flask, FastAPI, generic Python projects
- **Java**: Gradle, Maven, Spring Boot
- **Rust**: Cargo-based projects
- **Go**: Go modules
- **Ruby**: Rails
- **Custom projects**: Manual configuration support

**Smart Installation**
- One-command installation via `npx 5-phase-workflow`
- Auto-detects project type and tech stack
- Configures build and test commands automatically
- Supports local (per-project) or global installation

**Workflow Commands**
- `/5:configure` - Interactive project configuration wizard
- `/5:plan-feature` - Create feature specifications through guided Q&A
- `/5:discuss-feature` - Refine existing feature specs
- `/5:plan-implementation` - Generate technical implementation plans
- `/5:implement-feature` - Execute implementations with agent orchestration
- `/5:verify-implementation` - Automated verification of completeness and correctness
- `/5:review-code` - AI-powered code review with CodeRabbit
- `/5:quick-implement` - Streamlined workflow for small tasks

**Specialized Agents**
- `step-executor` - Execute implementation components using skills
- `step-verifier` - Build verification after each step
- `integration-agent` - Wire components and register routes
- `verification-agent` - Comprehensive implementation verification
- `review-processor` - Parse and categorize CodeRabbit findings

**Built-in Skills**
- `build-project` - Execute project build commands
- `run-tests` - Execute test suites
- `generate-readme` - Auto-generate README files
- `configure-project` - Interactive project configuration

**State Management & Resumability**
- JSON-based state tracking for all implementations
- Resume interrupted work across sessions
- Progress tracking with visible task lists
- Context usage monitoring

**Configuration System**
- Auto-detection of project type and framework
- Customizable ticket ID patterns
- Configurable implementation steps (parallel/sequential)
- Support for branch-based ticket extraction
- Framework-specific pattern recognition

## Key Benefits

- **Systematic**: Clear phases prevent missing requirements or skipping validation
- **Efficient**: Parallel execution and smart agents minimize context usage
- **Resumable**: State tracking allows pausing and continuing work across sessions
- **Technology-Agnostic**: Works with any programming language or framework
- **Transparent**: Visible progress tracking and clear handoffs between phases

## Installation

```bash
# Install locally in current project
npx 5-phase-workflow

# Or install globally for all projects
npx 5-phase-workflow --global
```

## Quick Start

```bash
# Configure the workflow for your project
/5:configure

# Start your first feature
/5:plan-feature
/5:plan-implementation {ticket-id}-{description}
/5:implement-feature {ticket-id}-{description}
/5:verify-implementation
/5:review-code
```

## Project Structure

After installation, your `.claude/` directory will contain:
- Commands for all 5 phases
- Specialized agents for heavy lifting
- Reusable skills for atomic operations
- Project configuration
- Templates for common patterns

## Documentation

- [README.md](README.md) - Complete feature overview and quick start
- [docs/workflow-guide.md](docs/workflow-guide.md) - Detailed workflow documentation
- In-workflow guidance through each command

## Requirements

- Claude Code CLI
- Node.js 16.7.0 or higher (for installation)
- Git (for state management and version control)
- CodeRabbit CLI (optional, for Phase 5 code review)

## Known Limitations

- CodeRabbit integration requires separate CLI installation
- State files are local and not synced across machines
- Verification depends on project having working build/test commands

## What's Next

We're actively working on:
- Additional language support
- Enhanced IDE integrations
- More built-in skills for common operations
- Improved state synchronization
- Plugin system for custom agents

## Feedback & Contributions

Found a bug or have a suggestion? Please open an issue at:
https://github.com/mrsthl/5

## License

MIT License - See [LICENSE](LICENSE) for details

---

Built with [Claude Code](https://claude.com/claude-code) by Anthropic.
