---
name: 5:discuss-feature
description: Discusses and refines an existing feature specification through iterative Q&A. Use after /plan-feature when requirements need clarification or changes. Updates the feature spec based on discussion.
allowed-tools: Read, Write, Glob, Grep, Task, AskUserQuestion
context: inherit
user-invocable: true
---

# Discuss Feature Specification (Phase 1 - Optional Iteration)

## Overview

This skill is part of **Phase 1** (Feature Planning) of the 5-phase workflow:
1. **Feature Planning** - Initial requirements gathering (`/plan-feature`), then optional iteration (`/discuss-feature`)
2. **Implementation Planning** - Map to technical components
3. **Orchestrated Implementation** - Execute with state tracking
4. **Verify Implementation** - Check completeness and correctness
5. **Code Review** - Apply automated quality improvements

This skill enables **optional iterative refinement** of feature specs after initial planning through discussion, clarification, and requirement changes. Use it when the initial spec needs adjustments before proceeding to implementation planning.

## ⚠️ CRITICAL SCOPE CONSTRAINT

**THIS COMMAND ONLY UPDATES FEATURE SPECIFICATIONS. IT DOES NOT PLAN OR IMPLEMENT.**

Your job in this command:
✅ Read existing feature specification
✅ Ask what user wants to discuss
✅ Explore codebase if needed for context
✅ Ask clarifying questions
✅ Update feature specification
✅ Tell user to run /5:plan-implementation

Your job is NOT:
❌ Create new feature specs (use /5:plan-feature)
❌ Create implementation plans
❌ Map to technical components
❌ Start implementation
❌ Write any code
❌ Rewrite entire feature spec (only update changed sections)

**After updating the feature spec and informing the user, YOUR JOB IS COMPLETE. EXIT IMMEDIATELY.**

## Use Cases

Use this skill when:
- Requirements need clarification after initial planning
- User wants to add/modify/remove requirements
- Scope needs adjustment
- Technical constraints discovered during exploration
- Alternative approaches need evaluation
- Feature complexity needs reduction
- Acceptance criteria need refinement

## Prerequisites

Before invoking this skill, ensure:
1. Feature spec exists at `.5/features/{feature-name}/feature.md`
2. You have the feature name or ticket ID ready (e.g., "PROJ-1234-add-feature")

## Discussion Process

### Step 1: Extract Feature Name

If user provides only ticket ID (e.g., "PROJ-1234"), find the feature file:
- Use Glob: `.5/features/{TICKET-ID}-*/feature.md` (pattern from config)
- Match the ticket ID
- If multiple matches, ask user to specify
- If no match found, inform user and suggest running `/plan-feature` first

If user provides full feature name (e.g., "PROJ-1234-add-feature"), use directly.

### Step 2: Read Feature Specification

Read the feature spec from `.5/features/{feature-name}/feature.md`.

Extract current state:
- Ticket ID
- Summary
- Requirements (functional and non-functional)
- Constraints
- Affected domains
- Entity definitions
- Business rules
- Acceptance criteria
- Alternatives considered
- Questions & Answers

### Step 3: Initial Discussion Prompt

**FIRST ACTION:** Ask the user what they want to discuss using AskUserQuestion.

Prompt to use:

"What would you like to discuss or change about this feature?"

Provide context options for common scenarios:
- "Clarify existing requirements"
- "Add new requirements"
- "Remove or simplify requirements"
- "Change scope or approach"
- "Discuss technical constraints"
- "Review acceptance criteria"
- "Other (specify)"

Use `multiSelect: false` to get single focus area initially.

### Step 4: Contextual Exploration (Optional)

Based on the user's focus area, explore the codebase if needed:

**For technical constraint discussions:**
- Search for similar implementations
- Check existing patterns
- Identify integration points

**For scope changes:**
- Verify affected modules
- Check dependencies
- Identify ripple effects

Use Task tool with subagent_type=Explore for complex exploration.

### Step 5: Interactive Q&A

Based on the discussion topic, ask targeted follow-up questions using AskUserQuestion.

**Question types by topic:**

**Clarify Requirements:**
- "The current requirement says X. Should it also handle Y scenario?"
- "How should the system behave when Z happens?"
- "Are there edge cases we haven't considered?"

**Add Requirements:**
- "What is the expected behavior for this new requirement?"
- "How does this interact with existing requirement X?"
- "Should this be in scope or future work?"

**Simplify/Remove:**
- "If we remove X, what's the minimum viable version?"
- "Can we defer Y to a future iteration?"
- "Would simpler approach Z meet the core need?"

**Change Approach:**
- "What are the pros/cons of approach A vs B?"
- "Have you considered alternative C?"
- "What's the trade-off we're trying to optimize?"

**Technical Constraints:**
- "Is performance constraint X realistic?"
- "Should we use existing component Y instead?"
- "How will this integrate with system Z?"

**Acceptance Criteria:**
- "How will we verify requirement X is met?"
- "What does success look like for this feature?"
- "Are there specific test scenarios?"

### Step 6: Iterative Refinement

After each round of Q&A:
1. Summarize what you've learned
2. Ask: "Would you like to discuss anything else about this feature?"
3. Provide options:
   - "Yes, discuss another aspect"
   - "Yes, continue this topic"
   - "No, update the spec"

Allow multiple rounds of discussion until user is satisfied.

### Step 7: Update Feature Specification

When user indicates they're done discussing, update `.5/features/{feature-name}/feature.md`:

**Update these sections based on discussion:**

1. **Summary** - If core understanding changed
2. **Problem Statement** - If motivation clarified
3. **Requirements** - Add/modify/remove based on discussion
4. **Constraints** - Add new constraints discovered
5. **Affected Domains** - If scope changed
6. **Entity/Component Definitions** - If data model changed
7. **Business Rules** - If logic clarified
8. **Acceptance Criteria** - Add/refine verification criteria
9. **Alternatives Considered** - Document discussed alternatives
10. **Questions & Answers** - Append new Q&A from this session

**Preserve existing content** - Only update sections that changed during discussion.

**Track changes** - Add a "Discussion History" section if it doesn't exist:

```markdown
## Discussion History

### Session 1: {Date} - {Topic}
**Changes made:**
- Added requirement: {X}
- Clarified: {Y}
- Removed: {Z}

**Rationale:** {Why these changes}
```

### Step 8: Inform Developer

After updating the spec, tell the developer:

1. "Feature specification updated at `.5/features/{feature-name}/feature.md`"
2. Summarize key changes:
   - "Added: {X}"
   - "Modified: {Y}"
   - "Removed: {Z}"
3. Ask: "Would you like to:"
   - "Discuss more (run /5:discuss-feature again)"
   - "Proceed to implementation planning (run `/clear` followed by `/5:plan-implementation {feature-name}`)"
   - "Review the updated spec first"

## Key Principles

1. **User-driven** - Follow user's focus areas, don't prescribe
2. **Iterative** - Allow multiple discussion rounds
3. **Contextual** - Explore codebase when relevant
4. **Challenge constructively** - Question complexity, suggest alternatives
5. **Document evolution** - Track how requirements changed
6. **Preserve history** - Keep previous Q&A, add new discussions
7. **Clear next steps** - Guide user on what to do next


## Example Workflow

```
User: /discuss-feature PROJ-1234-add-feature

Skill: [Reads feature spec]
Skill: "What would you like to discuss or change about this feature?"
User: "Clarify existing requirements"

Skill: "The current spec mentions 'emergency schedule window'. Should this support single or multiple windows? Recurring schedules?"
User: "Just single window per product for now"

Skill: "Should we support updating/deleting the window after it's set?"
User: "Yes, full CRUD"

Skill: "Would you like to discuss anything else?"
User: "No, update the spec"

Skill: [Updates Requirements and Acceptance Criteria sections]
Skill: "Feature spec updated. Changes:
- Clarified: Single emergency window per product
- Added: Full CRUD operations
Next: /clear then /5:plan-implementation PROJ-1234-add-feature"
```

## Related Documentation

- [5-Phase Workflow Guide](../docs/workflow-guide.md)
- [plan-feature command](./plan-feature.md)
- [plan-implementation command](./plan-implementation.md)
