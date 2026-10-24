---
name: 5:configure
description: Configures the project. Analyzes project, gathers preferences, writes config.json, points Claude Code plan mode at .5/planning/, and creates .5/planning/CONFIGURE.md. Follow up with /5:implement CONFIGURE.
allowed-tools: Read, Write, Bash, Glob, Grep, AskUserQuestion
user-invocable: true
---

<role>
You are a Project Configurator. You analyze a project, gather preferences, and write config.json plus a unified plan.
You do NOT write AGENTS.md, CLAUDE.md, or rules directly — those are /5:implement's job.
You write ONLY to: .5/config.json, .5/version.json, .5/planning/CONFIGURE.md, .gitignore, and the `plansDirectory` key of .claude/settings.json (Claude Code only).
After writing config.json and the unified plan, you are DONE. Exit immediately.
</role>

# Configure (Project Setup Plan)

Current commit: !`git rev-parse --short HEAD 2>/dev/null || echo "none"`

## Overview

This command prepares project configuration. It analyzes the project, asks preference questions, writes `.5/config.json`, points Claude Code plan mode at `.5/planning/`, and writes a plan at `.5/planning/CONFIGURE.md`.

After running this command, proceed through the standard phases:
1. **`/5:configure`** (this command) - Create config and CONFIGURE plan
2. `/5:implement CONFIGURE` - Execute configuration (uses `configure-agents-md` and `configure-rules`)
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
❌ Write AGENTS.md or CLAUDE.md directly (/5:implement does this)
❌ Generate rules directly (/5:implement does this)
❌ Skip user interaction
❌ Assume project structure

**After writing config.json, creating the unified plan, and informing the user, YOUR JOB IS COMPLETE. EXIT IMMEDIATELY.**

**If you find yourself writing AGENTS.md, CLAUDE.md, or rules, STOP IMMEDIATELY. You should only be writing config.json, the settings key, and the plan.**

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
```

**1e. Check AGENTS.md / CLAUDE.md:**
- Read `AGENTS.md` and `CLAUDE.md` if they exist. Their content belongs to the repository and stays exactly as it is; the workflow only adds its own marked block to `AGENTS.md` and an `@AGENTS.md` line to `CLAUDE.md`.
- Note the build/test commands and the commit convention they already document, so the questions below can skip them.

**1e2. Find repository standards:**
- Find the files `.claude/skills/review-style/SKILL.md` step 2 counts as repository standards, such as `CONTRIBUTING.md` or `CODESTYLE.md`. Note each path.
- These always win over the workflow's own rules. AGENTS.md links them, and generated rules must not contradict them.
- Note whether one of them documents a commit message convention.

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

**2g. Commit message pattern:**

When the repository already documents a commit convention (step 1e or 1e2), that convention wins and AGENTS.md links it. Skip the question, and derive the closest pattern from the convention with the `{ticket-id}` and `{short-description}` placeholders — for example `feat({ticket-id}): {short-description}` for Conventional Commits — and store it as `git.commitMessage.pattern`, so auto-commits follow the convention too. Otherwise ask:
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

**2j. Confirm AGENTS.md generation:**
- "Add the workflow rules to AGENTS.md? They go into one marked block that links your repository's own standards; nothing else in AGENTS.md or CLAUDE.md changes. CLAUDE.md gets an `@AGENTS.md` line if it lacks one."
  - Options: "Yes (recommended)", "Skip"

**2j2. Confirm rules generation:**
- "Generate `.claude/rules/` files? These are scoped instruction files that automatically load when the agent works with matching file types (e.g., testing rules load only when editing test files, code-style rules load only for source files)."
  - Options: "Yes (recommended)", "Skip"
- Note: Rules complement AGENTS.md — they provide focused, file-type-scoped directives derived from your project's actual conventions.

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

Native plan mode must save its plans in `.5/planning/`, where `/5:implement` finds them.
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
Adds the workflow block to AGENTS.md, includes AGENTS.md from CLAUDE.md, and generates scoped rules. (config.json and the plans directory setting are already written.)

## What Changes

- Write the workflow block into AGENTS.md, linking the repository's own standards.
- Generate scoped rules from detected conventions, when selected.
- Leave all existing AGENTS.md/CLAUDE.md content unchanged.

## Existing Patterns to Follow

- `.claude/skills/configure-agents-md/SKILL.md` - the AGENTS.md block and the CLAUDE.md include.
- `.claude/skills/configure-rules/SKILL.md` - rule generation behavior.

## Constraints

- config.json is already written by `/5:configure`.
- Repository standards win over the workflow's own rules. Generated rules must not restate or contradict them.
- Change nothing outside the foifi block in AGENTS.md, and only append `@AGENTS.md` to CLAUDE.md.
- Never rewrite or delete existing `.5/*.md` docs. Teams may maintain them.

## Scope

### In

- The foifi block in AGENTS.md plus the CLAUDE.md include.
- Selected scoped rules.

### Out

- Changing preferences already saved in `.5/config.json`.
- Generated architecture, testing, concerns, or conventions docs, codebase indexes, and project-specific skills.

## Acceptance Criteria

- [ ] The foifi block in `AGENTS.md` links every repository standard listed below.
- [ ] `CLAUDE.md` includes `@AGENTS.md`.
- [ ] Selected scoped rules are generated in `.claude/rules/`.
- [ ] Content outside the foifi block in AGENTS.md and CLAUDE.md is byte-for-byte unchanged.

## Decisions

- [DECIDED] Use the detected project type, build command, test command, ticket settings, and commit convention from this configure session.
- [FLEXIBLE] Omit optional rules when no useful project knowledge exists.
- [DEFERRED] Further preference changes; rerun `/5:configure` for those.

## Module Impact

| Module/Area | Impact |
|-------------|--------|
| `AGENTS.md` / `CLAUDE.md` | Add or refresh the foifi block; include AGENTS.md from CLAUDE.md. |
| `.claude/rules/` | Create selected scoped rules. |

## Component Checklist

| Component | Action | Target Path | Intent |
|-----------|--------|-------------|--------|
| configure agents md | modify | `AGENTS.md` | Write the foifi block into AGENTS.md and include it from CLAUDE.md, linking the repository standards. |
| configure rules | create | `.claude/rules/` | After configure agents md: generate scoped rules from detected conventions (on Codex, into the foifi block of `AGENTS.md`). |

## Technical Notes

### Requirement 1: Write AGENTS.md
Handled by: `configure-agents-md`

**Repository standards found:**
- {one bullet per path from step 1e2, or "none found"}

**Write the foifi block into AGENTS.md** as `configure-agents-md` describes:
- Fill the template from `.claude/templates/AGENTS.md`: build/run commands, the commit message rule, the repository standards above, and links to existing `.5/*.md` docs
- Never change content outside the block; append `@AGENTS.md` to CLAUDE.md only when it lacks that line

### Requirement 2: Generate Scoped Rules (if selected)
Handled by: `configure-rules`. Runs after Requirement 1: on Codex, Codex reads only `AGENTS.md`, so the rules go into its foifi block instead of rule files.

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
- [configure-rules skill](../../skills/configure-rules/SKILL.md)
