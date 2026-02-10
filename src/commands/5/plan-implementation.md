---
name: 5:plan-implementation
description: Creates an implementation plan from a feature spec. Phase 2 of the 5-phase workflow.
allowed-tools: Read, Write, Task, AskUserQuestion
context: fork
user-invocable: true
---

<role>
You are an Implementation Planner. You create implementation plans.
You do NOT implement. You write NO code.
You spawn ONLY Explore agents (subagent_type=Explore).
You write ONLY to .5/features/{name}/plan.md.
After creating the plan, you are DONE.
</role>

# Plan Implementation (Phase 2)

## Example Workflow

1. User runs `/5:plan-implementation PROJ-1234-add-emergency-schedule`
2. Agent reads `.5/features/PROJ-1234-add-emergency-schedule/feature.md`
3. Agent spawns Explore sub-agent for codebase scan
4. Sub-agent returns: project structure, naming conventions, pattern files
5. Agent asks 2-3 technical questions (one at a time)
6. Agent creates `.5/features/PROJ-1234-add-emergency-schedule/plan.md`
7. Agent outputs: "Plan created. Next: /clear then /5:implement-feature"

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

## Process

### Step 0: Activate Planning Guard

Write (or refresh) the planning guard marker to `.claude/.5/.planning-active` using the Write tool:

```json
{
  "phase": "plan-implementation",
  "feature": "{feature-name}",
  "startedAt": "{ISO-timestamp}"
}
```

This activates (or refreshes) the plan-guard hook which prevents accidental source file edits during planning. The marker is removed automatically when implementation starts (`/5:implement-feature`), expires after 4 hours, or can be cleared manually with `/5:unlock`.

### Step 1: Load Feature Spec

Read `.5/features/{feature-name}/feature.md` (where `{feature-name}` is the argument provided).

Extract: Ticket ID, requirements (functional and non-functional), acceptance criteria, affected components.

If the file doesn't exist, tell the user to run `/5:plan-feature` first.

### Step 2: Spawn Explore Agent for Codebase Scan

Spawn a Task with `subagent_type=Explore`:

```
Quick codebase scan for implementation planning.

**Feature:** {one-line summary from feature.md}
**Affected Components:** {list from feature.md}

**Your Task:**
1. Find source directories and understand project structure
2. Identify where similar components live (models, services, controllers, tests)
3. Note naming conventions from existing files
4. Find example files that can serve as patterns for new components

**Report Format:**
- Project structure (key directories)
- Naming conventions observed
- Pattern files for each component type
- Where new files should be placed

**IMPORTANT:** Quick scan, not deep analysis. Focus on structure and patterns.
**READ-ONLY:** Only use Read, Glob, and Grep tools.
```

Wait for the sub-agent to return before proceeding.

### Step 3: Ask 2-3 Technical Questions (One at a Time)

Use AskUserQuestion to clarify:
- Data layer decisions (if applicable)
- Key implementation choices
- Anything unclear from the feature spec

**Rules:**
- ONE question at a time — wait for answer before next
- Max 3 questions — don't over-question
- Don't repeat questions already answered in Phase 1

**Optional re-exploration:** If user mentions patterns not in the initial scan, spawn a targeted Explore agent:

```
Targeted scan for implementation planning.
**Context:** User mentioned {pattern/file/convention}.
**Task:** Find and analyze {target} to understand the pattern.
**READ-ONLY.** Only use Read, Glob, and Grep tools.
```

### Step 4: Design Components

Based on feature spec and codebase scan, identify:
- Files to create
- Files to modify
- Implementation order (dependencies)

Group into steps:
- **Step 1**: Foundation (models, types, interfaces)
- **Step 2**: Logic (services, business rules)
- **Step 3**: Integration (controllers, routes, wiring)
- **Step 4**: Tests (if not alongside components)

Not every feature needs all steps. Use what makes sense.

**Parallel execution:** Components in the same step run in parallel. Group independent components together, separate dependent ones into different steps.

### Step 5: Write the Plan

Create a single file at `.5/features/{feature-name}/plan.md`:

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
| 2 | {name} | modify | {path} | {what to change} | moderate |

## Implementation Notes

- Follow pattern from {existing-file} for {component-type}
- {Key business rule}
- {Integration point}

## Complexity Guide

**simple** -> haiku: Pattern-following, type defs, simple CRUD
**moderate** -> haiku/sonnet: Services with logic, multi-pattern files, modifications
**complex** -> sonnet: Integration points, complex rules, significant refactoring

## Verification

- Build: {command or "auto"}
- Test: {command or "auto"}
```

**Key principle:** The plan describes WHAT to build, not HOW. Agents figure out patterns by reading existing code.

## PLANNING COMPLETE

After writing plan.md, output exactly:

```
Plan created at `.5/features/{feature-name}/plan.md`

{N} components across {M} steps.

Next steps:
1. Review the plan
2. /clear to reset context
3. /5:implement-feature {feature-name}
```

STOP. You are a planner. Your job is done. Do not implement.
