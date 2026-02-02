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

## ⚠️ CRITICAL SCOPE CONSTRAINT

**THIS COMMAND ONLY CREATES THE IMPLEMENTATION PLAN. IT DOES NOT IMPLEMENT.**

Your job in this phase:
✅ Read feature specification
✅ Analyze codebase deeply
✅ Ask technical questions
✅ Create atomic plan files (meta.md, step-N.md, verification.md)
✅ Build self-contained prompts for each component
✅ Tell user to run /5:implement-feature

Your job is NOT:
❌ Start implementation
❌ Execute any components
❌ Create state files
❌ Write any code files
❌ Run build or tests
❌ Create TodoWrite task lists

**After creating the plan files and informing the user, YOUR JOB IS COMPLETE. EXIT IMMEDIATELY.**

## ❌ Boundaries: What This Command Does NOT Do

**CRITICAL:** This command has a LIMITED scope. Do NOT:

- ❌ **Start implementation** - That's Phase 3 (`/5:implement-feature`)
- ❌ **Execute components** - That's Phase 3's job
- ❌ **Create state files** - That's Phase 3's responsibility
- ❌ **Write code files** - Only create plan files in `.5/{feature-name}/plan/`
- ❌ **Run builds or tests** - Phase 3 and 4 handle this
- ❌ **Create vague prompts** - Every prompt must be self-contained and executable by haiku without exploration

**If you find yourself doing any of the above, STOP IMMEDIATELY. You are exceeding this command's scope.**

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

Create the plan directory `.5/{feature-name}/plan/` and write atomic plan files:

#### 7a. Create plan directory

Use Bash to create the directory:
```bash
mkdir -p .5/{feature-name}/plan
```

#### 7b. Write plan/meta.md

Write metadata file using this format:

```markdown
---
feature: {feature-name}
ticket: {ticket-id}
total_steps: {N}
total_components: {N}
new_files: {N}
modified_files: {N}
created_at: {ISO timestamp}
format_version: "2.0"
---

# Plan Metadata: {TICKET-ID} - {Title}

{1-2 sentence summary of what this plan builds}

## Steps Overview
- Step 1: {Name} ({N} components)
- Step 2: {Name} ({N} components)
- Step N: {Name} ({N} components)

## Risks
- {risk 1}: {mitigation}
- {risk 2}: {mitigation}
```

#### 7c. Write plan/step-N.md files (one per step)

For each step, create a separate file `plan/step-{N}.md` using this format:

```markdown
---
step: {N}
feature: {feature-name}
name: "{Step Name}"
mode: parallel | sequential
components: {N}
---

# Step {N}: {Step Name}

{Brief description of what this step accomplishes}

## Components

```yaml
components:
  - id: {component-id}
    action: create | modify
    file: "{exact/path/to/file.ext}"
    skill: "{skill-name}" | null
    depends_on: []
    prompt: |
      {Complete, self-contained execution instructions.

      For create: include full file content or reference snippet.
      For modify: include exact old_string and new_string.
      Include all imports, types, and context.}

  - id: {component-id-2}
    action: create | modify
    file: "{exact/path/to/file.ext}"
    skill: "{skill-name}" | null
    depends_on: ["{component-id}"]
    prompt: |
      {Complete instructions}
```

## Expected Outputs
**Files Created:**
- {path1}
- {path2}

**Files Modified:**
- {path3}

## Verification Targets
**Build Targets:**
- {module1}
- {module2}

**Test Targets:**
- {test-module-1}
```

**Important:** Use YAML block within Markdown for components. This provides easy parsing while maintaining readability.

#### 7d. Write plan/verification.md

Write verification configuration file:

```markdown
# Verification Configuration

build_command: "{from config}"
test_command: "{from config}"

## Expected New Files
- {path1}
- {path2}

## Expected Modified Files
- {path3}
- {path4}

## Build Targets
- {module1}
- {module2}

## Test Modules
- {test-module-1}
```

### Step 8: Inform Developer

After creating the implementation plan, tell the developer:

1. "Implementation plan created at `.5/{feature-name}/plan/`"
2. "{N} components across {M} steps"
3. "Atomic plan structure: meta.md, step-1.md, step-2.md, ..., verification.md"
4. "Each component has a self-contained execution prompt for haiku agents"
5. "Please review the plan files"
6. "Then run `/clear` followed by `/5:implement-feature {feature-name}`"

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

Follow these steps **IN ORDER** and **STOP after step 8**:

1. **Read feature spec** from `.5/{feature-name}/feature.md`
2. **Deep codebase analysis** - Read actual files, extract patterns, imports, conventions. This is the critical step.
3. **Ask 3-5 technical questions** - Clarify implementation details
4. **Map components to skills** - Check `.claude/skills/` for available skills
5. **Group into dependency steps** - Based on component dependencies
6. **Build self-contained prompts** - Each prompt must be executable by haiku without exploration
7. **Write plan** to `.5/{feature-name}/plan/` directory with atomic files (meta.md, step-N.md, verification.md)
8. **Inform developer** to review and run `/clear` followed by `/5:implement-feature {feature-name}`

**🛑 STOP HERE. YOUR JOB IS COMPLETE. DO NOT START IMPLEMENTATION.**

## Key Principles

1. **Haiku-ready prompts** - Every component prompt is self-contained with all context baked in
2. **No exploration by executors** - All codebase analysis happens here in Phase 2
3. **Exact file paths** - No guessing, no pattern matching needed
4. **Reference code inline** - Include actual snippets, not "look at file X"
5. **Dependency-driven steps** - Step grouping from component dependencies
6. **Verify prompt quality** - Could someone with no codebase knowledge execute it?


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
8. Creates .5/PROJ-1234-add-emergency-schedule/plan/ directory
9. Writes plan/meta.md with metadata and risks
10. Writes plan/step-1.md, plan/step-2.md, plan/step-3.md with YAML components
11. Writes plan/verification.md with build/test config
12. Tells user: "✅ Implementation plan created at `.5/PROJ-1234-add-emergency-schedule/plan/`

    **Plan structure:**
    - 7 components across 3 steps
    - Atomic plan files: meta.md, step-1.md, step-2.md, step-3.md, verification.md
    - Self-contained prompts ready for haiku execution

    **Next steps:**
    1. Review the plan files
    2. Run `/clear` to reset context
    3. Run `/5:implement-feature PROJ-1234-add-emergency-schedule`"

**🛑 COMMAND COMPLETE. The command stops here and waits for user to proceed to Phase 3.**
```

## Related Documentation

- [5-Phase Workflow Guide](../docs/workflow-guide.md)
