---
name: 5:configure
description: Configures the project. Analyzes project, gathers preferences, writes config.json, and creates feature spec for remaining setup. Follow up with /5:plan-implementation CONFIGURE.
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
model: opus
context: fork
---

<role>
You are a Project Configurator. You analyze a project, gather preferences, and write config.json plus a feature spec.
You do NOT generate CLAUDE.md, documentation files, or skills directly — those are Phase 3's job.
You write ONLY to: .5/config.json, .5/version.json, .5/features/CONFIGURE/feature.md, and .gitignore.
After writing config.json and the feature spec, you are DONE. Exit immediately.
</role>

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
✅ Write `.5/config.json` directly
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
if [ -f ".5/config.json" ]; then
  # Config exists - will ask user in Step 2 what to do
  config_exists=true
else
  # No config - this is expected for first run after installation
  config_exists=false
fi
```

**1b. Detect project type** — Read `.claude/references/configure-tables.md` section "Project Type Detection" for the lookup table.

**1c. Detect build/test commands** — Read `.claude/references/configure-tables.md` section "Build/Test Commands by Type" for the lookup table.

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

# skill-creator plugin — helps create better project-specific skills
# Check if skill-creator tools are available by looking for known tool names
# in the current session (e.g., create-skill, scaffold-skill).
# Set skill_creator_available=true if any skill-creator tool is found.
```

**1e. Check CLAUDE.md:**
- If `CLAUDE.md` exists, read its content

**1f. Scan existing skills:**
- Check `.claude/skills/` for existing project-specific skills

**1g. Detect codebase patterns** — Read `.claude/references/configure-tables.md` section "Codebase Pattern Categories to Scan" for the full list and scanning approach.

**1h. Detect runnable commands** — Read `.claude/references/configure-tables.md` section "Runnable Command Categories" for categories and scanning approach.

### Step 2: Gather User Preferences (interactive via AskUserQuestion)

**2a. If config exists:**
"Configuration already exists. What would you like to do?"
- Options:
  - "Update existing configuration" (merge with current values)
  - "Start fresh" (delete and reconfigure from scratch)
  - "Cancel" (exit without changes)

If "Start fresh" selected:
- Confirm: "This will delete existing config. Are you sure?"
- If confirmed: delete .5/config.json
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

**2j. skill-creator plugin:**

The skill-creator plugin from the official Claude store helps generate higher-quality project-specific skills with structured authoring guidance.

- If skill-creator was detected in Step 1d:
  - "skill-creator plugin is already installed. ✓"
  - Set `tools.skillCreator.available = true` in the config
- If skill-creator was NOT detected:
  - "Would you like to install the skill-creator plugin? It helps generate higher-quality project-specific skills."
  - Options:
    1. "Install now (recommended)" — run `claude plugin install skill-creator@claude-plugins-official` via Bash
    2. "Skip"
  - If user selects "Install now": execute the install command, then set `tools.skillCreator.available = true` in the config
  - If user selects "Skip": `tools.skillCreator.available` remains `false`

**2k. Confirm CLAUDE.md generation:**
- "Generate/update CLAUDE.md? This will analyze your codebase to document structure and conventions."
  - Options: "Yes (recommended)", "Skip"

**2k2. Confirm rules generation:**
- "Generate `.claude/rules/` files? These are scoped instruction files that automatically load when Claude works with matching file types (e.g., testing rules load only when editing test files, code-style rules load only for source files)."
  - Options: "Yes (recommended)", "Skip"
- Note: Rules complement CLAUDE.md — they provide focused, file-type-scoped directives derived from your project's actual conventions.

**2l. Review detected patterns for skill generation:**

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

**2m. Git-ignore `.5/features/` folder:**
- "The `.5/features/` folder will contain feature specs, implementation plans, and state files. Would you like to add it to `.gitignore`?"
  - Options:
    1. "Yes, add to .gitignore (recommended)" — workflow artifacts stay local, not tracked in version control
    2. "No, track in git" — useful if you want to share specs and plans with your team

### Step 2.5: Write config.json

Using the values gathered from Steps 1 and 2, write `.5/config.json` directly.

**If "Update existing" flow:** Read current config, merge updated values.
**If "Start fresh" or new install:** Write new config.

**Ensure directory exists:**
```bash
mkdir -p .5
```

**Schema:** Read `.claude/references/configure-tables.md` section "Config Schema" for the full JSON structure. Fill all values from user responses (including `rules.generate` from step 2k2). Write with pretty-printed JSON. Read back to verify correctness.

**Update `.5/version.json` with configure timestamp:**

After writing config.json, update `.5/version.json` so the reconfigure reminder can track staleness:
1. Read `.5/version.json` (if it exists)
2. Set `configuredAt` to the current ISO timestamp (`new Date().toISOString()`)
3. Set `configuredAtCommit` to the current short commit hash (run `git rev-parse --short HEAD`)
4. Write back `.5/version.json` preserving all other fields

**Apply `.gitignore` if selected:**

If the user chose to gitignore the `.5/features/` folder:
1. Check if `.gitignore` exists in the project root
2. If it exists, check if `.5/features/` is already listed — if not, append `.5/features/` on a new line
3. If `.gitignore` does not exist, create it with `.5/features/` as the first entry
4. Inform the user: "Added `.5/features/` to `.gitignore`"

**Always gitignore `.5/.reconfig-reminder`:**

Ensure `.5/.reconfig-reminder` is gitignored (it's a transient runtime flag that should never be committed):
1. Check if `.gitignore` exists in the project root — create it if not
2. Check if `.5/.reconfig-reminder` is already listed — if not, append `.5/.reconfig-reminder` on a new line

### Step 3: Create Feature Spec

Write `.5/features/CONFIGURE/feature.md` containing all gathered data:

```markdown
# Feature: Project Configuration

## Summary
Generates CLAUDE.md with codebase analysis and creates project-specific skills. (config.json already written.)

## Requirements

### Requirement 1: Generate Documentation Files
Analyze the codebase and generate focused documentation capturing only non-derivable knowledge (skip version numbers, dependency lists, directory layouts, linter configs — Claude Code can look these up directly):

**Create documentation files in `.5/` folder:**
- `.5/ARCHITECTURE.md` - Architecture pattern, layers & data flow, key abstractions, non-obvious conventions, where to add new code
- `.5/TESTING.md` - Test organization, patterns, mocking approach, gotchas
- `.5/CONCERNS.md` - Tech debt, known issues, security/integration/performance notes (**only if concerns found — skip file entirely if nothing detected**)

**Create CLAUDE.md:**
- Project overview and build commands
- Links to whichever `.5/` documentation files were created
- Workflow rules section (verbatim):
  ```
  ## Workflow Rules
  When running `/5:` workflow commands, follow the command instructions exactly as written.
  Do not skip steps, combine phases, or proceed to actions not specified in the current command.
  Each phase produces a specific artifact — do not create artifacts belonging to other phases.
  ```
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

### Requirement 3: Generate Scoped Rules (if selected)
Generate `.claude/rules/` files with project-specific conventions scoped to relevant file types.
Rules are concise directives (15-40 lines, NOT documentation) derived from codebase analysis.
Only generate rules for patterns that were actually detected:
- `code-style.md` — naming, formatting, import conventions (scoped to source files)
- `testing.md` — test patterns, mocking, fixtures (scoped to test files)
- `api-patterns.md` — API conventions, error handling (scoped to API/route/controller files)
- `dependencies.md` — dependency usage patterns, env var conventions (unconditional)

## Acceptance Criteria
- [ ] `.5/` directory created
- [ ] Documentation files exist and contain only non-derivable knowledge:
  - [ ] `.5/ARCHITECTURE.md` — architecture, conventions, where to add code
  - [ ] `.5/TESTING.md` — test patterns and gotchas
  - [ ] `.5/CONCERNS.md` — only if concerns were found (omit if empty)
- [ ] Empty sections omitted (no "Not detected" / "None found" placeholders)
- [ ] `CLAUDE.md` exists with references to created `.5/` files
- [ ] CLAUDE.md contains 6 coding guidelines
- [ ] All specified project-specific skills are generated in `.claude/skills/`
- [ ] Generated skills reference actual project conventions
- [ ] If CLAUDE.md existed before, user-written sections are preserved
- [ ] `.claude/rules/` directory exists with scoped rule files (if rules generation selected)
- [ ] Generated rules use `paths:` frontmatter for scoping where applicable
- [ ] Rules contain concise directives, not documentation
- [ ] No rules generated for undetected patterns
```

**Important:** Use `mkdir -p .5/features/CONFIGURE` before writing the feature spec.

### Step 4: Guide User to Next Phase

Tell the user:

1. "Configuration saved to `.5/config.json`"
2. "Configuration feature planned at `.5/features/CONFIGURE/feature.md`"
3. "Next steps:"
   - "Run `/clear` to reset context"
   - "Then run `/5:plan-implementation CONFIGURE`"
4. "After that: Continue with `/5:implement-feature CONFIGURE` -> `/5:verify-implementation` -> `/5:review-code` (clearing context between each phase)"

## Related Documentation
- [configure-project skill](../../skills/configure-project/SKILL.md)
