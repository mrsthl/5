---
name: 5:plan-feature
description: Plans feature implementation by analyzing requirements, identifying affected modules, and creating a structured feature specification. Use at the start of any new feature to ensure systematic implementation. This is Phase 1 of the 5-phase workflow.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion
context: fork
user-invocable: true
---

# Plan Feature Implementation (Phase 1)

## Overview

This skill is the **first phase** of the 5-phase workflow:
1. **Feature Planning** (this skill) - Understand requirements, create feature spec
2. **Implementation Planning** - Map to technical components and skills
3. **Orchestrated Implementation** - Execute with state tracking
4. **Verify Implementation** - Check completeness and correctness
5. **Code Review** - Apply automated quality improvements

This skill guides intensive collaboration with the developer to understand requirements, challenge assumptions, and create a comprehensive feature specification.

## Planning Process

### Step 1: Gather Feature Description

**FIRST ACTION:** Ask the developer for the feature description using AskUserQuestion.

- Expect a **free-text answer**
- Do NOT provide options
- Do NOT ask follow-up questions yet
- This input may be multiple paragraphs

Prompt to use:

"Please describe the feature you want to develop. Paste the full ticket description or explain it in your own words."

Do NOT ask for ticket ID - it will be extracted from the branch name automatically.

### Step 2: Extract Ticket ID from Branch Name

Automatically extract the ticket ID from the current git branch:
- Branch format: `{TICKET-ID}-description` (ticket is prefix)
- Use `git branch --show-current` to get branch name
- Extract ticket ID using configurable pattern from config (e.g., `PROJ-\d+` or `\d+`)
- Ask the developer if the ticket ID is correct
- If no ticket ID found, ask developer for it

### Step 3: Analyze Existing Codebase

Explore the codebase to understand existing patterns and identify affected modules:

```
1. Explore the project structure to identify modules/components
   - Use Glob to discover relevant directories
   - Look for patterns that indicate module organization

2. Check existing implementations in relevant modules
   - Search for similar features or components
   - Identify coding patterns and conventions

3. Check for similar patterns across the codebase
   - Search for class/function patterns that might be reusable
```

Use Task tool with subagent_type=Explore for complex exploration.

**Goal:** Understand what already exists so you can ask informed questions.

### Step 4: Intensive Collaboration (5-10 Questions)

**CRITICAL:** After exploring the codebase, engage in intensive Q&A using the AskUserQuestion tool. Ask 5-10 clarifying questions based on your findings. This is NOT optional.

**Question categories to explore:**

1. **Requirements Clarity**
   - What exactly should this feature do?
   - What is the expected user experience?
   - What are the inputs and outputs?

2. **Scope Boundaries**
   - What is explicitly IN scope?
   - What is explicitly OUT of scope?
   - Are there any constraints or limitations?

3. **Edge Cases**
   - What happens when X fails?
   - How should the system handle invalid inputs?
   - What are the boundary conditions?

4. **Performance Expectations**
   - Are there performance requirements?
   - How much data needs to be handled?
   - Are there concurrency concerns?

5. **Testing Strategy**
   - How will we verify this works?
   - What are the acceptance criteria?
   - What test scenarios should be covered?

6. **Integration Points**
   - Which existing components/modules are affected?
   - Are there API changes?
   - How does this interact with existing features?

7. **Alternative Approaches**
   - Have you considered approach X instead?
   - Is this the simplest solution?
   - Could we reuse existing components?

8. **Complexity Trade-offs**
   - What is the complexity vs value trade-off?
   - Should this be broken into smaller features?
   - Are there simpler alternatives?

**Challenge assumptions:**
- "Is this the simplest solution?"
- "Have you considered X alternative?"
- "What happens when Y fails?"
- "Could we use existing Z component instead?"
- "Is a full factory needed or just simple creation?"

Use AskUserQuestion to present options and trade-offs. Multiple questions can be asked in batches.

### Step 5: Determine Feature Name

Based on the feature description and discussion:
- Create a short, kebab-case description (e.g., "add-emergency-schedule")
- This will be used for the feature spec filename: `{TICKET-ID}-{description}.md`

### Step 6: Create Feature Specification

Write a comprehensive feature spec to `.5/{TICKET-ID}-{description}/feature.md` with the following structure:

```markdown
# Feature: {TICKET-ID} - {Title}

## Ticket ID
{TICKET-ID}

## Summary
{1-2 sentence overview of what will be implemented}

## Problem Statement
{Why is this feature needed? What problem does it solve?}

## Requirements

### Functional Requirements
- {Requirement 1}
- {Requirement 2}
- ...

### Non-Functional Requirements
- {Performance requirements}
- {Compatibility requirements}
- ...

## Constraints
- {Business constraints}
- {Technical constraints}
- {Time/resource constraints}

## Affected Components
- **{component/module-1}** - {What changes here}
- **{component/module-2}** - {What changes here}
- **{component/module-3}** - {What changes here}
- ...

## Entity/Component Definitions

### {EntityName} (if applicable)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | {Entity}Id | Yes | Unique identifier |
| name | String | Yes | Entity name |
| ... | ... | ... | ... |

### Business Rules
- {Rule 1}
- {Rule 2}
- ...

## Acceptance Criteria
- [ ] {Criterion 1 - how to verify success}
- [ ] {Criterion 2}
- [ ] {Criterion 3}
- ...

## Alternatives Considered

### Option 1: {Alternative approach}
**Pros:** {Benefits}
**Cons:** {Drawbacks}
**Decision:** Rejected because {reason}

### Option 2: {Another alternative}
**Pros:** {Benefits}
**Cons:** {Drawbacks}
**Decision:** Rejected because {reason}

### Chosen Approach: {Selected approach}
**Rationale:** {Why this approach was chosen}

## Questions & Answers

### Q1: {Question from collaboration phase}
**A:** {Answer from developer}

### Q2: {Question}
**A:** {Answer}

...

## Next Steps
After approval, run: `/plan-implementation {TICKET-ID}-{description}`
```

## Instructions

1. **Ask for feature description** - Request task description and additional information from developer
2. **Extract Ticket ID** - Get current branch name and extract ticket ID using configured pattern
3. **Explore the codebase** - Understand existing patterns and affected modules
4. **Ask 5-10 clarifying questions** - Based on findings, ask informed questions using AskUserQuestion - This is MANDATORY
5. **Challenge assumptions** - Present alternatives, question complexity
6. **Determine feature name** - Create short kebab-case description
7. **Create feature specification** in `.5/{TICKET-ID}-{description}/feature.md`
8. **Inform the developer** to review the spec and then run `/plan-implementation {TICKET-ID}-{description}`

## Key Principles

1. **Feature description first** - Get context before asking detailed questions
2. **Auto-extract ticket ID** - Parse from branch name automatically
3. **Explore before questioning** - Understand codebase to ask informed questions
4. **Challenge assumptions** - Don't accept requirements at face value
5. **Explore alternatives** - Present options and trade-offs
6. **Document decisions** - Capture why choices were made
7. **Structured output** - Use the feature spec template consistently
8. **Clear handoff** - Tell developer what to do next

## DO NOT in This Skill

- DO NOT ask for ticket ID (extract from branch name automatically)
- DO NOT skip asking for feature description first
- DO NOT ask questions before exploring the codebase
- DO NOT create TodoWrite task lists (that's Phase 2's job)
- DO NOT map components to skills (that's Phase 2's job)
- DO NOT start implementation (that's Phase 3's job)
- DO NOT skip the intensive Q&A phase
- DO NOT accept vague requirements

## Common Feature Types

### New Component/Module
- Requires: Core logic, data structures, tests
- Questions: Validation rules? Business logic? API design?

### Extend Existing Component
- Requires: Update existing code, maintain compatibility
- Questions: Breaking change? Migration needed? Impact on existing functionality?

### Add Business Rule
- Requires: Logic implementation, validation
- Questions: When is rule enforced? What are edge cases?

### API Endpoint
- Requires: Endpoint implementation, request/response handling
- Questions: API design? Error handling? Authentication?

## Example Workflow

1. User runs: `/plan-feature`
2. Skill asks: "Please describe the feature you want to develop"
3. User: "I want to add emergency schedule tracking to products. It should allow marking products as emergency and setting a schedule window."
4. Skill extracts: Ticket ID `PROJ-1234` from branch `PROJ-1234-add-emergency-schedule`
5. Skill explores: Checks Product model, related components, existing scheduling infrastructure
6. Skill asks 8 informed questions about requirements, scope, validation, API, etc.
7. Skill challenges: "Could we reuse existing scheduling infrastructure instead of creating new one?"
8. Skill determines: Feature name `add-emergency-schedule`
9. Skill creates: `.5/PROJ-1234-add-emergency-schedule/feature.md`
10. Skill tells user: "Feature spec created. Please review and then run `/plan-implementation PROJ-1234-add-emergency-schedule`"
11. Skill tells user: "If the feature needs refinements, run `/discuss-feature PROJ-1234-add-emergency-schedule`"

## Related Documentation

- [5-Phase Workflow Guide](../docs/workflow-guide.md)
