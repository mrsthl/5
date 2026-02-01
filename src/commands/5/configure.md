---
name: 5:configure
description: Phase 1 of project configuration. Analyzes project, gathers preferences, and creates a configuration feature spec. Follow up with /5:plan-implementation CONFIGURE.
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
context: inherit
user-invocable: true
---

# Configure (Phase 1 - Plan Feature for Project Configuration)

## Overview

This command is **Phase 1** of the 5-phase workflow applied to project configuration itself. It analyzes the project, asks the user questions, and outputs a feature spec at `.5/CONFIGURE/feature.md`.

After running this command, proceed through the standard phases:
1. **`/5:configure`** (this command) - Plan the configuration feature
2. `/5:plan-implementation CONFIGURE` - Create implementation plan
3. `/5:implement-feature CONFIGURE` - Execute configuration (uses `configure-project` skill)
4. `/5:verify-implementation` - Verify configuration
5. `/5:review-code` - Review generated files

## Configuration Process

### Step 1: Analyze Project (auto-detect, no user interaction)

Perform all detection silently, collecting results for Step 2.

**1a. Check for existing config:**
```bash
if [ -f ".claude/.5/config.json" ]; then
  # Config exists - will ask user in Step 2
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
```

**1e. Check CLAUDE.md:**
- If `CLAUDE.md` exists, read its content

**1f. Scan existing skills:**
- Check `.claude/skills/` for existing project-specific skills

### Step 2: Gather User Preferences (interactive via AskUserQuestion)

**2a. If config exists:**
- "Configuration already exists. What would you like to do?"
  - Options: "Update existing", "Start fresh", "Cancel"
  - If Cancel: stop here

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

**2f. Confirm CLAUDE.md generation:**
- "Generate/update CLAUDE.md? This will analyze your codebase to document structure and conventions."
  - Options: "Yes (recommended)", "Skip"

**2g. Confirm project-specific skills:**
- Present proposed skills based on detected project type (see skill table in configure-project/SKILL.md)
- "These project-specific skills were detected for your {project-type} project: {skill-list}. Confirm or customize?"
  - Options: "Use these (recommended)", "Customize", "Skip skill generation"

### Step 3: Create Feature Spec

Write `.5/CONFIGURE/feature.md` containing all gathered data:

```markdown
# Feature: Project Configuration

## Summary
Configure the 5-phase workflow for this {project-type} project. Creates config.json, generates CLAUDE.md with codebase analysis, and creates project-specific skills.

## Requirements

### Requirement 1: Create config.json
Create `.claude/.5/config.json` with the following values:
- Project type: {project-type}
- Ticket pattern: {pattern}
- Extract from branch: {yes/no}
- Branch convention: {convention}
- Build command: {build-command}
- Test command: {test-command}
- Build timeout: 120000ms
- Test timeout: 300000ms
- CodeRabbit: {available/not-available}, authenticated: {yes/no}
- IDE integration: {available/not-available}, type: {type}
- Review tool: {coderabbit/none}

### Requirement 2: Generate Documentation Files
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

### Requirement 3: Generate Project-Specific Skills
Generate the following skills in `.claude/skills/`:
{List of confirmed skills, e.g.:}
- create-component: Creates a React component following project conventions
- create-hook: Creates a custom React hook following project conventions
- create-context: Creates a React context provider following project conventions

Each skill should:
- Follow standard SKILL.md frontmatter pattern
- Derive patterns from existing code in the project
- Include file naming and location conventions
- Include template/pattern based on existing examples

## Acceptance Criteria
- [ ] `.claude/.5/config.json` exists with correct values (no `steps` array)
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

**Important:** Use `mkdir -p .5/CONFIGURE` before writing the feature spec.

### Step 4: Guide User to Next Phase

Tell the user:

1. "Configuration feature planned at `.5/CONFIGURE/feature.md`"
2. "Next: Run `/5:plan-implementation CONFIGURE`"
3. "Then: `/5:implement-feature CONFIGURE` -> `/5:verify-implementation` -> `/5:review-code`"

## DO NOT

- DO NOT write config.json directly (that's Phase 3's job via the configure-project skill)
- DO NOT create CLAUDE.md directly (that's Phase 3's job)
- DO NOT generate skills directly (that's Phase 3's job)
- DO NOT skip user interaction - always confirm detected values
- DO NOT assume project structure - always detect or ask

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

Claude: "Generate CLAUDE.md with codebase analysis?"
User: "Yes"

Claude: "Proposed skills for Next.js: create-page, create-api-route, create-component. Confirm?"
User: "Use these"

Claude: [Writes .5/CONFIGURE/feature.md]
Claude: "Configuration feature planned at `.5/CONFIGURE/feature.md`"
Claude: "Next: Run `/5:plan-implementation CONFIGURE`"
```

## Related Documentation

- [5-Phase Workflow Guide](../../docs/workflow-guide.md)
- [configure-project skill](../../skills/configure-project/SKILL.md)
- [/5:plan-feature command](./plan-feature.md)
- [/5:plan-implementation command](./plan-implementation.md)
