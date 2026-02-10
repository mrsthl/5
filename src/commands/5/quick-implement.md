---
name: 5:quick-implement
description: Execute small, focused implementations quickly with state tracking and atomic commits. Skips extensive planning phases and verification agents - use for tasks where you know exactly what to do.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion, Skill, mcp__jetbrains__*
context: fork
user-invocable: true
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

Create state file at `.5/features/${feature_name}/state.json` with fields: `ticket`, `feature`, `phase: "quick-implementation"`, `status: "in-progress"`, `currentStep: 1`, `totalSteps: 1`, `completed: []`, `pending: [from plan]`, `failed: []`, `verificationResults: {}`, `startedAt`, `lastUpdated`.

Verify the file was written correctly with Read tool. If creation fails, stop and report error.

Then remove the planning guard marker (implementation is starting):

```bash
rm -f .5/.planning-active
```

### Step 8: Execute Implementation

**Decision criteria for execution approach:**

- **Direct execution** (1-2 components, simple edits): Execute skills directly in current context
- **Step-executor** (3+ components or complex work): Spawn step-executor agent

#### Direct Execution

For each component:
1. Invoke appropriate skill using Skill tool
2. **Update state file after each component** (MANDATORY):
   - Read current state file
   - Move component from `pending` to `completed`
   - Update `lastUpdated` timestamp
   - Write back to state file
   - Verify write succeeded
3. Track created/modified files

#### Step-Executor Delegation

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
    Report what you created/modified:
    - {path}: {brief description}

    ## Rules
    - Find patterns from existing code, don't invent conventions
    - Don't skip components - attempt all
    - Don't interact with user - just execute and report
```

Process results and **update state file** (MANDATORY):
- Read current state file
- Move completed components from `pending` to `completed`
- Record any failures in `failed`
- Update `lastUpdated` timestamp
- Write back to state file
- Verify write succeeded

### Step 9: Verification

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

### Step 9b: Auto-Commit (if enabled)

Only fires if `git.autoCommit: true` AND build passed. Creates a single commit: stage only plan files (never `git add .`), commit with configured `git.commitMessage.pattern` (body: one bullet per component). If commit fails, log warning and continue.

### Step 10: Update State and Report (MANDATORY)

**CRITICAL**: You MUST update the state file to mark completion.

Update state file to `status: "completed"`, `phase: "completed"`, with `verificationResults` (buildStatus, testStatus, timestamp), `completedAt`, `lastUpdated`. Verify the write.

Report: ticket, description, files created/modified, build/test status, commit status (if auto-commit), and next steps (commit if needed, `/clear` before new task).

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

