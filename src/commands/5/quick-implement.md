---
name: 5:quick-implement
description: Execute small, focused implementations quickly with state tracking and atomic commits. Skips extensive planning phases and verification agents - use for tasks where you know exactly what to do.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion, Skill, TaskCreate, TaskUpdate, TaskList, mcp__jetbrains__*
context: fork
user-invocable: true
disable-model-invocation: true
---

# Quick Implement

Fast path for small, well-understood tasks (1-5 files). Skips extensive planning phases but preserves state tracking and skill-based implementation.

## ⚠️ CRITICAL SCOPE CONSTRAINT

**THIS COMMAND IS FOR SMALL, FOCUSED TASKS ONLY (1-5 FILES).**

Your job in this command:
✅ Get task description
✅ Extract ticket ID
✅ Create quick plan (max 5 components)
✅ Get user approval on plan
✅ Initialize state tracking
✅ Execute implementation
✅ Run verification
✅ Report completion

Your job is NOT:
❌ Handle complex features (6+ files or multiple domains → use full workflow)
❌ Skip clarifying questions, state file updates, or plan approval
❌ Create feature spec files
❌ Commit without config (only if git.autoCommit is enabled)

**DO NOT:**
- Write code directly without using a Skill or spawning an agent
- Skip state file updates after each component
- Mark a component complete before writing state
- Proceed if a state write fails
- Use `git add .` at any point

**Key Principles:**
- Small scope: 1-5 files, treated as a single logical step
- State is the source of truth: write it after every component
- Resumable: state enables restart from the last completed component

## Process

### Step 1: Get Task Description

Use AskUserQuestion:
- Question: "What do you want to implement?"
- Header: "Quick Task"
- Free text response

Store as `$DESCRIPTION`.

### Step 2: Extract Ticket ID and Load Config

```bash
git branch --show-current
```

Extract ticket ID using configurable pattern from config (e.g., `PROJ-\d+` or `\d+`). If not found, ask developer.

**Sanitize the ticket ID:** Only allow alphanumeric characters, dashes (`-`), and underscores (`_`). Strip any other characters (especially `/`, `..`, `~`, spaces). If the sanitized result is empty, ask the user for a valid ticket ID.

Also read `.5/config.json` and extract:
- `git.autoCommit` (boolean, default `false`)
- `git.commitMessage.pattern` (string, default `{ticket-id} {short-description}`)

### Step 3: Generate Identifiers

Generate a slug from `$DESCRIPTION` using string manipulation (do NOT use bash for this — avoid shell injection):
1. Convert to lowercase
2. Replace any non-alphanumeric character with a dash (`-`)
3. Collapse consecutive dashes into one
4. Remove leading/trailing dashes
5. Truncate to 40 characters

Set `feature_name` to `${TICKET_ID}-${slug}`.

### Step 3b: Check for Existing State

Check if `.5/features/${feature_name}/state.json` already exists:

- **`status: "completed"`** → Tell the user "This task is already implemented." Suggest `/clear` before starting a new task. Stop.
- **`status: "in-progress"`** → Use AskUserQuestion: "A previous run was interrupted at component '{last completed}'. How would you like to proceed?" Options: "Resume from where I left off" / "Restart from the beginning"
  - If Resume: skip Steps 4–7 initialization; go directly to Step 7b (recreate TaskCreate tasks) and Step 8 (resume remaining `pendingComponents`)
  - If Restart: delete state.json, proceed normally from Step 4

### Step 4: Analyze and Plan

1. **Identify affected files** using Glob and Grep
2. **Determine skills needed** based on task type
3. **List components** (max 5 for quick mode)

**If unclear about implementation details**, ask 2-3 focused questions using AskUserQuestion:
- What validation rules apply?
- Which existing patterns to follow?
- Any edge cases to handle?

**Ask questions ONE AT A TIME.** Wait for the user's answer before asking the next question. Do NOT list multiple questions in one message.

### Step 5: Create Plan

Write plan to `.5/features/${feature_name}/plan.md` using the template structure.

**Template Reference:** Use the structure from `.claude/templates/workflow/PLAN.md`

The template contains placeholders for:
- **YAML frontmatter:** ticket, feature, created
- **Header:** `# Quick Implementation: {TICKET-ID}`
- **Task description:** One sentence summary
- **Components table:** Columns for Step, Component, Action, File, Description, Complexity
- **Implementation Notes:** Key details and patterns
- **Verification:** Build and test commands

### Step 6: Present Plan and Iterate

Show plan to user:
```
Quick implementation plan for ${TICKET_ID}:

Components:
1. {type}: {name} ({skill})
2. ...

Affected modules: {modules}

Ready to implement, or would you like changes?
```

Use AskUserQuestion:
- Question: "How would you like to proceed?"
- Header: "Plan"
- Options:
  - "Proceed with implementation (Recommended)"
  - "I have changes to the plan"

**If user selects "I have changes":**
- Ask what changes they want
- Update the plan accordingly
- Present again until user approves

### Step 7: Initialize State (MANDATORY)

**CRITICAL**: You MUST create the state file before starting implementation. This enables resumability if work is interrupted.

Create state file at `.5/features/${feature_name}/state.json`:

```json
{
  "ticket": "{ticket-id}",
  "feature": "{feature_name}",
  "phase": "quick-implementation",
  "status": "in-progress",
  "currentStep": 1,
  "totalSteps": 1,
  "pendingComponents": [
    { "name": "{component-name}", "step": 1, "file": "{file-path}" }
  ],
  "completedComponents": [],
  "failedAttempts": [],
  "verificationResults": {},
  "commitResults": [],
  "startedAt": "{ISO-timestamp}",
  "lastUpdated": "{ISO-timestamp}"
}
```

`pendingComponents` is populated from the approved plan's components table — one entry per row.

**MANDATORY VERIFICATION:** Read state.json back immediately after writing. Confirm `status` is `"in-progress"` and `pendingComponents` is non-empty.
If the read fails or content is wrong, stop: "Failed to initialize state file. Cannot proceed safely."

Then remove the planning guard marker (implementation is starting):

```bash
rm -f .5/.planning-active
```

### Step 7b: Create Progress Checklist

Create one TaskCreate entry per component:
- Subject: `"Implement {component-name}"`
- activeForm: `"Implementing {component-name}"`

Plus one final task:
- Subject: `"Run verification"`
- activeForm: `"Running build and tests"`

Mark the first component's task as `in_progress`.

### Step 8: Execute Implementation

**Decision criteria for execution approach:**

- **Direct execution** (1-2 components, simple edits): Execute skills directly in current context
- **Agent delegation** (3+ components or complex work): Spawn a general-purpose agent

#### Direct Execution

For each component in `pendingComponents`:
1. Invoke appropriate skill using Skill tool
2. Use Glob to verify `FILES_CREATED` exist on disk
3. **Update state file after each component** (MANDATORY):
   - Read current state file
   - Move component from `pendingComponents` to `completedComponents`:
     ```json
     { "name": "{name}", "step": 1, "timestamp": "{ISO}", "filesCreated": [...], "filesModified": [...] }
     ```
   - Update `lastUpdated` timestamp
   - Write back to state file
   - **Verify write:** Read state.json back and confirm `lastUpdated` changed. If verify fails, stop.
4. Mark component's TaskCreate task as `completed`. Mark next component's task as `in_progress`.

**If a component fails:**
- **Small fix** (syntax, import, path): Apply fix with Edit tool directly, retry the skill. Count as retry 1.
- **Large fix** (logic error, wrong pattern): Re-invoke skill with additional context. Count as retry 1.
- If retry also fails: Use AskUserQuestion: "Component '{name}' failed twice. Error: {error}. How to proceed?" Options: "Skip and continue" / "I'll fix manually — pause"
- Never retry more than 2 times. Record failures in `failedAttempts`:
  ```json
  { "component": "{name}", "step": 1, "error": "{message}", "timestamp": "{ISO}", "retryCount": {0|1|2} }
  ```

#### Agent Delegation

Determine the model based on the highest complexity in the plan's components:
- All components `simple` → `haiku`
- Any component `moderate` → `sonnet`
- Any component `complex` → `sonnet`

Spawn an agent with inline instructions:

```
Task tool call:
  subagent_type: general-purpose
  model: {haiku or sonnet based on complexity above}
  description: "Execute quick implementation for ${feature_name}"
  prompt: |
    Implement components for a feature by finding patterns in existing code.

    ## Feature
    ${feature_name}

    ## Components
    {component list from plan}

    ## Process
    For each component:

    **If creating a new file:**
    1. Find a similar file using Glob (e.g., *Service.ts for services)
    2. Read it to understand the pattern (imports, structure, exports)
    3. Create the new file following that pattern
    4. Verify the file exists

    **If modifying a file:**
    1. Read the file
    2. Make the described change using Edit tool
    3. Verify the change

    ## Output
    End your response with a ---RESULT--- block:
    ---RESULT---
    STATUS: success|failed
    FILES_CREATED: path/to/file1, path/to/file2
    FILES_MODIFIED: path/to/file3
    ERROR: {error message if failed}

    ## Rules
    - Find patterns from existing code, don't invent conventions
    - Don't skip components - attempt all
    - Don't interact with user - just execute and report
```

After the agent returns:
1. Parse the `---RESULT---` block. If missing, treat as success if files were mentioned, otherwise failed.
2. **File existence check:** Use Glob to verify each file in `FILES_CREATED` exists on disk. If a file is missing, treat that component as failed.
3. **Retry logic:** For any `STATUS: failed` component or missing file, re-spawn the agent with an `## Error Context` block (counts as retry 1). If retry fails again, use AskUserQuestion as in direct execution.
4. **Update state file** (MANDATORY):
   - Move succeeded components: remove from `pendingComponents`, append to `completedComponents` with structured object
   - Move failed components: append to `failedAttempts` with `retryCount`
   - Update `lastUpdated`
   - Write back to state file
   - **Verify write:** Read state.json back and confirm `lastUpdated` changed. If verify fails, stop.
5. Mark TaskCreate tasks: completed components → `completed`, remaining → adjust `in_progress`.

### Step 9: Verification

Mark the "Run verification" TaskCreate task as `in_progress`.

Run build verification if a build skill is configured:

**If build skill is available:**
```
Skill tool call:
  skill: "{configured-build-skill}"
```

**If build fails:**
1. Analyze error
2. Attempt fix (max 2 retries)
3. Re-run build
4. If still failing, report to user

**If tests are affected and test skill is available:**

```
Skill tool call:
  skill: "{configured-test-skill}"
  args: "{affected test modules}"
```

Update `verificationResults` in state.json:
```json
{
  "buildStatus": "success|failed",
  "testStatus": "success|skipped|failed",
  "builtAt": "{ISO-timestamp}"
}
```
Also update `lastUpdated`. **Verify write:** Read state.json back and confirm `verificationResults.builtAt` is set.

Mark the "Run verification" TaskCreate task as `completed`.

### Step 9b: Auto-Commit (if enabled)

Only fires if `git.autoCommit: true` AND build passed. Stage only the component files (from `FILES_CREATED`/`FILES_MODIFIED`; never `git add .`), commit with configured `git.commitMessage.pattern` (body: one bullet per component). If commit fails, append a warning entry to `commitResults` in state.json and continue.

### Step 10: Update State and Report (MANDATORY)

**CRITICAL**: You MUST update the state file to mark completion.

Update state file:
```json
{
  "status": "completed",
  "completedAt": "{ISO-timestamp}",
  "lastUpdated": "{ISO-timestamp}"
}
```

**MANDATORY VERIFICATION:** Read state.json back and confirm `status` is `"completed"`.
If read fails, warn the user but do not re-attempt — the implementation work is done; only tracking failed.

Report: ticket, description, files created/modified, build/test status, commit status (if auto-commit), skipped components (if any), and next steps (manual commit if needed, `/clear` before new task).

**🛑 YOUR JOB IS COMPLETE. DO NOT START NEW TASKS.**

## Skill Mappings

Skills are project-specific and should be configured in your project's `.claude/skills/` directory. Common patterns include:

| Component Type | Example Skill |
|---------------|---------------|
| Data models | Project-specific model skill |
| Validation logic | Project-specific validator skill |
| Data access | Project-specific repository skill |
| Business logic | Project-specific handler/service skill |
| API endpoints | Project-specific endpoint skill |
| Tests | Project-specific test skill |
| Simple edits | Edit tool directly |

## Instructions Summary

### Before starting:
1. Get task description from user
2. Extract and sanitize ticket ID from branch name
3. Generate `feature_name` slug
4. Check for existing state.json → handle resume / restart / completed cases
5. Analyze codebase, identify components (max 5)
6. Create plan.md → get user approval (iterate if needed)
7. Initialize state.json with richer schema → **MANDATORY: verify write**
8. Create TaskCreate tasks for all components + verification → mark first component `in_progress`

### For each component:
1. Invoke skill or spawn agent
2. Verify files exist on disk (Glob)
3. Apply retry logic if failed (max 2 retries per component)
4. Update state.json → **MANDATORY: verify write**
5. Mark component task `completed`, mark next task `in_progress`

### After all components:
1. Run build skill (if configured)
2. Run test skill (if affected)
3. Update `verificationResults` in state.json → **verify write**
4. Auto-commit if enabled (stage specific files only)
5. Update `status: "completed"` in state.json → **MANDATORY: verify write**
6. Mark verification task `completed`
7. Report to user
