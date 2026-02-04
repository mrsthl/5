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

## ❌ Boundaries: What This Command Does NOT Do

**CRITICAL:** This command has a LIMITED scope. Do NOT:

- ❌ **Create new feature specs** - That's /5:plan-feature
- ❌ **Create implementation plans** - That's Phase 2 (/5:plan-implementation)
- ❌ **Start implementation** - That's Phase 3 (/5:implement-feature)
- ❌ **Write any code** - This is planning only
- ❌ **Rewrite entire spec** - Only update sections that changed
- ❌ **Delete previous Q&A** - Append new discussions, keep history

**If you find yourself creating plans or writing code, STOP IMMEDIATELY. You are exceeding this command's scope.**

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
1. Feature spec exists at `.5/{feature-name}/feature.md`
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

## Instructions Summary

Follow these steps **IN ORDER** and **STOP after step 9**:

1. **Extract feature name** - From user input or by matching ticket ID
2. **Read feature spec** - Load current state from `.5/features/{feature-name}/feature.md`
3. **Ask initial question** - What do they want to discuss?
4. **Explore if needed** - Understand codebase context
5. **Interactive Q&A** - Multiple rounds of clarifying questions
6. **Iterate** - Allow continued discussion until user is satisfied
7. **Update feature spec** - Modify only the relevant sections that changed
8. **Track changes** - Document discussion history
9. **Inform developer** - Summarize changes and ask: "Discuss more or run `/clear` followed by `/5:plan-implementation {feature-name}`?"

**🛑 STOP HERE. YOUR JOB IS COMPLETE. DO NOT CREATE IMPLEMENTATION PLANS.**

## Key Principles

1. **User-driven** - Follow user's focus areas, don't prescribe
2. **Iterative** - Allow multiple discussion rounds
3. **Contextual** - Explore codebase when relevant
4. **Challenge constructively** - Question complexity, suggest alternatives
5. **Document evolution** - Track how requirements changed
6. **Preserve history** - Keep previous Q&A, add new discussions
7. **Clear next steps** - Guide user on what to do next


## Discussion Patterns

### Pattern 1: Scope Reduction
User: "This is too complex, can we simplify?"
Skill:
1. Ask: "What's the minimum viable version?"
2. Ask: "Which requirements are must-have vs nice-to-have?"
3. Present options for phased approach
4. Update spec with reduced scope

### Pattern 2: Requirement Addition
User: "We need to also handle X scenario"
Skill:
1. Ask: "How should X scenario work?"
2. Ask: "How does X interact with existing requirement Y?"
3. Ask: "Should X be in this feature or separate?"
4. Update requirements section

### Pattern 3: Technical Feasibility
User: "Can we reuse existing component Z?"
Skill:
1. Explore: Find component Z implementation
2. Ask: "Does Z fully meet the need or need extension?"
3. Present trade-offs: reuse vs custom
4. Update affected domains and approach

### Pattern 4: Acceptance Criteria
User: "How do we verify this works?"
Skill:
1. Ask: "What's the happy path test?"
2. Ask: "What edge cases should we test?"
3. Ask: "What does failure look like?"
4. Update acceptance criteria section

### Pattern 5: Alternative Evaluation
User: "Should we use approach A or B?"
Skill:
1. Ask: "What's the goal: simplicity, performance, flexibility?"
2. Present pros/cons of each approach
3. Ask: "What constraints matter most?"
4. Update alternatives considered section

## Example Workflow

### Example 1: Scope Clarification

```
User: /discuss-feature PROJ-1234-add-feature

Skill: [Reads feature spec]
Skill: "What would you like to discuss or change about this feature?"

User: "Clarify existing requirements"

Skill: "The current spec mentions 'emergency schedule window'. Should this support:
- Single time window per product?
- Multiple overlapping windows?
- Recurring schedules?
What level of complexity do you need?"

User: "Just single window per product for now"

Skill: "Should we support updating/deleting the window after it's set?"

User: "Yes, full CRUD"

Skill: "Would you like to discuss anything else about this feature?"

User: "No, update the spec"

Skill: [Updates Requirements and Acceptance Criteria sections]
Skill: "Feature specification updated. Changes:
- Clarified: Single emergency window per product (not multiple)
- Added: Full CRUD operations for emergency windows
Would you like to proceed to implementation planning? Run `/clear` followed by `/5:plan-implementation PROJ-1234-add-feature`"
```

### Example 2: Adding Requirements

```
User: /discuss-feature PROJ-1234

Skill: [Finds PROJ-1234-add-feature.md]
Skill: "What would you like to discuss or change about this feature?"

User: "Add new requirements"

Skill: "What new requirement would you like to add?"

User: "We need to notify customers when emergency schedule is activated"

Skill: "How should notifications be delivered?
- Email only
- SMS only
- Both email and SMS
- Configurable per customer"

User: "Email only for now"

Skill: "Should notification be:
- Immediate when emergency schedule is created?
- When emergency window starts?
- Both?"

User: "When emergency window starts"

Skill: "Would you like to discuss anything else?"

User: "No, update the spec"

Skill: [Updates Requirements, adds email notification requirement]
Skill: [Updates Affected Domains, adds email service integration]
Skill: [Updates Acceptance Criteria, adds notification verification]
Skill: "Feature specification updated. Changes:
- Added: Email notification when emergency window starts
- Added: Integration with email service
Review the changes and run `/clear` followed by `/5:plan-implementation PROJ-1234-add-feature` when ready"
```

### Example 3: Simplification

```
User: /discuss-feature PROJ-1234-add-feature

Skill: "What would you like to discuss or change about this feature?"

User: "Remove or simplify requirements"

Skill: "Current requirements include:
1. Emergency schedule CRUD
2. Email notifications
3. Audit logging
4. Analytics tracking
Which are critical for MVP?"

User: "Just #1 and #3. We can add notifications and analytics later"

Skill: "So we'll keep emergency schedule CRUD and audit logging, defer notifications and analytics to future work?"

User: "Correct"

Skill: [Updates Requirements, moves #2 and #4 to "Future Enhancements" section]
Skill: [Updates Affected Domains, removes email and analytics integrations]
Skill: "Feature specification updated. Changes:
- Removed: Email notifications (moved to future enhancements)
- Removed: Analytics tracking (moved to future enhancements)
- Kept: Core CRUD and audit logging
The simplified scope should reduce implementation complexity significantly."
```

## Tips for Effective Discussion

1. **Read the spec first** - Understand current state before asking questions
2. **Focus on one topic** - Don't try to discuss everything at once
3. **Ask open questions** - Let user explain their thinking
4. **Present options** - Give user choices with pros/cons
5. **Challenge gently** - "Have you considered..." not "You should..."
6. **Summarize often** - Confirm understanding before moving on
7. **Track rationale** - Document WHY decisions were made
8. **Be patient** - Allow multiple rounds until clarity emerges

## Related Documentation

- [5-Phase Workflow Guide](../docs/workflow-guide.md)
- [plan-feature command](./plan-feature.md)
- [plan-implementation command](./plan-implementation.md)
