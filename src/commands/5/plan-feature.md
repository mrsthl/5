---
name: 5:plan-feature
description: Plans feature implementation by analyzing requirements, identifying affected modules, and creating a structured feature specification. Use at the start of any new feature to ensure systematic implementation. This is Phase 1 of the 5-phase workflow.
allowed-tools: Bash, Write, Task, AskUserQuestion
context: fork
user-invocable: true
---

# Plan Feature Implementation (Phase 1)

## Prerequisites Check

**CRITICAL: Check for configuration before proceeding**

```bash
if [ ! -f ".claude/.5/config.json" ]; then
  echo "❌ Configuration not found"
  echo ""
  echo "Please run /5:configure first to set up your project."
  echo ""
  echo "The configure command will:"
  echo "  • Detect your project type and build commands"
  echo "  • Set up ticket tracking conventions"
  echo "  • Generate documentation (CLAUDE.md)"
  echo "  • Create project-specific skills"
  exit 1
fi
```

**If config doesn't exist, STOP IMMEDIATELY. Do not proceed with the workflow.**

## Overview

This skill is the **first phase** of the 5-phase workflow:
1. **Feature Planning** (this skill) - Understand requirements, create feature spec
2. **Implementation Planning** - Map to technical components and skills
3. **Orchestrated Implementation** - Execute with state tracking
4. **Verify Implementation** - Check completeness and correctness
5. **Code Review** - Apply automated quality improvements

This skill guides intensive collaboration with the developer to understand requirements, challenge assumptions, and create a comprehensive feature specification.

## ⚠️ CRITICAL ARCHITECTURE

**This command uses a READ-ONLY sub-agent for codebase exploration.**

You (the main agent) orchestrate the process:
- You ask questions via AskUserQuestion
- You spawn a read-only Explore agent to analyze the codebase
- You receive findings from the sub-agent
- You create the feature.md file
- You inform the user of next steps

**The sub-agent CANNOT write files or implement anything. It can only read and report.**

## ⚠️ CRITICAL SCOPE CONSTRAINT

**THIS COMMAND ONLY CREATES THE FEATURE SPECIFICATION. IT DOES NOT IMPLEMENT.**

Your job in this phase:
✅ Ask questions
✅ Spawn read-only sub-agent to explore codebase
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

### Step 3: Spawn Read-Only Explore Agent

**CRITICAL: Delegate ALL codebase exploration to a sub-agent.**

Spawn a Task with `subagent_type=Explore` with the following prompt structure:

```
Analyze the codebase for a feature planning session.

**Feature Description:** {paste the user's feature description here}

**Your Task:**
1. Explore the project structure to identify modules/components
2. Find existing implementations similar to this feature
3. Identify coding patterns and conventions used
4. Find reusable components or patterns
5. Identify which existing files/modules would be affected

**Report Format:**
Return a structured report with:
- Project structure overview
- Relevant existing patterns found
- Similar implementations discovered
- Affected modules/files
- Reusable components identified
- Potential integration points

**IMPORTANT:** You are a READ-ONLY agent. Only use Read, Glob, and Grep tools. Do NOT suggest implementations or write any code.
```

**Wait for the sub-agent to return its findings before proceeding.**

### Step 4: Intensive Collaboration (5-10 Questions, ONE AT A TIME)

**CRITICAL:** After receiving the exploration report, engage in intensive Q&A. This is NOT optional.

- Ask 5-10 clarifying questions using AskUserQuestion
- **ONE question at a time** - wait for answer before next question
- Do NOT list multiple questions in one message
- Do NOT skip to creating feature.md before asking at least 5 questions
- **Use the sub-agent's findings to inform your questions**

#### Step 4b: Optional Targeted Re-Exploration

During Q&A, the user may mention components, modules, or patterns that weren't covered in the initial exploration. You MAY spawn additional targeted Explore agents to gather more specific information.

**When to trigger re-exploration:**
- User mentions a specific file, module, or service by name that wasn't in the initial report
- User's answer reveals a dependency or integration point not previously identified
- User asks "have you looked at X?" or "what about the Y module?"
- Understanding a specific component is critical for accurate feature specification

**How to re-explore:**

Spawn a targeted Task with `subagent_type=Explore`:

```
Targeted exploration for feature planning.

**Context:** During Q&A, the user mentioned {specific component/module/pattern}.

**Focused Task:**
1. Find and analyze {specific component} mentioned by user
2. Understand how it works and its patterns
3. Identify how it might relate to the planned feature

**Report:** Provide a focused summary of:
- How this component works
- Relevant patterns or conventions
- How it could integrate with the planned feature

**IMPORTANT:** READ-ONLY. Only use Read, Glob, and Grep tools.
```

**Guidelines:**
- Keep re-explorations focused and specific (not broad searches)
- Use findings to ask better follow-up questions
- Document relevant discoveries in the final feature spec

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

6. **Integration Points** (informed by sub-agent findings)
   - Which existing components/modules are affected?
   - Are there API changes?
   - How does this interact with existing features?

7. **Alternative Approaches** (informed by sub-agent findings)
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
- "Could we use existing Z component instead?" (reference sub-agent findings)
- "Is a full factory needed or just simple creation?"

**Ask questions ONE AT A TIME.** Use AskUserQuestion for each question. For clarifying questions, provide 2-4 options where meaningful. Wait for the user's answer before asking the next question. Open questions (like feature description) can use free text.

### Step 5: Determine Feature Name

Based on the feature description and discussion:
- Create a short, kebab-case description (e.g., "add-emergency-schedule")
- This will be used for the feature spec filename: `{TICKET-ID}-{description}.md`

### Step 6: Create Feature Specification

Write a comprehensive feature spec to `.5/features/{TICKET-ID}-{description}/feature.md` using the Write tool.

**THIS IS YOUR FINAL OUTPUT. After creating this file, proceed immediately to Step 7.**

**Template Reference:** Use the structure from `.claude/templates/workflow/FEATURE-SPEC.md`

The template contains placeholders like `{TICKET-ID}`, `{Title}`, `{1-2 sentence overview}`, etc. Replace all placeholders with actual values based on your research and the Q&A session.

Key sections to populate:
- **Ticket ID & Summary** - From branch extraction and feature description
- **Problem Statement** - Why this feature is needed
- **Requirements** - Functional and non-functional requirements from discussion
- **Constraints** - Business, technical, and time constraints identified
- **Affected Components** - From sub-agent exploration report
- **Entity Definitions** - If the feature involves new data structures
- **Acceptance Criteria** - Verifiable criteria for success
- **Alternatives Considered** - Options discussed and why chosen approach was selected
- **Questions & Answers** - Document the Q&A from the collaboration phase
- **Next Steps** - Instructions for proceeding to Phase 2

## Instructions

Follow these steps **IN ORDER** and **STOP after step 8**:

1. **Ask for feature description** - Request task description and additional information from developer
2. **Extract Ticket ID** - Get current branch name and extract ticket ID using configured pattern
3. **Spawn Explore sub-agent** - Delegate codebase analysis to read-only agent, wait for report
4. **Ask 5-10 clarifying questions** - Based on sub-agent findings, ask informed questions using AskUserQuestion - This is MANDATORY
   - **4b. Re-explore as needed** - If user mentions unknown components during Q&A, spawn targeted Explore agents
5. **Challenge assumptions** - Present alternatives, question complexity
6. **Determine feature name** - Create short kebab-case description
7. **Create feature specification** in `.5/features/{TICKET-ID}-{description}/feature.md` using Write tool
8. **Inform the developer** to review the spec, run `/clear` to reset context, and then run `/5:plan-implementation {TICKET-ID}-{description}`

**🛑 STOP HERE. YOUR JOB IS COMPLETE. DO NOT PROCEED TO IMPLEMENTATION.**

## Key Principles

1. **Feature description first** - Get context before asking detailed questions
2. **Auto-extract ticket ID** - Parse from branch name automatically
3. **Delegate exploration** - Use read-only sub-agent for codebase analysis
4. **Explore before questioning** - Wait for sub-agent report before asking questions
5. **Challenge assumptions** - Don't accept requirements at face value
6. **Explore alternatives** - Present options and trade-offs
7. **Document decisions** - Capture why choices were made
8. **Structured output** - Use the feature spec template consistently
9. **Clear handoff** - Tell developer what to do next


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

1. User runs: `/5:plan-feature`
2. Main agent asks: "Please describe the feature you want to develop"
3. User: "I want to add emergency schedule tracking to products. It should allow marking products as emergency and setting a schedule window."
4. Main agent extracts: Ticket ID `PROJ-1234` from branch `PROJ-1234-add-emergency-schedule`
5. **Main agent spawns Explore sub-agent** with feature description
6. **Sub-agent returns report:** Found Product model at src/models/Product.ts, existing ScheduleService at src/services/ScheduleService.ts, similar pattern in src/models/Promotion.ts...
7. Main agent asks Question 1: "Should emergency schedules support recurring patterns or just one-time windows?"
8. User answers: "One-time for now, but we have the NotificationService that should trigger alerts"
9. **Main agent spawns targeted Re-Explore** for NotificationService (wasn't in initial report)
10. **Sub-agent returns:** Found NotificationService at src/services/NotificationService.ts with event-based triggers...
11. Main agent continues Q&A with better context about notifications
12. Main agent challenges: "The sub-agent found existing ScheduleService - could we reuse it instead of creating new scheduling infrastructure?"
13. Main agent determines: Feature name `add-emergency-schedule`
14. Main agent creates: `.5/features/PROJ-1234-add-emergency-schedule/feature.md` using Write tool
15. Main agent tells user: "✅ Feature spec created at `.5/features/PROJ-1234-add-emergency-schedule/feature.md`

    **Next steps:**
    1. Review the feature spec
    2. If changes needed: `/5:discuss-feature PROJ-1234-add-emergency-schedule`
    3. If approved:
       - **Run `/clear` to reset context** (recommended between phases)
       - Then run `/5:plan-implementation PROJ-1234-add-emergency-schedule`"

**🛑 COMMAND COMPLETE. The skill stops here and waits for user to proceed to Phase 2.**

## Related Documentation

- [5-Phase Workflow Guide](../docs/workflow-guide.md)
