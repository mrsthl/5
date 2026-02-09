---
name: 5:configure
description: Configures the project. Analyzes project, gathers preferences, writes config.json, and creates feature spec for remaining setup. Follow up with /5:plan-implementation CONFIGURE.
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
context: inherit
user-invocable: true
---

# Configure (Phase 1 - Plan Feature for Project Configuration)

## Overview

This command is **Phase 1** of the 5-phase workflow applied to project configuration itself. It analyzes the project, asks the user questions, and outputs a feature spec at `.5/features/CONFIGURE/feature.md`.

After running this command, proceed through the standard phases:
1. **`/5:configure`** (this command) - Plan the configuration feature
2. `/5:plan-implementation CONFIGURE` - Create implementation plan
3. `/5:implement-feature CONFIGURE` - Execute configuration (uses `configure-project` skill)
4. `/5:verify-implementation` - Verify configuration
5. `/5:review-code` - Review generated files

## ⚠️ CRITICAL SCOPE CONSTRAINT

**THIS COMMAND WRITES config.json AND CREATES THE FEATURE SPEC. NOTHING ELSE.**

Your job in this command:
✅ Analyze project (detect type, build commands, etc.)
✅ Gather user preferences via questions
✅ Write `.claude/.5/config.json` directly
✅ Create feature spec at `.5/features/CONFIGURE/feature.md` for remaining work
✅ Tell user to run /5:plan-implementation CONFIGURE

Your job is NOT:
❌ Create CLAUDE.md directly (Phase 3 does this)
❌ Generate documentation files directly (Phase 3 does this)
❌ Generate skills directly (Phase 3 does this)
❌ Skip user interaction
❌ Assume project structure

**After writing config.json, creating the feature spec, and informing the user, YOUR JOB IS COMPLETE. EXIT IMMEDIATELY.**

**If you find yourself creating CLAUDE.md, documentation files, or skills, STOP IMMEDIATELY. You should only be writing config.json and the feature spec.**

## Configuration Process

### Step 1: Analyze Project (auto-detect, no user interaction)

Perform all detection silently, collecting results for Step 2.

**1a. Check for existing config:**
```bash
if [ -f ".claude/.5/config.json" ]; then
  # Config exists - will ask user in Step 2 what to do
  config_exists=true
else
  # No config - this is expected for first run after installation
  config_exists=false
fi
```

**1b. Detect project type** by checking files (first match wins):

| File Present | Dependency / Sub-check | Type |
|---|---|---|
| `package.json` | `next` | nextjs |
| `package.json` | `@nestjs/core` | nestjs |
| `package.json` | `express` | express |
| `package.json` | `react` | react |
| `package.json` | `vue` | vue |
| `package.json` | *(none matched)* | javascript |
| `build.gradle(.kts)` | — | gradle-java |
| `pom.xml` | — | maven-java |
| `requirements.txt` / `pyproject.toml` | + `manage.py` | django |
| `requirements.txt` / `pyproject.toml` | + `app.py`/`wsgi.py` | flask |
| `requirements.txt` / `pyproject.toml` | *(none matched)* | python |
| `Cargo.toml` | — | rust |
| `go.mod` | — | go |
| `Gemfile` | + `config/routes.rb` | rails |
| `Gemfile` | *(none matched)* | ruby |

**1c. Detect build/test commands** based on project type:

| Type | Build Command | Test Command |
|------|--------------|--------------|
| javascript | `npm run build` | `npm test` |
| nextjs | `npm run build` | `npm test` |
| nestjs | `npm run build` | `npm test` |
| express | `npm run build \|\| tsc` | `npm test` |
| gradle-java | `./gradlew build -x test -x javadoc --offline` | `./gradlew test --offline` |
| maven-java | `mvn package -DskipTests` | `mvn test` |
| python | `python -m py_compile **/*.py` | `pytest` |
| django | `python manage.py check` | `python manage.py test` |
| rust | `cargo build` | `cargo test` |
| go | `go build ./...` | `go test ./...` |

**1d. Detect available tools:**

```bash
# CodeRabbit CLI
if command -v coderabbit &> /dev/null; then
  coderabbit_available=true
  if coderabbit auth status | grep -q "authenticated"; then
    coderabbit_authenticated=true
  fi
fi

# IDE MCP (JetBrains) - check if MCP tools are available

# Context7 - up-to-date documentation MCP server
# Check if context7 tools are available (resolve-library-id, query-docs)
```

**1e. Check CLAUDE.md:**
- If `CLAUDE.md` exists, read its content

**1f. Scan existing skills:**
- Check `.claude/skills/` for existing project-specific skills

**1g. Detect codebase patterns** for potential skills:

Use Glob to scan for architectural patterns. For each, check both suffix-based (`*{Pattern}.{ts,js,java,py,rb}`) and directory-based (`{patterns}/**`) globs.

**Pattern categories to scan:**
- **Core:** Controllers, Services, Repositories, Models/Entities, Handlers
- **Data Transfer:** DTOs, Requests, Responses, Mappers, Validators, Schemas
- **Frontend:** Components, Hooks, Contexts, Stores, Pages, Layouts
- **API/Routes:** API Routes, Middleware, Guards, Interceptors, Filters
- **Testing:** Tests/Specs, Fixtures, Factories, Mocks
- **Utilities:** Utils, Helpers, Constants, Types/Interfaces, Config
- **Framework-Specific:** Modules, Pipes, Decorators, Blueprints, Views, Serializers
- **Background/Async:** Jobs, Workers, Events, Listeners, Commands
- **Database:** Migrations, Seeds
- **Error Handling:** Exceptions, Errors

For each pattern found: count matching files, identify primary location, sample 1 filename.

**1h. Detect runnable commands** for potential command skills:

Scan config files (`package.json` scripts, `Makefile` targets, `pyproject.toml` scripts, `Cargo.toml`, `build.gradle` tasks, `composer.json` scripts, `Rakefile` tasks) for commands in these categories:

Build, Test, Lint, Format, Type Check, Dev Server, Database (migrate/seed), Docker, Deploy, Clean, Generate

Skill naming: `run-{category}` (e.g., `run-build`, `run-tests`, `run-lint`).

For each command found: record exact syntax, note variants (e.g., `test:unit`, `test:e2e`), and environment requirements. Only include commands that are actually detected.

### Step 2: Gather User Preferences (interactive via AskUserQuestion)

**2a. If config exists:**
"Configuration already exists. What would you like to do?"
- Options:
  - "Update existing configuration" (merge with current values)
  - "Start fresh" (delete and reconfigure from scratch)
  - "Cancel" (exit without changes)

If "Start fresh" selected:
- Confirm: "This will delete existing config. Are you sure?"
- If confirmed: delete .claude/.5/config.json
- Proceed to detection and questions

If "Update existing configuration":
- Read current values
- Pre-fill questions with current values
- Allow user to change any value
- Merge updated values back

If "Cancel": Exit immediately with message "Configuration unchanged."

**2b. Confirm project type:**
- "Detected project type: {detected-type}. Is this correct?"
  - Options: "Yes (recommended)", "No, choose manually"
- If manual, present list: JavaScript/TypeScript, Next.js, NestJS, Express, React, Vue, Java (Gradle), Java (Maven), Python, Django, Flask, Rust, Go, Ruby on Rails, Other

**2c. Ticket ID pattern:**
- "How do you track work items in this project?"
  - Options:
    1. "JIRA-style (e.g., PROJ-1234)" - Pattern: `[A-Z]+-\\d+`
    2. "GitHub Issues (e.g., #123)" - Pattern: `#\\d+`
    3. "Linear (e.g., ENG-1234)" - Pattern: `[A-Z]{3}-\\d+`
    4. "No tracking / skip" - Pattern: null
- Follow-up: "Extract ticket ID from branch name?" - Options: "Yes (recommended)", "No"

**2d. Branch naming convention:**
- "What branch naming convention do you use?"
  - Options:
    1. "ticket-id/description (e.g., PROJ-1234/add-feature)"
    2. "feature/description (e.g., feature/add-login)"
    3. "Custom pattern"
    4. "No convention"

**2e. Confirm build/test commands:**
- "Suggested build command: `{command}`. Use this?"
  - Options: "Yes (recommended)", "Customize", "None (no build step)"
- "Suggested test command: `{command}`. Use this?"
  - Options: "Yes (recommended)", "Customize", "None (no test step)"

**2f. Auto-commit during implementation:**
- "Should Claude make atomic commits during implementation? This creates a commit after each step, enabling progress tracking and easy rollback."
  - Options:
    1. "No (recommended)" → `git.autoCommit: false`
    2. "Yes - commit after each implementation step" → `git.autoCommit: true`

**2g. Commit message pattern (only if auto-commit = Yes):**
- "What commit message format would you like?"
  - Options:
    1. "Default: `{ticket-id} {short-description}` (Recommended)"
    2. "Conventional: `feat({ticket-id}): {short-description}`"
    3. "Custom pattern" → free text
- Note: "Body will automatically include bullet points of changes."

**2h. Review tool preference:**
- "Which code review tool would you like to use?"
  - Options:
    1. "Claude (built-in, no setup needed)" — always available
    2. "CodeRabbit CLI (requires installation)" — external tool
    3. "None (skip automated review)"
- If user selects CodeRabbit and it was not detected in Step 1d:
  - Inform: "CodeRabbit CLI is not installed. You can install it later:"
    - macOS: `brew install --cask coderabbit`
    - Other: `curl -fsSL https://cli.coderabbit.ai/install.sh | sh`
    - Then: `coderabbit auth login`
  - Record the preference as `coderabbit` regardless (will prompt at review time if still missing)

**2i. Context7 documentation plugin:**

Context7 provides up-to-date, version-specific documentation and code examples directly in your prompts. It solves a common problem with LLMs: outdated training data leading to hallucinated APIs and deprecated code patterns.

- If Context7 was detected in Step 1d (resolve-library-id and query-docs tools available):
  - "Context7 is already installed. ✓"
- If Context7 was NOT detected:
  - "Would you like to install Context7? It provides up-to-date, version-specific documentation directly in prompts — helping avoid hallucinated APIs and deprecated patterns."
  - Options:
    1. "Install now (recommended)" — run `claude mcp add context7 -- npx -y @anthropic-ai/claude-code-mcp-server-context7` via Bash
    2. "Skip"
  - If user selects "Install now": execute the install command

**2j. Confirm CLAUDE.md generation:**
- "Generate/update CLAUDE.md? This will analyze your codebase to document structure and conventions."
  - Options: "Yes (recommended)", "Skip"

**2k. Review detected patterns for skill generation:**

Present ONLY patterns that were actually detected in steps 1g and 1h.

**Part 1: Architectural patterns (create-* skills)**

"I analyzed your codebase and found these architectural patterns:

| Pattern | Files Found | Location | Example |
|---------|-------------|----------|---------|
| Controller | 12 files | src/controllers/ | UserController.ts |
| Service | 8 files | src/services/ | AuthService.ts |
| Component | 25 files | src/components/ | Button.tsx |

Which patterns would you like `create-*` skills generated for?"

- Options: Multi-select checkboxes for each detected pattern (use AskUserQuestion with multiSelect: true)
- Include descriptions like: "Controller (12 files) - Generate `create-controller` skill"
- Plus "Other" option for patterns not detected but desired

**Part 2: Command skills (run-* skills)**

"I also found these runnable commands:

| Command | Source | Full Command | Variants |
|---------|--------|--------------|----------|
| build | package.json | npm run build | build:prod, build:dev |
| test | package.json | npm test | test:unit, test:e2e |
| lint | package.json | npm run lint | lint:fix |
| format | Makefile | make format | - |

Which commands would you like `run-*` skills generated for?"

- Options: Multi-select checkboxes for each detected command
- Include descriptions like: "test - Generate `run-tests` skill"
- Plus "Other" option for commands not detected

If no patterns/commands detected:
- Inform user: "No common patterns detected. Would you like to specify patterns manually?"
- Allow manual entry of pattern names/locations or command names

### Step 2.5: Write config.json

Using the values gathered from Steps 1 and 2, write `.claude/.5/config.json` directly.

**If "Update existing" flow:** Read current config, merge updated values.
**If "Start fresh" or new install:** Write new config.

**Ensure directory exists:**
```bash
mkdir -p .claude/.5
```

**Schema:**

```json
{
  "projectType": "{type}",
  "ticket": {
    "pattern": "{regex-pattern-or-null}",
    "extractFromBranch": true
  },
  "branch": {
    "convention": "{convention}"
  },
  "build": {
    "command": "{build-command}",
    "testCommand": "{test-command}",
    "timeout": {
      "compile": 120000,
      "test": 300000
    }
  },
  "tools": {
    "coderabbit": {
      "available": false,
      "authenticated": false
    },
    "ide": {
      "available": false,
      "type": null
    },
    "context7": {
      "available": false
    }
  },
  "reviewTool": "claude",
  "git": {
    "autoCommit": false,
    "commitMessage": {
      "pattern": "{ticket-id} {short-description}"
    }
  }
}
```

Fill all values from user responses. Write with pretty-printed JSON. Read back to verify correctness.

### Step 3: Create Feature Spec

Write `.5/features/CONFIGURE/feature.md` containing all gathered data:

```markdown
# Feature: Project Configuration

## Summary
Generates CLAUDE.md with codebase analysis and creates project-specific skills. (config.json already written.)

## Requirements

### Requirement 1: Generate Documentation Files
Analyze the codebase and generate modular documentation:

**Create separate documentation files in `.5/` folder:**
- `.5/ARCHITECTURE.md` - Architectural patterns and layers
- `.5/STACK.md` - Technology stack and dependencies
- `.5/STRUCTURE.md` - Directory layout and organization
- `.5/CONVENTIONS.md` - Coding standards and patterns
- `.5/TESTING.md` - Test framework and patterns
- `.5/INTEGRATIONS.md` - External services and APIs
- `.5/CONCERNS.md` - Tech debt, bugs, and risks

**Create CLAUDE.md as navigation hub:**
- Quick reference section with links to all `.5/*.md` files
- Project overview and build commands
- "Getting Started" guide with references to appropriate files
- Mandatory coding guidelines:
  1. Types should be clear and types should be available when possible
  2. Use doc (jsdoc, javadoc, pydoc, etc) concisely. No doc is better than meaningless doc
  3. Keep files short and structured
  4. Extract methods, classes
  5. Respect SRP and DRY
  6. Make code maintainable and modular

**Preserve existing content:**
- If CLAUDE.md already exists, preserve user-written custom sections

### Requirement 2: Generate Project-Specific Skills

**Create-* skills** for each user-selected architectural pattern:
- Skill name: `create-{pattern}` (e.g., `create-controller`, `create-service`)
- Analyze 2-3 existing files, extract conventions, generate SKILL.md with project-specific template
- Set `user-invocable: true`, `model: haiku`

**Run-* skills** for each user-selected command:
- Skill name: `run-{category}` (e.g., `run-tests`, `run-lint`)
- Document exact command syntax, variants, flags
- Set `user-invocable: true`, `model: haiku`

Include only patterns/commands where user selected "Generate".

## Acceptance Criteria
- [ ] `.5/` directory created
- [ ] All 7 documentation files exist and are populated:
  - [ ] `.5/ARCHITECTURE.md`
  - [ ] `.5/STACK.md`
  - [ ] `.5/STRUCTURE.md`
  - [ ] `.5/CONVENTIONS.md`
  - [ ] `.5/TESTING.md`
  - [ ] `.5/INTEGRATIONS.md`
  - [ ] `.5/CONCERNS.md`
- [ ] `CLAUDE.md` exists with references to `.5/` files
- [ ] CLAUDE.md contains 6 coding guidelines
- [ ] No placeholder text like `{YYYY-MM-DD}` remains unfilled
- [ ] All specified project-specific skills are generated in `.claude/skills/`
- [ ] Generated skills reference actual project conventions
- [ ] If CLAUDE.md existed before, user-written sections are preserved
```

**Important:** Use `mkdir -p .5/features/CONFIGURE` before writing the feature spec.

### Step 4: Guide User to Next Phase

Tell the user:

1. "Configuration saved to `.claude/.5/config.json`"
2. "Configuration feature planned at `.5/features/CONFIGURE/feature.md`"
3. "Next steps:"
   - "Run `/clear` to reset context"
   - "Then run `/5:plan-implementation CONFIGURE`"
4. "After that: Continue with `/5:implement-feature CONFIGURE` -> `/5:verify-implementation` -> `/5:review-code` (clearing context between each phase)"

## Related Documentation

- [5-Phase Workflow Guide](../../docs/workflow-guide.md)
- [configure-project skill](../../skills/configure-project/SKILL.md)
- [/5:plan-feature command](./plan-feature.md)
- [/5:plan-implementation command](./plan-implementation.md)
