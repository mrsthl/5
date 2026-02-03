---
name: 5:plan-implementation
description: Creates an implementation plan from a feature spec. Phase 2 of the 5-phase workflow.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, Write
context: fork
user-invocable: true
---

# Plan Implementation (Phase 2)

Create an implementation plan that maps a feature spec to concrete components.

## Scope

**This command creates the plan. It does NOT implement.**

After creating the plan, tell the user to run `/5:implement-feature`.

## Process

### Step 1: Load Feature Spec

Read `.5/{feature-name}/feature.md` (where `{feature-name}` is the argument provided).

Extract:
- Ticket ID
- Requirements (functional and non-functional)
- Acceptance criteria
- Affected components mentioned

If the file doesn't exist, tell the user to run `/5:plan-feature` first.

### Step 2: Quick Codebase Scan

Understand the project structure:
- Use Glob to find source directories
- Identify where similar components live (models, services, controllers, tests)
- Note naming conventions from existing files

This is a quick scan, not deep analysis. The executor agent will do detailed pattern matching.

### Step 3: Ask 2-3 Technical Questions (ONE AT A TIME)

**CRITICAL:** Ask questions ONE AT A TIME. Wait for the user's answer before asking the next question.

Use AskUserQuestion to clarify:
- Data layer decisions (if applicable)
- Key implementation choices
- Anything unclear from the feature spec
- Software Architecture
- Testing behaviour

Keep it brief. Don't over-question. Don't ask feature questions already answered in the plan-feature phase.

- **ONE question at a time** - wait for answer before next question
- Do NOT list multiple questions in one message
- Do NOT skip to creating plan.md before asking your questions 

### Step 4: Design Components

Based on the feature spec and codebase scan, identify:
- What files need to be created
- What files need to be modified
- The order of implementation (dependencies)

Group into steps:
- **Step 1**: Foundation (models, types, interfaces)
- **Step 2**: Logic (services, business rules)
- **Step 3**: Integration (controllers, routes, wiring)
- **Step 4**: Tests (if not created alongside components)

Not every feature needs all steps. Use what makes sense.

### Step 5: Write the Plan

Create a single file at `.5/{feature-name}/plan.md`:

```markdown
---
ticket: {TICKET-ID}
feature: {feature-name}
created: {ISO-timestamp}
---

# Implementation Plan: {TICKET-ID}

{One sentence summary}

## Components

| Step | Component | Action | File | Description | Complexity |
|------|-----------|--------|------|-------------|------------|
| 1 | {name} | create | {path} | {what it does} | simple |
| 1 | {name} | create | {path} | {what it does} | simple |
| 2 | {name} | create | {path} | {what it does} | moderate |
| 2 | {name} | modify | {path} | {what to change} | moderate |
| 3 | {name} | create | {path} | {what it does} | complex |

## Implementation Notes

{Any important context for the executor:}
- Follow the pattern from {existing-file} for {component-type}
- {Key business rule to remember}
- {Integration point to wire up}

## Complexity Guide

**simple** → Use haiku (fast, cheap)
- Creating files that closely follow existing patterns
- Type definitions, interfaces, simple models
- Adding imports/exports
- Straightforward CRUD without custom logic

**moderate** → Use haiku with sonnet fallback
- Services with some business logic
- Files requiring understanding of multiple patterns
- Modifications to existing files

**complex** → Use sonnet (better reasoning)
- Integration points wiring multiple systems
- Complex validation or business rules
- Components requiring architectural decisions
- Significant refactoring of existing code

## Verification

- Build: {command or "auto"}
- Test: {command or "auto"}
```

**Key principle:** The plan describes WHAT to build, not HOW. The executor agent will figure out patterns by reading existing code.

### Step 6: Done

Tell the user:
```
Plan created at `.5/{feature-name}/plan.md`

{N} components across {M} steps.

Review the plan, then:
1. Run `/clear` to reset context (recommended between phases)
2. Run `/5:implement-feature {feature-name}`
```

## Example Plan

```markdown
---
ticket: PROJ-1234
feature: PROJ-1234-add-emergency-schedule
created: 2026-01-28T10:00:00Z
---

# Implementation Plan: PROJ-1234

Add emergency schedule tracking to products with date validation.

## Components

| Step | Component | Action | File | Description | Complexity |
|------|-----------|--------|------|-------------|------------|
| 1 | Schedule model | create | src/models/Schedule.ts | Schedule entity with name, startDate, endDate, isEmergency | simple |
| 1 | Schedule types | create | src/types/schedule.ts | TypeScript interfaces for schedule data | simple |
| 2 | Schedule service | create | src/services/ScheduleService.ts | CRUD operations with date validation (endDate > startDate) | moderate |
| 2 | Schedule repository | create | src/repositories/ScheduleRepository.ts | Database access for schedules | simple |
| 3 | Schedule controller | create | src/controllers/ScheduleController.ts | REST endpoints: GET/POST/DELETE /api/schedules | moderate |
| 3 | Register routes | modify | src/routes/index.ts | Add schedule routes to router | simple |
| 4 | Schedule service tests | create | src/services/__tests__/ScheduleService.test.ts | Test validation and CRUD | moderate |

## Implementation Notes

- Follow the pattern from src/services/UserService.ts for the service
- Follow the pattern from src/controllers/UserController.ts for the controller
- Date validation: endDate must be after startDate, throw ValidationError if not
- Emergency schedules have `isEmergency: true` flag

## Verification

- Build: npm run build
- Test: npm test
```

## Structuring Steps for Parallel Execution

Components in the same step run in parallel. Structure your plan accordingly:

**Good - parallel-friendly:**
```
| Step | Component | File |
| 1 | Model | src/models/Schedule.ts |        ← parallel (no deps)
| 1 | Types | src/types/schedule.ts |         ← parallel (no deps)
| 2 | Service | src/services/ScheduleService.ts |  ← parallel
| 2 | Repository | src/repositories/ScheduleRepo.ts | ← parallel
| 3 | Controller | src/controllers/ScheduleCtrl.ts | ← needs service
| 3 | Routes | src/routes/index.ts |           ← needs controller
```

**Bad - forces sequential:**
```
| Step | Component | File |
| 1 | Model | ... |
| 2 | Types | ... |        ← could be step 1
| 3 | Service | ... |
| 4 | Repository | ... |   ← could be step 3
```

**Rules:**
- Group independent components in the same step
- Only separate into different steps when there's a real dependency
- More components per step = more parallelization = faster execution

## What NOT To Do

- Don't write complete code in the plan
- Don't spend time on "haiku-ready prompts"
- Don't create multiple plan files (meta.md, step-N.md, etc.)
- Don't over-analyze the codebase - the executor will do detailed pattern matching
- Don't ask more than 3 questions
- Don't create unnecessary sequential steps - group independent work together
- **Don't skip to implementation** - This command ONLY creates the plan
- **Don't batch questions** - Ask one question at a time
