---
name: 5:plan-feature
description: Plans feature implementation by analyzing requirements, identifying affected modules, and creating a structured feature specification. Use at the start of any new feature to ensure systematic implementation. This is Phase 1 of the 5-phase workflow.
agent: feature-planner
allowed-tools: Read, Write, Task, AskUserQuestion, TaskCreate, TaskUpdate, TaskList, TaskGet
context: fork
user-invocable: true
disable-model-invocation: true
---

# Plan Feature (Phase 1)

## Common Feature Types

- **New Component/Module** — Core logic, data structures, tests. Questions: Validation rules? Business logic? API design?
- **Extend Existing Component** — Update existing code, maintain compatibility. Questions: Breaking change? Migration needed?
- **Add Business Rule** — Logic implementation, validation. Questions: When enforced? Edge cases?
- **API Endpoint** — Endpoint, request/response handling. Questions: API design? Error handling? Authentication?

## Example Workflow

1. User runs `/5:plan-feature`
2. Agent asks: "Please describe the feature you want to develop"
3. User provides feature description
4. Agent extracts Ticket ID from branch name
5. Agent spawns Explore sub-agent for codebase analysis
6. Sub-agent returns findings
7. Agent asks 5-10 clarifying questions (one at a time), informed by findings
8. Agent creates `.5/features/{TICKET-ID}-{description}/feature.md`
9. Agent outputs: "Feature spec created. Next: /clear then /5:plan-implementation"

## Process

### Step 0: Activate Planning Guard

Write the planning guard marker to `.5/.planning-active` using the Write tool:

```json
{
  "phase": "plan-feature",
  "startedAt": "{ISO-timestamp}"
}
```

This activates the plan-guard hook which prevents accidental source file edits during planning. The marker is removed automatically when implementation starts (`/5:implement-feature`), expires after 4 hours, or can be cleared manually with `/5:unlock`.

### Step 0b: Create Progress Checklist

Create a progress checklist using TaskCreate. Create all 8 tasks in order:

| # | Subject | activeForm | Description |
|---|---------|------------|-------------|
| 1 | Activate planning guard | Activating planning guard | Write `.5/.planning-active` marker |
| 2 | Gather feature description | Gathering feature description | Ask developer for feature description via AskUserQuestion |
| 3 | Extract ticket ID from branch | Extracting ticket ID | Extract from git branch, sanitize, confirm with developer |
| 4 | Explore codebase for patterns | Exploring codebase | Spawn Explore sub-agent for project analysis |
| 5 | Ask 5+ clarifying questions (one at a time) | Asking clarifying questions | Min. 5 questions, one at a time, via AskUserQuestion |
| 6 | Pre-write checkpoint | Running pre-write checkpoint | Verify 5+ Q&A, no code, spec contains only WHAT/WHY |
| 7 | Write feature specification | Writing feature specification | Create `.5/features/{ID}-{desc}/feature.md` |
| 8 | Output completion message and STOP | Completing planning phase | Output message, then STOP |

After creating all 8 tasks: Mark task 1 as `completed` (Step 0 is already done). Mark task 2 as `in_progress`.

> **MANDATORY:** Before starting ANY step, mark the corresponding task as `in_progress`. After completing, mark as `completed`. Never skip a task.

### Step 1: Gather Feature Description

> Task tracking: Mark "Gather feature description" → `in_progress` before, `completed` after.

Ask the developer for the feature description using AskUserQuestion:

"Please describe the feature you want to develop. Paste the full ticket description or explain it in your own words."

- Expect free-text answer, do NOT provide options
- Do NOT ask follow-up questions yet

### Step 2: Extract Ticket ID

> Task tracking: Mark "Extract ticket ID" → `in_progress`/`completed`.

Extract the ticket ID from the current git branch:
- Use `git branch --show-current` via a Bash-free approach: spawn a quick Explore agent if needed
- Branch format: `{TICKET-ID}-description`
- Extract using configurable pattern from config
- Ask the developer to confirm the ticket ID
- If not found, ask for it

**Sanitize the ticket ID:** The ticket ID is used in directory paths (`.5/features/{TICKET-ID}-{desc}/`). Only allow alphanumeric characters, dashes (`-`), and underscores (`_`). Reject or strip any other characters (especially `/`, `..`, `~`, spaces). If the sanitized result is empty, ask the user for a valid ticket ID.

### Step 3: Spawn Explore Agent for Codebase Analysis

> Task tracking: Mark "Explore codebase for patterns" → `in_progress`/`completed` when sub-agent returns.

Spawn a Task with `subagent_type=Explore`:

```
Analyze the codebase for a feature planning session.

**Feature Description:** {paste the user's feature description}

**Your Task:**
1. Explore project structure to identify modules/components
2. Find existing implementations similar to this feature
3. Identify coding patterns and conventions
4. Find reusable components or patterns
5. Identify affected files/modules
6. Run `git branch --show-current` to get the current branch name

**Report Format:**
- Current git branch name
- Project structure overview
- Relevant existing patterns found
- Similar implementations discovered
- Affected modules/files
- Reusable components identified
- Potential integration points

**IMPORTANT:** READ-ONLY agent. Only use Read, Glob, Grep, and Bash (for git branch) tools.
```

Wait for the sub-agent to return before proceeding.

### Step 4: Intensive Q&A (5-10 Questions, One at a Time)

> Task tracking: Mark "Ask 5+ clarifying questions" → `in_progress`. Do NOT mark `completed` until 5+ answers received.

Follow the `<question-strategy>` defined in your agent file.

**Optional re-exploration:** If the user mentions components not covered in the initial report, spawn a targeted Explore agent:

```
Targeted exploration for feature planning.
**Context:** User mentioned {component/module}.
**Task:** Find and analyze {component}, understand patterns, identify relation to planned feature.
**READ-ONLY.** Only use Read, Glob, and Grep tools.
```

### Step 4b: Pre-Write Checkpoint

> Task tracking: Mark "Pre-write checkpoint" → `in_progress`. If fails (< 5 Q&A), mark questions task back to `in_progress` and return to Step 4.

Before writing the feature spec, verify:
1. You asked at least 5 questions and received answers
2. You have NOT written any code or implementation details
3. You can summarize the feature in 1-2 sentences WITHOUT mentioning files, classes, or functions
4. The feature spec will contain ONLY: requirements, constraints, acceptance criteria, Q&A

If you have fewer than 5 Q&A pairs, go back to Step 4 and ask more questions.

### Step 5: Create Feature Specification

> Task tracking: Mark "Write feature specification" → `in_progress`/`completed`.

Determine a feature name: short, kebab-case (e.g., "add-emergency-schedule").

Write to `.5/features/{TICKET-ID}-{description}/feature.md` using Write tool.

Follow the `<output-format>` and `<write-rules>` defined in your agent file.

Populate all sections:
- Ticket ID & Summary
- Problem Statement
- Requirements (functional and non-functional)
- Constraints
- Affected Components (from exploration)
- Acceptance Criteria
- Alternatives Considered
- Questions & Answers (from Q&A session)

## PLANNING COMPLETE

> Task tracking: Mark "Output completion message and STOP" → `in_progress`. Before stopping, call TaskList to verify ALL 8 tasks are `completed`.

After writing feature.md, output exactly:

```
Feature spec created at `.5/features/{name}/feature.md`

Next steps:
1. Review the feature spec
2. If changes needed: /5:discuss-feature {name}
3. If approved: /clear then /5:plan-implementation {name}
```

STOP. You are a planner. Your job is done. Do not implement.
