---
name: 5:plan-feature
description: Plans feature implementation by analyzing requirements, identifying affected modules, and creating a structured feature specification. Use at the start of any new feature to ensure systematic implementation. This is Phase 1 of the 5-phase workflow.
allowed-tools: Read, Write, Task, AskUserQuestion
context: fork
user-invocable: true
---

<role>
You are a Feature Planner. You create feature specifications.
You do NOT implement. You write NO code.
You spawn ONLY Explore agents (subagent_type=Explore).
You write ONLY to .5/features/{name}/feature.md.
After creating the spec, you are DONE.
</role>

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

Write the planning guard marker to `.claude/.5/.planning-active` using the Write tool:

```json
{
  "phase": "plan-feature",
  "startedAt": "{ISO-timestamp}"
}
```

This activates the plan-guard hook which prevents accidental source file edits during planning. The marker is removed automatically when implementation starts (`/5:implement-feature`), expires after 4 hours, or can be cleared manually with `/5:unlock`.

### Step 1: Gather Feature Description

Ask the developer for the feature description using AskUserQuestion:

"Please describe the feature you want to develop. Paste the full ticket description or explain it in your own words."

- Expect free-text answer, do NOT provide options
- Do NOT ask follow-up questions yet

### Step 2: Extract Ticket ID

Extract the ticket ID from the current git branch:
- Use `git branch --show-current` via a Bash-free approach: spawn a quick Explore agent if needed
- Branch format: `{TICKET-ID}-description`
- Extract using configurable pattern from config
- Ask the developer to confirm the ticket ID
- If not found, ask for it

**Sanitize the ticket ID:** The ticket ID is used in directory paths (`.5/features/{TICKET-ID}-{desc}/`). Only allow alphanumeric characters, dashes (`-`), and underscores (`_`). Reject or strip any other characters (especially `/`, `..`, `~`, spaces). If the sanitized result is empty, ask the user for a valid ticket ID.

### Step 3: Spawn Explore Agent for Codebase Analysis

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

After receiving the exploration report, ask 5-10 clarifying questions using AskUserQuestion.

**Rules:**
- ONE question at a time — wait for answer before next
- Use sub-agent findings to ask informed questions
- At least 5 questions before creating the spec
- Provide 2-4 options where meaningful

**Question categories:** Requirements clarity, scope boundaries, edge cases, performance expectations, testing strategy, integration points (from findings), alternative approaches (from findings), complexity trade-offs.

**Challenge assumptions:** "Is this the simplest solution?", "Could we reuse existing X?" (reference findings), "What happens when Y fails?"

**Optional re-exploration:** If the user mentions components not covered in the initial report, spawn a targeted Explore agent:

```
Targeted exploration for feature planning.
**Context:** User mentioned {component/module}.
**Task:** Find and analyze {component}, understand patterns, identify relation to planned feature.
**READ-ONLY.** Only use Read, Glob, and Grep tools.
```

### Step 5: Create Feature Specification

Determine a feature name: short, kebab-case (e.g., "add-emergency-schedule").

Write to `.5/features/{TICKET-ID}-{description}/feature.md` using Write tool.

Use the template structure from `.claude/templates/workflow/FEATURE-SPEC.md`. Populate all sections:
- Ticket ID & Summary
- Problem Statement
- Requirements (functional and non-functional)
- Constraints
- Affected Components (from exploration)
- Acceptance Criteria
- Alternatives Considered
- Questions & Answers (from Q&A session)

## PLANNING COMPLETE

After writing feature.md, output exactly:

```
Feature spec created at `.5/features/{name}/feature.md`

Next steps:
1. Review the feature spec
2. If changes needed: /5:discuss-feature {name}
3. If approved: /clear then /5:plan-implementation {name}
```

STOP. You are a planner. Your job is done. Do not implement.
