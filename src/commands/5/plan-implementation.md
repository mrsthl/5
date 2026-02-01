---
name: 5:plan-implementation
description: Creates a precise, AI-executable implementation plan. Performs all codebase analysis upfront and produces self-contained component prompts that can be executed by haiku without exploration. Phase 2 of the 5-phase workflow.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, Write
context: fork
user-invocable: true
---

# Plan Implementation (Phase 2)

## Overview

This skill is the **second phase** of the 5-phase workflow:
1. **Feature Planning** - Understand requirements, create feature spec (completed)
2. **Implementation Planning** (this skill) - Analyze codebase, produce AI-executable plan
3. **Orchestrated Implementation** - Execute plan with haiku agents
4. **Verify Implementation** - Check completeness and correctness
5. **Code Review** - Apply automated quality improvements

**Critical design constraint:** The plan must be executable by haiku-model agents without any codebase exploration. This means YOU must do all analysis upfront and embed everything into the plan: exact file paths, exact code patterns, reference snippets, imports, and complete instructions.

## Prerequisites

Before invoking this skill, ensure:
1. Feature spec exists at `.5/{TICKET-ID}-{description}/feature.md`
2. Feature spec has been reviewed and approved by developer
3. You have the feature name/ticket ID ready

## Planning Process

### Step 1: Read Feature Specification

Read the feature spec from `.5/{feature-name}/feature.md`.

Extract:
- Ticket ID
- Summary
- Requirements (functional and non-functional)
- Affected domains
- Entity definitions
- Business rules
- Acceptance criteria

### Step 2: Deep Codebase Analysis

**This is the most important step.** You must gather all context that the executor agents will need, because they cannot explore the codebase themselves.

**2a. Project structure:**
- Use Glob to map the directory structure
- Identify source directories, test directories, config locations
- Understand module/package organization

**2b. Existing patterns (read actual files):**
- Find 1-2 existing examples of each component type needed (e.g., an existing service, model, controller)
- Read them fully to extract:
  - Import statements and patterns
  - Class/function structure
  - Naming conventions (file names, variable names, export style)
  - Error handling patterns
  - Test patterns

**2c. Dependencies and integration points:**
- Read registration files, route files, module declarations
- Understand how new components get wired in
- Identify exact locations where modifications are needed (file path + line context)

**2d. Build/test configuration:**
- Read `.claude/.5/config.json` for build commands
- Read available skills from `.claude/skills/`

### Step 3: Technical Collaboration (3-5 Questions)

Ask targeted technical questions using AskUserQuestion:
- Data layer decisions (persistence, query patterns)
- Validation requirements
- API design choices
- Whether to create new vs extend existing components
- Challenge the approach: suggest simpler alternatives

### Step 4: Map Components to Skills

For each component, determine:
- Which skill creates it (from `.claude/skills/`)
- Or `null` if no matching skill exists (component will be created directly via Write/Edit)

### Step 5: Determine Dependency Steps

Group components by dependencies:
1. Components with no dependencies → first step (parallel)
2. Components depending on step 1 → second step
3. Continue until all assigned
4. Name steps based on content

### Step 6: Build Component Prompts

**For each component, create a complete, self-contained execution prompt.** This prompt must contain everything a haiku agent needs to create the file without exploring anything.

**For `action: create` components, the prompt must include:**
- The complete file content to write, OR
- A reference snippet from an existing file + clear instructions on what to change
- All import statements
- All type definitions needed
- Exact file path

**For `action: modify` components, the prompt must include:**
- The exact file path
- The exact `old_string` to find (copied from the actual file)
- The exact `new_string` to replace it with
- Context about what's above/below to ensure uniqueness

**Prompt quality checklist:**
- Could a developer who has never seen this codebase execute this prompt? If no, add more context.
- Are all imports specified? If the component imports from other new components in this plan, are those paths correct?
- Is the file path correct relative to the project root?
- For modifications: is the old_string unique in the file?

### Step 7: Write Implementation Plan

Write the plan to `.5/{feature-name}/plan.md` using this exact format:

```markdown
# Plan: {TICKET-ID} - {Title}

## Meta
feature: {feature-name}
ticket: {ticket-id}
total_steps: {N}
total_components: {N}
new_files: {N}
modified_files: {N}

## Summary
{1-2 sentences: what this plan builds and why}

## Steps

### step: 1
name: "{descriptive name}"
mode: parallel | sequential

#### component: {component-id}
action: create | modify
file: "{exact/path/to/file.ext}"
skill: "{skill-name}" | null
depends_on: []
prompt: |
  {Complete, self-contained execution instructions.
  For create: include full file content or reference snippet + modifications.
  For modify: include exact old_string and new_string.
  Include all imports. Include all types.
  This prompt is passed directly to a haiku agent that cannot explore the codebase.}

#### component: {component-id-2}
action: create | modify
file: "{exact/path/to/file.ext}"
skill: "{skill-name}" | null
depends_on: []
prompt: |
  {Complete instructions}

### step: 2
name: "{descriptive name}"
mode: parallel | sequential

#### component: {component-id-3}
action: create | modify
file: "{exact/path/to/file.ext}"
skill: null
depends_on: ["{component-id}", "{component-id-2}"]
prompt: |
  {Complete instructions}

## Verification
build_command: "{from config}"
test_command: "{from config}"
expected_new_files:
  - "{path1}"
  - "{path2}"
expected_modified_files:
  - "{path3}"

## Risks
- "{risk 1}: {mitigation}"
- "{risk 2}: {mitigation}"
```

### Step 8: Inform Developer

After creating the implementation plan, tell the developer:

1. "Implementation plan created at `.5/{feature-name}/plan.md`"
2. "{N} components across {M} steps"
3. "Each component has a self-contained execution prompt for haiku agents"
4. "Please review, then run: `/5:implement-feature {feature-name}`"

## Component Prompt Examples

### Example: Create a new TypeScript service

```
#### component: schedule-service
action: create
file: "src/services/ScheduleService.ts"
skill: null
depends_on: ["schedule-model"]
prompt: |
  Create file `src/services/ScheduleService.ts` with this content:

  ```typescript
  import { Schedule } from '../models/Schedule';
  import { ScheduleRepository } from '../repositories/ScheduleRepository';
  import { ValidationError } from '../errors/ValidationError';

  export class ScheduleService {
    constructor(private readonly repo: ScheduleRepository) {}

    async create(data: { name: string; startDate: Date; endDate: Date }): Promise<Schedule> {
      if (data.endDate <= data.startDate) {
        throw new ValidationError('endDate must be after startDate');
      }
      return this.repo.save(new Schedule(data));
    }

    async findById(id: string): Promise<Schedule | null> {
      return this.repo.findById(id);
    }

    async delete(id: string): Promise<void> {
      return this.repo.delete(id);
    }
  }
  ```

  This follows the pattern from `src/services/UserService.ts`.
```

### Example: Modify an existing router file

```
#### component: register-schedule-routes
action: modify
file: "src/routes/index.ts"
skill: null
depends_on: ["schedule-controller"]
prompt: |
  Modify file `src/routes/index.ts`.

  Find this exact string:
  ```
  // Route registrations
  app.use('/api/users', userRoutes);
  ```

  Replace with:
  ```
  // Route registrations
  app.use('/api/users', userRoutes);
  app.use('/api/schedules', scheduleRoutes);
  ```

  Also add this import at the top of the file, after the existing imports:
  Find: `import { userRoutes } from './userRoutes';`
  Replace with:
  ```
  import { userRoutes } from './userRoutes';
  import { scheduleRoutes } from './scheduleRoutes';
  ```
```

### Example: Create a test file

```
#### component: schedule-service-test
action: create
file: "src/services/__tests__/ScheduleService.test.ts"
skill: null
depends_on: ["schedule-service"]
prompt: |
  Create file `src/services/__tests__/ScheduleService.test.ts` with this content:

  ```typescript
  import { ScheduleService } from '../ScheduleService';
  import { ScheduleRepository } from '../../repositories/ScheduleRepository';
  import { ValidationError } from '../../errors/ValidationError';

  describe('ScheduleService', () => {
    let service: ScheduleService;
    let mockRepo: jest.Mocked<ScheduleRepository>;

    beforeEach(() => {
      mockRepo = {
        save: jest.fn(),
        findById: jest.fn(),
        delete: jest.fn(),
      } as any;
      service = new ScheduleService(mockRepo);
    });

    describe('create', () => {
      it('creates a schedule with valid dates', async () => {
        const data = {
          name: 'Test',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
        };
        mockRepo.save.mockResolvedValue({ id: '1', ...data } as any);
        const result = await service.create(data);
        expect(mockRepo.save).toHaveBeenCalled();
        expect(result).toBeDefined();
      });

      it('throws if endDate <= startDate', async () => {
        const data = {
          name: 'Test',
          startDate: new Date('2026-01-31'),
          endDate: new Date('2026-01-01'),
        };
        await expect(service.create(data)).rejects.toThrow(ValidationError);
      });
    });
  });
  ```

  This follows the test pattern from `src/services/__tests__/UserService.test.ts`.
```

## Instructions Summary

1. **Read feature spec** from `.5/{feature-name}/feature.md`
2. **Deep codebase analysis** - Read actual files, extract patterns, imports, conventions. This is the critical step.
3. **Ask 3-5 technical questions** - Clarify implementation details
4. **Map components to skills** - Check `.claude/skills/` for available skills
5. **Group into dependency steps** - Based on component dependencies
6. **Build self-contained prompts** - Each prompt must be executable by haiku without exploration
7. **Write plan** to `.5/{feature-name}/plan.md` in the structured format
8. **Inform developer** to review and run `/5:implement-feature`

## Key Principles

1. **Haiku-ready prompts** - Every component prompt is self-contained with all context baked in
2. **No exploration by executors** - All codebase analysis happens here in Phase 2
3. **Exact file paths** - No guessing, no pattern matching needed
4. **Reference code inline** - Include actual snippets, not "look at file X"
5. **Dependency-driven steps** - Step grouping from component dependencies
6. **Verify prompt quality** - Could someone with no codebase knowledge execute it?

## DO NOT

- DO NOT start implementation (that's Phase 3's job)
- DO NOT create state files (that's `/implement-feature`'s job)
- DO NOT write vague prompts like "follow existing patterns" without including the pattern
- DO NOT skip codebase analysis - reading actual files is mandatory
- DO NOT leave file paths ambiguous
- DO NOT write prompts that require the executor to read other files to understand what to do
- DO NOT assume the executor can figure things out - be explicit

## Example Usage

```
User: /plan-implementation PROJ-1234-add-emergency-schedule

Skill:
1. Reads .5/PROJ-1234-add-emergency-schedule/feature.md
2. Explores codebase: reads existing models, services, routes, tests
3. Extracts patterns: import style, naming, structure, test framework
4. Asks technical questions about validation, persistence, API
5. Maps components to skills (or null for direct execution)
6. Groups into steps by dependencies
7. Builds self-contained prompts with inline code and exact paths
8. Creates .5/PROJ-1234-add-emergency-schedule/plan.md
9. Tells user: "Plan created with 7 components across 3 steps. Review and run /5:implement-feature"
```

## Related Documentation

- [5-Phase Workflow Guide](../docs/workflow-guide.md)
