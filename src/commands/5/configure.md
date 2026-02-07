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

**1b. Detect project type** by examining files:

```javascript
// Node.js/JavaScript/TypeScript
if (exists('package.json')) {
  const pkg = readJSON('package.json');

  if (pkg.dependencies?.['next'] || pkg.devDependencies?.['next'])
    return 'nextjs';
  if (pkg.dependencies?.['@nestjs/core'])
    return 'nestjs';
  if (pkg.dependencies?.['express'])
    return 'express';
  if (pkg.dependencies?.['react'])
    return 'react';
  if (pkg.dependencies?.['vue'])
    return 'vue';

  return 'javascript';
}

// Java
if (exists('build.gradle') || exists('build.gradle.kts'))
  return 'gradle-java';
if (exists('pom.xml'))
  return 'maven-java';

// Python
if (exists('requirements.txt') || exists('pyproject.toml')) {
  if (exists('manage.py')) return 'django';
  if (exists('app.py') || exists('wsgi.py')) return 'flask';
  return 'python';
}

// Rust
if (exists('Cargo.toml'))
  return 'rust';

// Go
if (exists('go.mod'))
  return 'go';

// Ruby
if (exists('Gemfile')) {
  if (exists('config/routes.rb')) return 'rails';
  return 'ruby';
}

return 'unknown';
```

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

Use Glob to count files matching common architectural patterns:

| Pattern | Glob Patterns                                                                 | Typical Location |
|---------|-------------------------------------------------------------------------------|------------------|
| **Core Architecture** |                                                                               | |
| Controllers | `**/*Controller.{ts,js,java,py,rb}`, `**/controllers/**`                      | src/controllers/ |
| Services | `**/*Service.{ts,js,java,py,rb}`, `**/services/**`                            | src/services/ |
| Repositories | `**/*Repository.{ts,js,java,py}`, `**/repositories/**`                        | src/repositories/ |
| Models/Entities | `**/*Model.{ts,js}`, `**/*Entity.java`, `**/models/**`                        | src/models/ |
| Handlers | `**/*Handler.{ts,js,java,go}`, `**/handlers/**`                               | src/handlers/ |
| **Data Transfer** |                                                                               | |
| DTOs | `**/*Dto.{ts,js,java}`, `**/*DTO.{ts,js,java}`, `**/dto/**`                   | src/dto/ |
| Requests | `**/*Request.{ts,js,java}`, `**/requests/**`                                  | src/requests/ |
| Responses | `**/*Response.{ts,js,java}`, `**/responses/**`                                | src/responses/ |
| Mappers | `**/*Mapper.{ts,js,java}`, `**/mappers/**`                                    | src/mappers/ |
| Validators | `**/*Validator.{ts,js,java}`, `**/validators/**`                              | src/validators/ |
| Schemas | `**/*Schema.{ts,js}`, `**/schemas/**`                                         | src/schemas/ |
| **Frontend (React/Vue)** |                                                                               | |
| Components | `**/components/**/*.{tsx,jsx,vue}`                                            | src/components/ |
| Hooks | `**/hooks/**/*.{ts,js}`, `**/use*.{ts,js}`                                    | src/hooks/ |
| Contexts | `**/contexts/**/*.{tsx,jsx}`, `**/*Context.{tsx,jsx}`                         | src/contexts/ |
| Stores | `**/stores/**/*.{ts,js}`, `**/*Store.{ts,js}`                                 | src/stores/ |
| Pages | `**/pages/**/*.{tsx,jsx}`, `**/app/**/page.{tsx,jsx}`                         | pages/, app/ |
| Layouts | `**/layouts/**/*.{tsx,jsx,vue}`, `**/*Layout.{tsx,jsx}`                       | src/layouts/ |
| **API/Routes** |                                                                               | |
| API Routes | `**/api/**/*.{ts,js}`, `**/routes/**`                                         | src/api/, pages/api/ |
| Middleware | `**/*Middleware.{ts,js,java}`, `**/middleware/**`                             | src/middleware/ |
| Guards | `**/*.guard.{ts,js}`, `**/guards/**`                                          | src/guards/ |
| Interceptors | `**/*.interceptor.{ts,js}`, `**/interceptors/**`                              | src/interceptors/ |
| Filters | `**/*.filter.{ts,js}`, `**/*Filter.java`                                      | src/filters/ |
| **Testing** |                                                                               | |
| Tests | `**/*.test.{ts,js,tsx,jsx}`, `**/*.spec.{ts,js,tsx,jsx}`, `**/tests/**`       | src/, tests/ |
| Specs | `**/*_spec.rb`, `**/spec/**/*.rb`, `**/*_test.go`, `**/test_*.py`             | spec/, tests/ |
| Test Fixtures | `**/fixtures/**`,`**/testFixtures/**`, `**/__fixtures__/**`, `**/testdata/**` | fixtures/, testdata/ |
| Factories | `**/*Factory.{ts,js,java,rb}`, `**/factories/**`                              | factories/ |
| Mocks | `**/__mocks__/**`, `**/mocks/**`, `**/*Mock.{ts,js}`                          | __mocks__/, mocks/ |
| **Utilities** |                                                                               | |
| Utils | `**/utils/**/*.{ts,js,java,py}`, `**/*Utils.{ts,js,java}`                     | src/utils/ |
| Helpers | `**/helpers/**/*.{ts,js,java,py,rb}`, `**/*Helper.{ts,js,java}`               | src/helpers/ |
| Constants | `**/constants/**/*.{ts,js}`, `**/*Constants.{ts,js}`                          | src/constants/ |
| Types/Interfaces | `**/types/**/*.{ts,js}`, `**/interfaces/**/*.{ts,java}`                       | src/types/ |
| Config | `**/config/**/*.{ts,js,py}`, `**/*Config.{ts,js}`                             | src/config/ |
| **Framework-Specific** |                                                                               | |
| Modules (NestJS/Angular) | `**/*.module.{ts,js}`                                                         | src/modules/ |
| Pipes (NestJS) | `**/*.pipe.{ts,js}`, `**/pipes/**`                                            | src/pipes/ |
| Decorators | `**/decorators/**/*.{ts,js}`, `**/*.decorator.{ts,js}`                        | src/decorators/ |
| Blueprints (Flask) | `**/blueprints/**/*.py`                                                       | blueprints/ |
| Views (Django) | `**/views.py`, `**/views/**/*.py`                                             | app/views/ |
| Serializers (Django) | `**/serializers.py`, `**/serializers/**/*.py`                                 | app/serializers/ |
| **Background/Async** |                                                                               | |
| Jobs | `**/jobs/**/*.{ts,js,rb}`, `**/*Job.{ts,js,rb}`                               | src/jobs/ |
| Workers | `**/workers/**/*.{ts,js}`, `**/*Worker.{ts,js}`                               | src/workers/ |
| Events | `**/events/**/*.{ts,js,java}`, `**/*Event.{ts,js,java}`                       | src/events/ |
| Listeners | `**/listeners/**/*.{ts,js,java}`, `**/*Listener.{ts,js}`                      | src/listeners/ |
| Commands (CLI) | `**/commands/**/*.{ts,js,java}`, `**/*Command.{ts,js}`                        | src/commands/ |
| **Database** |                                                                               | |
| Migrations | `**/migrations/**/*.{ts,js,sql,rb,py}`                                        | migrations/ |
| Seeds | `**/seeds/**/*.{ts,js,rb}`, `**/seeders/**`                                   | seeds/ |
| **Error Handling** |                                                                               | |
| Exceptions | `**/exceptions/**/*.{ts,js,java}`, `**/*Exception.{ts,js,java}`               | src/exceptions/ |
| Errors | `**/errors/**/*.{ts,js}`, `**/*Error.{ts,js}`                                 | src/errors/ |

For each pattern found:
- Count matching files
- Identify primary location (most common directory)
- Sample 1 file name to show convention

**1h. Detect runnable commands** for potential command skills:

Scan project configuration files for commands that can become skills:

| Source | How to Detect | Example Commands |
|--------|---------------|------------------|
| package.json | Read `scripts` object | build, test, lint, format, dev, start, typecheck |
| Makefile | Grep for targets (lines ending with `:`) | build, test, lint, clean, docker-build |
| pyproject.toml | Read `[tool.poetry.scripts]` or `[project.scripts]` | test, lint, format, typecheck |
| Cargo.toml | Check for `[[bin]]` sections, common cargo commands | build, test, clippy, fmt |
| build.gradle | Grep for `task` definitions | build, test, lint, spotlessApply |
| composer.json | Read `scripts` object | test, lint, format, analyse |
| Rakefile | Grep for `task :name` patterns | test, lint, db:migrate, db:seed |

**Common command categories to detect:**

| Category | Common Names | Skill Name |
|----------|--------------|------------|
| **Build** | build, compile, bundle, pack | run-build |
| **Test** | test, test:unit, test:integration, test:e2e, spec | run-tests |
| **Lint** | lint, eslint, pylint, rubocop, clippy | run-lint |
| **Format** | format, prettier, fmt, black, gofmt | run-format |
| **Type Check** | typecheck, tsc, mypy, type-check | run-typecheck |
| **Dev Server** | dev, start, serve, watch | run-dev |
| **Database** | db:migrate, migrate, db:seed, seed, db:reset | run-db-migrate, run-db-seed |
| **Docker** | docker:build, docker:up, docker:down, compose | run-docker |
| **Deploy** | deploy, release, publish | run-deploy |
| **Clean** | clean, reset, purge | run-clean |
| **Generate** | generate, codegen, gen | run-generate |

For each command found:
- Record the exact command syntax
- Identify any required environment or flags
- Note if it has watch/CI variants

Store results internally as:
```json
{
  "detectedPatterns": {
    "controller": { "count": 12, "location": "src/controllers/", "example": "UserController.ts" },
    "service": { "count": 8, "location": "src/services/", "example": "AuthService.ts" },
    "component": { "count": 25, "location": "src/components/", "example": "Button.tsx" }
  },
  "detectedCommands": {
    "build": { "source": "package.json", "command": "npm run build", "variants": ["build:prod", "build:dev"] },
    "test": { "source": "package.json", "command": "npm test", "variants": ["test:unit", "test:e2e"] },
    "lint": { "source": "package.json", "command": "npm run lint", "variants": ["lint:fix"] },
    "format": { "source": "package.json", "command": "npm run format", "variants": [] }
  }
}
```

Only include patterns/commands that are actually detected.

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

#### 3a. Create-* Skills (Architectural Patterns)

Generate skills based on detected file patterns:

| Pattern | Files | Location | Skill Name | Generate |
|---------|-------|----------|------------|----------|
| Controller | {count} | {location} | create-controller | ✓ |
| Service | {count} | {location} | create-service | ✓ |
| Component | {count} | {location} | create-component | ✓ |
| {pattern} | {count} | {location} | create-{pattern} | ✗ (user skipped) |

{Include only patterns where user selected "Generate = ✓"}

For each selected pattern skill:
1. Analyze 2-3 existing files from the pattern location
2. Extract naming conventions, file structure, imports
3. Generate SKILL.md with project-specific template

Each create-* skill should:
- Follow standard SKILL.md frontmatter pattern
- Set `user-invocable: true` so users can invoke directly (e.g., `/create-controller UserController`)
- Set `model: haiku` for fast, cheap pattern-following
- Derive patterns from existing code in the project
- Include file naming and location conventions
- Include template/pattern based on existing examples

#### 3b. Run-* Skills (Command Skills)

Generate skills based on detected commands:

| Command | Source | Full Command | Skill Name | Generate |
|---------|--------|--------------|------------|----------|
| build | {source} | {command} | run-build | ✓ |
| test | {source} | {command} | run-tests | ✓ |
| lint | {source} | {command} | run-lint | ✓ |
| {command} | {source} | {full-command} | run-{command} | ✗ (user skipped) |

{Include only commands where user selected "Generate = ✓"}

For each selected command skill:
1. Document the exact command and any variants
2. Include common flags and options
3. Document expected output and error handling

Each run-* skill should:
- Follow standard SKILL.md frontmatter pattern
- Set `user-invocable: true` so users can invoke directly (e.g., `/run-tests`, `/run-lint`)
- Set `model: haiku` for simple command execution
- Include the exact command syntax
- Document any environment requirements
- Include common options/flags

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

## ❌ DO NOT

- DO NOT create CLAUDE.md directly — that's Phase 3's job
- DO NOT create `.5/*.md` documentation files — that's Phase 3's job
- DO NOT generate skills directly — that's Phase 3's job
- DO NOT skip user interaction — always confirm detected values
- DO NOT assume project structure — always detect or ask
- DO NOT continue after writing config.json and the feature spec — EXIT

## Example Usage

```
User: /5:configure

[Step 1: Auto-detection runs silently]

Claude: "Detected project type: Next.js. Is this correct?"
User: "Yes"

Claude: "How do you track work items?"
User: "GitHub Issues"

Claude: "Extract ticket ID from branch name?"
User: "Yes"

Claude: "Branch naming convention?"
User: "feature/description"

Claude: "Build command: `npm run build`. Use this?"
User: "Yes"

Claude: "Test command: `npm test`. Use this?"
User: "Yes"

Claude: "Should Claude make atomic commits during implementation?"
User: "No"

Claude: "Which code review tool would you like to use?"
User: "Claude (built-in)"

Claude: "Generate CLAUDE.md with codebase analysis?"
User: "Yes"

Claude: "I analyzed your codebase and found these patterns:
| Pattern | Files | Location | Example |
|---------|-------|----------|---------|
| Component | 25 files | src/components/ | Button.tsx |
| Hook | 8 files | src/hooks/ | useAuth.ts |
| API Route | 12 files | pages/api/ | users.ts |
| Page | 15 files | pages/ | index.tsx |

Which patterns would you like `create-*` skills generated for?"
User: [Selects Component, Hook, API Route]

Claude: "I also found these runnable commands:
| Command | Source | Full Command |
|---------|--------|--------------|
| build | package.json | npm run build |
| test | package.json | npm test |
| lint | package.json | npm run lint |
| typecheck | package.json | npm run typecheck |

Which commands would you like `run-*` skills generated for?"
User: [Selects test, lint]

Claude: [Writes .5/features/CONFIGURE/feature.md]
Claude: "Configuration feature planned at `.5/features/CONFIGURE/feature.md`"
Claude: "Next: Run `/clear` followed by `/5:plan-implementation CONFIGURE`"
```

## Related Documentation

- [5-Phase Workflow Guide](../../docs/workflow-guide.md)
- [configure-project skill](../../skills/configure-project/SKILL.md)
- [/5:plan-feature command](./plan-feature.md)
- [/5:plan-implementation command](./plan-implementation.md)
