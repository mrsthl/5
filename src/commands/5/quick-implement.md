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
❌ Handle complex features (6+ files)
❌ Work across multiple domains
❌ Skip clarifying questions if unclear
❌ Skip state file updates
❌ Create feature spec files (use full workflow)
❌ Commit changes (user handles this)

**This is a FAST PATH for well-understood, small tasks. For anything complex, use the full workflow.**

## ❌ Boundaries: What This Command Does NOT Do

**CRITICAL:** This command has a LIMITED scope. Do NOT:

- ❌ **Use for complex features** - 6+ files or multiple domains → use full workflow
- ❌ **Skip clarifying questions** - If implementation is unclear, ask first
- ❌ **Skip state updates** - State file updates are MANDATORY
- ❌ **Create feature specs** - This is for quick tasks, not full features
- ❌ **Auto-commit** - User handles commits
- ❌ **Skip plan approval** - Always show plan and get user approval first

**If the task involves more than 5 files or multiple domains, STOP and recommend the full workflow instead.**

## Process

### Step 1: Get Task Description

Use AskUserQuestion:
- Question: "What do you want to implement?"
- Header: "Quick Task"
- Free text response

Store as `$DESCRIPTION`.

### Step 2: Extract Ticket ID

```bash
git branch --show-current
```

Extract ticket ID using configurable pattern from config (e.g., `PROJ-\d+` or `\d+`). If not found, ask developer.

### Step 3: Generate Identifiers

```bash
slug=$(echo "$DESCRIPTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-40)
feature_name="${TICKET_ID}-${slug}"
```

### Step 4: Analyze and Plan

1. **Identify affected files** using Glob and Grep
2. **Determine skills needed** based on task type
3. **List components** (max 5 for quick mode)

**If unclear about implementation details**, ask 2-3 focused questions using AskUserQuestion:
- What validation rules apply?
- Which existing patterns to follow?
- Any edge cases to handle?

### Step 5: Create Plan

Write plan to `.5/${feature_name}/plan.md` using the template structure.

**Template Reference:** Use the structure from `.claude/templates/workflow/QUICK-PLAN.md`

The template contains placeholders for:
- **Header:** `# Quick Implementation: {TICKET-ID}`
- **Task:** The task description
- **Components table:** Columns for #, Type, Name, Skill, Module
- **Affected Modules:** List of modules that will be modified
- **Execution:** Mode (parallel, sequential, or direct)

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

Create state file at `.5/${feature_name}/state.json` using Write tool:

```json
{
  "ticketId": "${TICKET_ID}",
  "featureName": "${feature_name}",
  "phase": "quick-implementation",
  "status": "in-progress",
  "currentWave": 1,
  "totalWaves": 1,
  "completedComponents": [],
  "pendingComponents": [/* from plan */],
  "failedAttempts": [],
  "verificationResults": {},
  "startedAt": "{ISO timestamp}",
  "lastUpdated": "{ISO timestamp}"
}
```

**After creating the file:**
1. Use Read tool to verify the file was written correctly
2. Report to user: "State tracking initialized"
3. If file creation fails, stop and report error

### Step 8: Execute Implementation

**Decision criteria for execution approach:**

- **Direct execution** (1-2 components, simple edits): Execute skills directly in current context
- **Step-executor** (3+ components or complex work): Spawn step-executor agent

#### Direct Execution

For each component:
1. Invoke appropriate skill using Skill tool
2. **Update state file after each component** (MANDATORY):
   - Read current state file
   - Move component from `pendingComponents` to `completedComponents`
   - Update `lastUpdated` timestamp
   - Write back to state file
   - Verify write succeeded
3. Track created/modified files

#### Step-Executor Delegation

Read `.claude/agents/step-executor.md` and spawn:

```
Task tool call:
  subagent_type: step-executor
  description: "Execute quick implementation for ${feature_name}"
  prompt: |
    {Contents of step-executor.md}

    ---

    ## Your Task

    Feature: ${feature_name}
    Components:
    {component list from plan with full skill prompts}

    Execution mode: {parallel | sequential}
```

Process results and **update state file** (MANDATORY):
- Read current state file
- Move completed components from `pendingComponents` to `completedComponents`
- Record any failures in `failedAttempts`
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

### Step 10: Update State and Report (MANDATORY)

**CRITICAL**: You MUST update the state file to mark completion.

1. **Read current state file**
2. **Update to completed status**:
```json
{
  "status": "completed",
  "phase": "completed",
  "verificationResults": {
    "buildStatus": "success",
    "testStatus": "success | skipped",
    "timestamp": "{ISO timestamp}"
  },
  "completedAt": "{ISO timestamp}",
  "lastUpdated": "{ISO timestamp}"
}
```
3. **Write back using Write tool**
4. **Verify the update** by reading file again

Report to user:

```
✅ Quick implementation complete!

${TICKET_ID}: ${DESCRIPTION}

Components created/modified:
- {file1}
- {file2}

Build: Success
Tests: {Success | Skipped}

State: .5/${feature_name}/state.json

Next steps:
1. Review and commit changes
2. For a new task, run `/clear` before starting
```

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

