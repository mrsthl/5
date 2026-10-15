---
name: 5:configure
description: Configures the project. Analyzes project, gathers preferences, writes config.json, points Claude Code plan mode at .5/planning/, and creates .5/planning/CONFIGURE.md. Follow up with /5:implement CONFIGURE.
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
---

<role>
You are a Project Configurator. You analyze a project, gather preferences, and write config.json plus a unified plan.
You do NOT generate AGENTS.md, CLAUDE.md, rules, or skills directly — those are /5:implement's job.
You write ONLY to: .5/config.json, .5/version.json, .5/planning/CONFIGURE.md, .gitignore, and the `plansDirectory` key of .claude/settings.json (Claude Code only).
After writing config.json and the unified plan, you are DONE. Exit immediately.
</role>

# Configure (Project Setup Plan)

Current commit: !`git rev-parse --short HEAD 2>/dev/null || echo "none"`

## Overview

This command prepares project configuration. It analyzes the project, asks preference questions, writes `.5/config.json`, points Claude Code plan mode at `.5/planning/`, and writes a plan at `.5/planning/CONFIGURE.md`.

After running this command, proceed through the standard phases:
1. **`/5:configure`** (this command) - Create config and CONFIGURE plan
2. `/5:implement CONFIGURE` - Execute configuration (uses `configure-agents-md` and `configure-skills`)
3. `/5:review` - Review generated files if desired

## ⚠️ CRITICAL SCOPE CONSTRAINT

**THIS COMMAND WRITES config.json AND CREATES THE CONFIGURE PLAN. NOTHING ELSE.**

Your job in this command:
✅ Analyze project (detect type, build commands, etc.)
✅ Gather user preferences via questions
✅ Write `.5/config.json` directly
✅ Set `plansDirectory` in `.claude/settings.json` (Claude Code only)
✅ Create the plan at `.5/planning/CONFIGURE.md` for remaining work
✅ Tell user to run /5:implement CONFIGURE

Your job is NOT:
❌ Create AGENTS.md or CLAUDE.md directly (/5:implement does this)
❌ Generate rules directly (/5:implement does this)
❌ Generate skills directly (/5:implement does this)
❌ Skip user interaction
❌ Assume project structure

**After writing config.json, creating the unified plan, and informing the user, YOUR JOB IS COMPLETE. EXIT IMMEDIATELY.**

**If you find yourself creating AGENTS.md, CLAUDE.md, rules, or skills, STOP IMMEDIATELY. You should only be writing config.json, the settings key, and the plan.**

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
# IDE MCP (JetBrains) - check if MCP tools are available

# Context7 - up-to-date documentation MCP server
# Check if context7 tools are available (resolve-library-id, query-docs)

# skill-creator plugin — helps create better project-specific skills
# Check if skill-creator tools are available by looking for known tool names
# in the current session (e.g., create-skill, scaffold-skill).
# Set skill_creator_available=true if any skill-creator tool is found.
```

**1e. Check AGENTS.md / CLAUDE.md:**
- If `AGENTS.md` exists, read its content
- If `AGENTS.md` does not exist but `CLAUDE.md` exists with real content (not just `@AGENTS.md`), read it — this is a legacy setup that will be migrated to AGENTS.md during planning

**1e2. Find repository standards:**
- Find the files `.claude/skills/review-style/SKILL.md` step 2 counts as repository standards, such as `CONTRIBUTING.md` or `CODESTYLE.md`. Note each path.
- These always win over the workflow's own rules. AGENTS.md links them, and generated rules must not contradict them.

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

**2h. Context7 documentation plugin:**

Context7 provides up-to-date, version-specific documentation and code examples directly in your prompts. It solves a common problem with LLMs: outdated training data leading to hallucinated APIs and deprecated code patterns.

- If Context7 was detected in Step 1d (resolve-library-id and query-docs tools available):
  - "Context7 is already installed. ✓"
- If Context7 was NOT detected:
  - "Would you like to install Context7? It provides up-to-date, version-specific documentation directly in prompts — helping avoid hallucinated APIs and deprecated patterns."
  - Options:
    1. "Install now (recommended)" — run `claude mcp add context7 -- npx -y @anthropic-ai/claude-code-mcp-server-context7` via Bash
    2. "Skip"
  - If user selects "Install now": execute the install command

**2i. skill-creator plugin:**

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

**2j. Confirm AGENTS.md generation:**
- "Generate/update AGENTS.md? It links your repository's own standards and adds the workflow's coding rules. (A CLAUDE.md shim will also be created for Claude Code compatibility.)"
  - Options: "Yes (recommended)", "Skip"

**2j2. Confirm rules generation:**
- "Generate `.claude/rules/` files? These are scoped instruction files that automatically load when the agent works with matching file types (e.g., testing rules load only when editing test files, code-style rules load only for source files)."
  - Options: "Yes (recommended)", "Skip"
- Note: Rules complement AGENTS.md — they provide focused, file-type-scoped directives derived from your project's actual conventions.

**2k. Review detected patterns for skill generation:**

Present ONLY patterns that were actually detected in steps 1g and 1h.

**Part 1: Architectural patterns (pattern skills)**

"I analyzed your codebase and found these architectural patterns:

| Pattern | Files Found | Location | Example |
|---------|-------------|----------|---------|
| Controller | 12 files | src/controllers/ | UserController.ts |
| Service | 8 files | src/services/ | AuthService.ts |
| Component | 25 files | src/components/ | Button.tsx |

Which patterns would you like skills generated for?"

- Options: Multi-select checkboxes for each detected pattern (use AskUserQuestion with multiSelect: true)
- Include descriptions like: "Controller (12 files) - Generate `controller` skill"
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

**2l. Git-ignore workflow folders:**
- "`.5/planning/` will hold your plans. `.5/features/` will hold implementation state and review findings. Which should git ignore?"
  - Options:
    1. "Both (recommended)" — workflow artifacts stay local
    2. "Only `.5/features/`" — share plans with your team, keep state local
    3. "Neither" — track plans, state, and findings in git

### Step 2.5: Write config.json

Using the values gathered from Steps 1 and 2, write `.5/config.json` directly.

**If "Update existing" flow:** Read current config, merge updated values.
**If "Start fresh" or new install:** Write new config.

**Ensure directory exists:**
```bash
mkdir -p .5
```

**Schema:** Read `.claude/references/configure-tables.md` section "Config Schema" for the full JSON structure. Fill all values from user responses (including `rules.generate` from step 2j2). Write with pretty-printed JSON. Read back to verify correctness.

**Update `.5/version.json` with configure timestamp:**

After writing config.json, update `.5/version.json` so the reconfigure reminder can track staleness:
1. Read `.5/version.json` (if it exists)
2. Set `configuredAt` to the current ISO timestamp (`new Date().toISOString()`)
3. Set `configuredAtCommit` to the current short commit hash injected at the top of this command
4. Write back `.5/version.json` preserving all other fields

**Point plan mode at `.5/planning/` (Claude Code only — skip on Codex):**

`/5:plan` relies on native plan mode saving its plan in `.5/planning/`, where `/5:implement` finds it.
1. Read `.claude/settings.json` if it exists.
2. If `plansDirectory` is missing, set it to `".5/planning"` and keep every other key unchanged. Create the file if it does not exist.
3. If `plansDirectory` already holds a different value, ask whether to switch it to `.5/planning`. Explain that `/5:implement` finds plans only there, unless it gets a plan path.
4. Inform the user: "Plan mode now saves plans in `.5/planning/`"

**Apply `.gitignore` if selected:**

For each folder the user chose to ignore in step 2l (`.5/planning/`, `.5/features/`):
1. Check if `.gitignore` exists in the project root — create it if not
2. Check if the folder is already listed — if not, append it on a new line
3. Inform the user which folders were added to `.gitignore`

**Always gitignore `.5/.reconfig-reminder`:**

Ensure `.5/.reconfig-reminder` is gitignored (it's a transient runtime flag that should never be committed):
1. Check if `.gitignore` exists in the project root — create it if not
2. Check if `.5/.reconfig-reminder` is already listed — if not, append `.5/.reconfig-reminder` on a new line

### Step 3: Create Configuration Plan

Write `.5/planning/CONFIGURE.md` containing all gathered data:

```markdown
---
ticket: CONFIGURE
feature: CONFIGURE
created: {ISO-timestamp}
---

# Plan: CONFIGURE - Project Configuration

## Overview
Generates AGENTS.md, the CLAUDE.md shim, and project-specific skills and rules. (config.json and the plans directory setting are already written.)

## What Changes

- Write AGENTS.md from the workflow template, linking the repository's own standards.
- Generate selected project-specific skills and scoped rules.
- Preserve existing user-authored AGENTS.md/CLAUDE.md content.

## Existing Patterns to Follow

- `.claude/skills/configure-agents-md/SKILL.md` - AGENTS.md and CLAUDE.md shim generation.
- `.claude/skills/configure-skills/SKILL.md` - skill and rule generation behavior.

## Constraints

- config.json is already written by `/5:configure`.
- Repository standards win over the workflow's own rules. Generated rules must not restate or contradict them.
- Preserve user-authored sections in AGENTS.md.
- Never rewrite or delete existing `.5/*.md` docs. Teams may maintain them.

## Scope

### In

- AGENTS.md plus CLAUDE.md shim.
- Selected pattern and run-* skills.
- Selected scoped rules.

### Out

- Changing preferences already saved in `.5/config.json`.
- Generated architecture, testing, concerns, or conventions docs and codebase indexes.

## Acceptance Criteria

- [ ] `AGENTS.md` links every repository standard listed below.
- [ ] `CLAUDE.md` contains only `@AGENTS.md`.
- [ ] Selected project-specific skills are generated in `.claude/skills/`.
- [ ] Selected scoped rules are generated in `.claude/rules/`.
- [ ] User-written AGENTS.md/CLAUDE.md content is preserved.

## Decisions

- [DECIDED] Use the detected project type, build command, test command, ticket settings, and selected patterns from this configure session.
- [FLEXIBLE] Omit optional rules when no useful project knowledge exists.
- [DEFERRED] Further preference changes; rerun `/5:configure` for those.

## Module Impact

| Module/Area | Impact |
|-------------|--------|
| `AGENTS.md` / `CLAUDE.md` | Create or update provider instructions. |
| `.claude/skills/` | Create selected project-specific skills. |
| `.claude/rules/` | Create selected scoped rules. |

## Component Checklist

| Component | Action | Target Path | Intent |
|-----------|--------|-------------|--------|
| configure agents md | create | `AGENTS.md` | Write AGENTS.md from the template and the CLAUDE.md shim, linking the repository standards. |
| configure skills and rules | create | `.claude/skills/` | Generate selected pattern/run skills and scoped rules from detected conventions. |

## Technical Notes

### Requirement 1: Write AGENTS.md
Handled by: `configure-agents-md`

**Repository standards found:**
- {one bullet per path from step 1e2, or "none found"}

**Create AGENTS.md** (provider-agnostic instructions file):
- Use `.claude/templates/AGENTS.md` as the source template
- Fill `{PROJECT_OVERVIEW}` with 1-2 sentences from README/package.json
- Fill `{BUILD_RUN_COMMANDS}` with build, test, and other detected commands
- Fill `{REPO_STANDARDS_LINKS}` with the repository standards above
- Fill `{PROJECT_DOCUMENTATION_LINKS}` with existing `.5/*.md` docs, or drop that section when there are none
- Fill `{CUSTOM_DOCUMENTATION}` with preserved user-authored sections under `## Custom Documentation`; remove the placeholder if there is no custom content
- Preserve static template sections exactly as written

**Create CLAUDE.md shim:**
- Contains only `@AGENTS.md` (Claude Code include syntax)

**Migrate and preserve existing content:**
- If AGENTS.md already exists, preserve user-written custom sections
- If CLAUDE.md exists with real content (not just `@AGENTS.md`), migrate content to AGENTS.md and replace CLAUDE.md with the shim

### Requirement 2: Generate Project-Specific Skills
Handled by: `configure-skills`

**Pattern skills** for each user-selected architectural pattern:
- Skill name: `{pattern}` (e.g., `controller`, `service`)
- Analyze 2-3 existing files, extract conventions, generate SKILL.md with project-specific template
- Set `user-invocable: true`, `model: haiku`

**Run-* skills** for each user-selected command:
- Skill name: `run-{category}` (e.g., `run-tests`, `run-lint`)
- Document exact command syntax, variants, flags
- Set `user-invocable: true`, `model: haiku`

Include only patterns/commands where user selected "Generate".

### Requirement 3: Generate Scoped Rules (if selected)
Handled by: `configure-skills`

Generate `.claude/rules/` files with project-specific conventions scoped to relevant file types.
Rules are concise directives (15-40 lines, NOT documentation) derived from codebase analysis.
They must not restate or contradict the repository standards above.
Only generate rules for patterns that were actually detected:
- `code-style.md` — naming, formatting, import conventions (scoped to source files)
- `testing.md` — test patterns, mocking, fixtures, gotchas (scoped to test files)
- `api-patterns.md` — API conventions, error handling (scoped to API/route/controller files)
- `dependencies.md` — dependency usage patterns, env var conventions (unconditional)

## Next Steps

1. Run `/5:implement CONFIGURE`.
```

**Important:** Use `mkdir -p .5/planning` before writing the plan.

### Step 4: Guide User to Next Phase

Tell the user:

1. "Configuration saved to `.5/config.json`"
2. "Configuration plan written to `.5/planning/CONFIGURE.md`"
3. "Next steps:"
   - "Run `/clear` to reset context"
   - "Then run `/5:implement CONFIGURE`"
4. "After that: Run `/5:review` if you want a review of generated files"

## Related Documentation
- [configure-agents-md skill](../../skills/configure-agents-md/SKILL.md)
- [configure-skills skill](../../skills/configure-skills/SKILL.md)
