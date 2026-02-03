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

## ⚠️ CRITICAL SCOPE CONSTRAINT

**THIS COMMAND ONLY CREATES THE FEATURE SPECIFICATION. IT DOES NOT IMPLEMENT.**

Your job in this phase:
✅ Ask questions
✅ Explore codebase
✅ Create feature.md file
✅ Tell user to run /5:plan-implementation

Your job is NOT:
❌ Create implementation plans
❌ Map to technical components
❌ Write any code
❌ Start implementation

**After creating feature.md and informing the user, YOUR JOB IS COMPLETE. EXIT IMMEDIATELY.**

## ❌ Boundaries: What This Command Does NOT Do

**CRITICAL:** This command has a LIMITED scope. Do NOT:

- ❌ **Create implementation plans** - That's Phase 2 (`/5:plan-implementation`)
- ❌ **Map components to skills** - That's Phase 2's job
- ❌ **Start any implementation** - That's Phase 3 (`/5:implement-feature`)
- ❌ **Write any code** - Not even example code
- ❌ **Create TodoWrite task lists** - Wrong phase
- ❌ Ask for ticket ID (extract from branch name automatically)
- ❌ Skip asking for feature description first
- ❌ Ask questions before exploring the codebase
- ❌ Skip the intensive Q&A phase
- ❌ Accept vague requirements

**If you find yourself doing any of the above, STOP IMMEDIATELY. You are exceeding this command's scope.**

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

Write a comprehensive feature spec to `.5/{TICKET-ID}-{description}/feature.md` using the template structure.

**THIS IS YOUR FINAL OUTPUT. After creating this file, proceed immediately to Step 7.**

**Template Reference:** Use the structure from `.claude/templates/workflow/FEATURE-SPEC.md`

The template contains placeholders like `{TICKET-ID}`, `{Title}`, `{1-2 sentence overview}`, etc. Replace all placeholders with actual values based on your research and the Q&A session.

Key sections to populate:
- **Ticket ID & Summary** - From branch extraction and feature description
- **Problem Statement** - Why this feature is needed
- **Requirements** - Functional and non-functional requirements from discussion
- **Constraints** - Business, technical, and time constraints identified
- **Affected Components** - Discovered from codebase exploration
- **Entity Definitions** - If the feature involves new data structures
- **Acceptance Criteria** - Verifiable criteria for success
- **Alternatives Considered** - Options discussed and why chosen approach was selected
- **Questions & Answers** - Document the Q&A from the collaboration phase
- **Next Steps** - Instructions for proceeding to Phase 2

## Instructions

Follow these steps **IN ORDER** and **STOP after step 8**:

1. **Ask for feature description** - Request task description and additional information from developer
2. **Extract Ticket ID** - Get current branch name and extract ticket ID using configured pattern
3. **Explore the codebase** - Understand existing patterns and affected modules
4. **Ask 5-10 clarifying questions** - Based on findings, ask informed questions using AskUserQuestion - This is MANDATORY
5. **Challenge assumptions** - Present alternatives, question complexity
6. **Determine feature name** - Create short kebab-case description
7. **Create feature specification** in `.5/{TICKET-ID}-{description}/feature.md`
8. **Inform the developer** to review the spec, run `/clear` to reset context, and then run `/5:plan-implementation {TICKET-ID}-{description}`

**🛑 STOP HERE. YOUR JOB IS COMPLETE. DO NOT PROCEED TO IMPLEMENTATION.**

## Key Principles

1. **Feature description first** - Get context before asking detailed questions
2. **Auto-extract ticket ID** - Parse from branch name automatically
3. **Explore before questioning** - Understand codebase to ask informed questions
4. **Challenge assumptions** - Don't accept requirements at face value
5. **Explore alternatives** - Present options and trade-offs
6. **Document decisions** - Capture why choices were made
7. **Structured output** - Use the feature spec template consistently
8. **Clear handoff** - Tell developer what to do next


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
10. Skill tells user: "✅ Feature spec created at `.5/PROJ-1234-add-emergency-schedule/feature.md`

    **Next steps:**
    1. Review the feature spec
    2. If changes needed: `/5:discuss-feature PROJ-1234-add-emergency-schedule`
    3. If approved:
       - **Run `/clear` to reset context** (recommended between phases)
       - Then run `/5:plan-implementation PROJ-1234-add-emergency-schedule`"

**🛑 COMMAND COMPLETE. The skill stops here and waits for user to proceed to Phase 2.**

## Related Documentation

- [5-Phase Workflow Guide](../docs/workflow-guide.md)
