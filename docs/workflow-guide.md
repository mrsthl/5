# Claude-Assisted Development Workflow Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [The 5-Phase Workflow](#the-5-phase-workflow)
4. [Phase 1: Feature Planning](#phase-1-feature-planning)
5. [Phase 2: Implementation Planning](#phase-2-implementation-planning)
6. [Phase 3: Orchestrated Implementation](#phase-3-orchestrated-implementation)
7. [Phase 4: Verify Implementation](#phase-4-verify-implementation)
8. [Phase 5: Code Review](#phase-5-code-review)
9. [Complete Example Walkthrough](#complete-example-walkthrough)
10. [Tips for Effective Collaboration](#tips-for-effective-collaboration)
11. [Troubleshooting](#troubleshooting)
12. [Advanced Topics](#advanced-topics)

---

## Overview

This guide describes how to use Claude Code's skill system to efficiently implement features in any software project. The workflow minimizes context usage while ensuring systematic, high-quality implementations.

### Why This Workflow?

**Benefits:**
- Lower context usage (orchestrator stays thin, agents do heavy lifting in forked contexts)
- Better collaboration (intensive Q&A ensures requirements are clear)
- Session continuity (can pause and resume without losing context)
- Systematic delivery (clear phases, clear handoffs, clear verification)
- Developer confidence (transparent process, visible progress, predictable results)

**When to Use:**
- New domain entities
- Extending existing domains
- Adding business rules/validation
- Creating API endpoints
- Any non-trivial feature requiring multiple files

**When NOT to Use:**
- Simple bug fixes
- Typo corrections
- Single-line changes
- Purely exploratory work

**Middle Ground - Use `/quick-implement`:**
For small, well-understood tasks (1-5 files). Uses same state tracking and skills as full workflow, but with inline planning and `/build-project` verification instead of full agents.

---

## Architecture

The workflow uses a **4-layer architecture**:

```
Developer
    |
    v
Commands (thin orchestrators, main context)
    |  - /plan-feature, /plan-implementation
    |  - /implement-feature, /verify-implementation, /review-code
    v
Agents (heavy lifting, forked contexts)
    |  - step-executor, step-verifier
    |  - integration-agent, verification-agent, review-processor
    v
Skills (atomic operations, called by agents)
    |  - /build-project, /run-tests, /generate-readme
    |  - Project-specific skills as configured
    v
Tools (file operations, compilation, IDE integration)
       - Read, Write, Edit, Bash, Glob, Grep, JetBrains MCP
```

### Layer Responsibilities

| Layer | Context | Responsibility |
|-------|---------|---------------|
| **Commands** | Main (inherit) | User interaction, orchestration, state tracking |
| **Agents** | Forked | Heavy work: skill execution, compilation, review parsing |
| **Skills** | Called by agents | Atomic operations: create files, run builds, run tests |
| **Tools** | N/A | Low-level operations: file I/O, bash, IDE integration |

### Why Agents?

Commands used to call skills directly, consuming main context for heavy operations. With the agent layer:

- **Commands stay thin**: Only read plans, spawn agents, process results, update state
- **Agents handle heavy work**: File creation, compilation, review parsing in forked contexts
- **Skills remain unchanged**: Same atomic operations, called by agents instead of commands
- **Main context preserved**: More room for user interaction and error handling

### Agent Inventory

| Agent | Spawned By | Purpose |
|-------|-----------|---------|
| `step-executor` | implement-feature | Execute all components of a single step |
| `step-verifier` | implement-feature | Build and check files after each step |
| `integration-agent` | implement-feature | Wire components, register routes (final step) |
| `verification-agent` | verify-implementation | Full verification (files, compilation, tests) |
| `review-processor` | review-code | Run CodeRabbit CLI and categorize findings |

---

## The 5-Phase Workflow

```
+-----------------------------------------------------------------+
| Phase 1: Feature Planning                                        |
|                                                                   |
| Developer: /plan-feature                                         |
| Claude: Asks 6-10 questions, challenges assumptions              |
| Output: .5/{TICKET-ID}-{description}/feature.md                  |
| Developer: Reviews and approves spec                              |
+-----------------------------+-------------------------------------+
                              |
                              v
+-----------------------------------------------------------------+
| Phase 2: Implementation Planning                                 |
|                                                                   |
| Developer: /plan-implementation {TICKET-ID}-{description}        |
| Claude: Maps to modules, skills, dependency steps                |
| Output: .5/{ticket}/plan/ (atomic structure)                     |
|   - meta.md, step-N.md files, verification.md                    |
| Developer: Reviews technical approach                             |
+-----------------------------+-------------------------------------+
                              |
                              v
+-----------------------------------------------------------------+
| Phase 3: Orchestrated Implementation                             |
|                                                                   |
| Developer: /implement-feature {TICKET-ID}-{description}          |
| Claude: Spawns agents for each step, tracks state                |
| Agents: step-executor -> step-verifier (per step)                |
| Agent: integration-agent (final step)                            |
| Output: Completed feature + state file                            |
+-----------------------------+-------------------------------------+
                              |
                              v
+-----------------------------------------------------------------+
| Phase 4: Verify Implementation                                   |
|                                                                   |
| Developer: /verify-implementation (or automatic)                 |
| Agent: verification-agent checks files, compiles, runs tests     |
| Claude: Reports results, prompts for commit                      |
| Output: Verification report                                      |
+-----------------------------+-------------------------------------+
                              |
                              v
+-----------------------------------------------------------------+
| Phase 5: Code Review                                             |
|                                                                   |
| Developer: /review-code                                           |
| Agent: review-processor runs CodeRabbit, categorizes findings    |
| Claude: Shows overview, applies user-approved fixes              |
| Output: Improved code + review report                             |
+-----------------------------------------------------------------+
```

---

## Phase 1: Feature Planning

### Goal
Understand requirements, challenge assumptions, and create a comprehensive feature specification.

### Command
```bash
/plan-feature
```

### What Happens

1. **Intensive Q&A**: Claude asks 6-10 clarifying questions
   - Requirements clarity
   - Scope boundaries
   - Edge cases
   - Performance expectations
   - Testing strategy
   - Integration points
   - Alternative approaches
   - Complexity trade-offs

2. **Assumption Challenges**: Claude questions your approach
   - "Is this the simplest solution?"
   - "Have you considered X alternative?"
   - "What happens when Y fails?"
   - "Could we reuse existing Z component?"

3. **Codebase Exploration**: Claude examines existing patterns
   - Checks affected domains
   - Reviews similar implementations
   - Identifies reusable components

4. **Ticket ID Collection**: Claude asks for ticket ID if not provided

5. **Feature Spec Creation**: Claude writes structured spec to:
   ```
   .5/{TICKET-ID}-{description}/feature.md
   ```

### Your Role

1. **Answer questions thoroughly**: Don't rush, clarify requirements
2. **Challenge back if needed**: If Claude misunderstands, correct it
3. **Provide ticket ID**: From Jira or your task tracking system
4. **Review the spec carefully**: This becomes the contract for implementation
5. **Approve or request changes**: Don't proceed if spec is unclear

### Next Steps

After approval:
```bash
/plan-implementation {TICKET-ID}-{description}
```

---

## Phase 2: Implementation Planning

### Goal
Map feature requirements to technical components, skills, and dependency steps.

### Command
```bash
/plan-implementation PROJ-1234-add-user-profile
```
(Replace with your ticket ID and description)

### What Happens

1. **Load Feature Spec**: Claude reads the approved feature spec

2. **Technical Analysis**: Analyzes project structure to identify affected areas
   - Examines existing codebase architecture
   - Identifies modules, layers, or packages that need changes
   - Maps to your project's specific patterns (MVC, Clean Architecture, etc.)
   - Determines which files need to be created or modified

3. **Technical Q&A**: Claude asks 3-5 framework-specific questions
   - Which persistence layer changes are needed?
   - What validation approach should be used?
   - Which API endpoints need to be created/modified?
   - Are there business logic components needed?
   - What integration points exist?

4. **Component Mapping**: Each component mapped to a skill or creation task
   - Based on available project-specific skills
   - Or described as file creation tasks if no skill exists
   - Example: User model -> /model-generator (if available) or manual creation

5. **Dependency Steps**: Groups components into implementation steps (configurable, default 3)
   - **Step 1 (Foundation)**: Core models, types, schemas (parallel execution)
   - **Step 2 (Logic)**: Business logic, services, handlers (sequential if needed)
   - **Step 3 (Integration)**: API routes, wiring, tests (sequential for integration)

   Note: Step count and organization is configurable in `.claude/.5/config.json`

6. **Implementation Plan Creation**: Claude writes an **atomic plan structure** to:
   ```
   .5/{TICKET-ID}-{description}/plan/
   ├── meta.md              # Feature metadata and risks
   ├── step-1.md            # Step 1 components (YAML format)
   ├── step-2.md            # Step 2 components
   ├── step-N.md            # Step N components
   └── verification.md      # Build/test configuration
   ```

   **Atomic Plan Structure (Format Version 2.0):**
   - Each step is in a separate file for modularity
   - Components are stored in YAML format for easy parsing
   - Metadata and verification config are separated
   - Benefits: scalability, navigation, agent efficiency, version control

   **File Formats:**
   - `meta.md`: YAML frontmatter (feature, ticket, totals) + risks section
   - `step-N.md`: YAML frontmatter (step, name, mode) + components YAML block + expected outputs
   - `verification.md`: Build/test commands and expected file lists

### Your Role

1. **Answer technical questions**: Clarify implementation details
2. **Review module impact**: Ensure correct modules affected
3. **Check component checklist**: All components needed?
4. **Validate dependency steps**: Does order make sense?
5. **Review technical decisions**: Agree with approach?
6. **Approve or request changes**: Don't proceed if plan is unclear

### Next Steps

After approval:
```bash
/implement-feature {TICKET-ID}-{description}
```

---

## Phase 3: Orchestrated Implementation

### Goal
Execute the implementation plan with state tracking, using agents in forked contexts to minimize main context usage.

### Command
```bash
/implement-feature PROJ-1234-add-user-profile
```
(Replace with your ticket ID and description)

### What Happens

1. **Load Implementation Plan**: Command reads the approved atomic plan
   - Reads `plan/meta.md` for feature metadata and total steps count
   - Loads each `plan/step-N.md` on-demand during execution
   - Parses YAML components from each step file

2. **Initialize State File**: Creates tracking file
   ```
   .5/{TICKET-ID}-{description}/state.json
   ```

3. **Create Task List**: One item per step (default 3 steps, configurable)

4. **Execute Steps** (for each implementation step):

   ```
   [Main Context]  Construct step input from plan
         |
         v
   [FORK] step-executor agent
         |  - Calls skills for each component
         |  - Creates/modifies files as needed
         |  - Returns created files and status
         v
   [Main Context]  Process results, update state
         |
         v
   [FORK] step-verifier agent
         |  - Runs project build command
         |  - Checks files for problems
         |  - Returns verification status
         v
   [Main Context]  Process results, handle failures, next step
   ```

5. **Integration (Final Step)**:

   ```
   [FORK] integration-agent
         |  - Wires components using project patterns
         |  - Registers routes/endpoints
         |  - Runs final build and tests
         v
   [Main Context]  Process results, update state
   ```

6. **Report Completion**: Summary of all work done

### State File

Tracks progress in JSON format:
```json
{
  "ticketId": "PROJ-1234",
  "featureName": "PROJ-1234-add-user-profile",
  "status": "in-progress",
  "currentStep": 2,
  "totalSteps": 3,
  "completedComponents": [...],
  "pendingComponents": [...],
  "contextUsage": "45%"
}
```

### Your Role

1. **Monitor progress**: Watch task list updates
2. **Review errors if any**: Claude will escalate if stuck
3. **Approve integration changes**: Review wiring/routing changes
4. **Trust the delegation**: Let Claude delegate to agents and skills

### Output Files

- **State file**: `.5/{ticket}/state.json`
- **All created files**: As specified in implementation plan

### Next Steps

After implementation completes:
```bash
/verify-implementation
```
(This may be invoked automatically by `/implement-feature`)

---

## Phase 4: Verify Implementation

### Goal
Systematically verify that the implementation is complete, correct, and ready for review.

### Command
```bash
/verify-implementation
```
(Usually invoked automatically by `/implement-feature` at the end of Phase 3)

### What Happens

1. **Load Implementation State**: Command reads state file from Phase 3

2. **Spawn verification-agent**: Delegates all checks to forked context

3. **Agent Performs Checks**:
   - File existence (all planned files exist?)
   - IDE diagnostics (errors vs warnings)
   - Production code compilation
   - Test code compilation
   - Test execution

4. **Process Results**: Command receives structured verification data

5. **Save Report**: Writes verification report to:
   `.5/{ticket}/verification.md`

6. **Update State File**: Marks verification status

7. **Prompt for Commit**: If passed, asks user about committing

### Verification Statuses

**PASSED**
- All files exist
- No errors (warnings OK)
- Compilation successful
- All tests passing

**PASSED WITH WARNINGS**
- All files exist
- Warnings present (but no errors)
- Compilation successful
- All tests passing

**FAILED**
- Missing files, OR
- Errors present, OR
- Compilation failures, OR
- Test failures

### Your Role

1. **Review verification report**: Check the generated markdown report
2. **Address failures if any**: Fix errors before proceeding
3. **Decide on warnings**: Warnings don't block, but review them
4. **Proceed to code review**: If passed, move to Phase 5

### Next Steps

If verification passed:
```bash
/review-code
```

If verification failed:
- Address the reported issues
- Re-run `/verify-implementation` after fixes

---

## Phase 5: Code Review

### Goal
Use automated code review to catch quality issues, apply auto-fixes, and ensure code meets standards.

### Command
```bash
/review-code
```

### What Happens

1. **Check Prerequisites**: Verifies CodeRabbit CLI is installed and authenticated

2. **Ask Review Scope**: User chooses what to review (staged, branch, files)

3. **Spawn review-processor agent**: Delegates CodeRabbit execution to forked context
   - Agent runs `coderabbit review --plain`
   - Agent parses output and categorizes findings
   - Agent returns structured results (fixable, questions, manual)

4. **Show Overview**: Command presents categorized findings to user

5. **User Decisions**: Ask user which fixes to apply, how to handle questions

6. **Apply Fixes**: Only user-approved fixes applied via Edit tool

7. **Handle Questions**: Present each question to user if requested

8. **Verify**: Compile and test after applying fixes

9. **Save Report**: Store review summary in `.5/{feature-name}/`

### Your Role

1. **Choose review scope**: What changes to review
2. **Review findings overview**: Understand what CodeRabbit found
3. **Decide on fixes**: Which to apply, which to skip
4. **Answer questions**: Respond to clarifications
5. **Address manual issues**: Fix issues that require judgment
6. **Approve changes**: If satisfied, proceed to commit

### Next Steps

After code review:
1. Review all changes (implementation + review fixes)
2. Run tests locally if desired
3. Commit and push
4. Create pull request

---

## Complete Example Walkthrough

Let's walk through implementing "Add user profile endpoint to API"

### Step 1: Start Feature Planning

```bash
You: /plan-feature

Claude: I'll help you plan this feature. Let me ask some clarifying questions...

[Claude asks 8 questions about requirements, scope, validation, API design, etc.]

You: [Answer each question]

Claude: Let me explore the existing user domain...
[Claude examines existing user models, routes, controllers]

Claude: What's the ticket ID for this feature?

You: PROJ-1234

Claude: Feature spec created at .5/PROJ-1234-add-user-profile/feature.md

Next steps:
1. Review the feature spec
2. Run `/clear` to reset context (recommended between phases)
3. Then run `/5:plan-implementation PROJ-1234-add-user-profile`
```

### Step 2: Review Feature Spec

Open `.5/PROJ-1234-add-user-profile/feature.md` and review:
- Problem statement clear?
- Requirements complete?
- Acceptance criteria verifiable?
- Alternatives make sense?

If satisfied, clear context and proceed to next phase.

### Step 3: Clear Context and Start Implementation Planning

```bash
You: /clear
[Context cleared]

You: /plan-implementation PROJ-1234-add-user-profile

Claude: Reading feature spec...

[Claude analyzes technical requirements]

Claude: Let me ask a few technical questions...
- Should profile validation be separate or part of existing UserValidator?
- Do we need database schema changes or just new API endpoints?
- What authentication/authorization is required?

You: [Answer technical questions]

Claude: Implementation plan created at
.5/PROJ-1234-add-user-profile/plan/

Atomic plan structure:
- meta.md: Feature metadata, 3 steps, 6 components
- step-1.md: Foundation (2 components, parallel)
- step-2.md: Logic (2 components, sequential)
- step-3.md: Integration (2 components, sequential)
- verification.md: Build/test configuration

Module Impact:
- src/models: 1 update (User model)
- src/services: 1 new file (ProfileService)
- src/routes: 1 update (user routes)
- src/validators: 1 new file (ProfileValidator)

Component Checklist:
Step 1 (Foundation): User model update, ProfileValidator
Step 2 (Logic): ProfileService with business logic
Step 3 (Integration): API route registration, tests

Review the plan, then:
1. Run `/clear` to reset context (recommended between phases)
2. Run `/5:implement-feature PROJ-1234-add-user-profile`
```

### Step 4: Clear Context and Start Implementation (with Agents)

```bash
You: /clear
[Context cleared]

You: /implement-feature PROJ-1234-add-user-profile

Claude: Reading implementation plan...
Creating state file...
Initializing tasks...

[FORK] step-executor: Step 1 (Foundation)
  -> User model updated (added profile fields)
  -> ProfileValidator created
[FORK] step-verifier: Step 1
  -> Build successful

[FORK] step-executor: Step 2 (Logic)
  -> ProfileService created
  -> Business logic implemented
[FORK] step-verifier: Step 2
  -> Build successful

[FORK] step-executor: Step 3 (Integration)
  -> Profile routes added
  -> Tests created
[FORK] step-verifier: Step 3
  -> Build successful

[FORK] integration-agent: Final integration
  -> Routes registered in app
  -> All tests passing

Feature implementation complete!
- All 4 components created/updated
- State file updated
- Ready for verification!

Next steps:
1. Run `/clear` to reset context (recommended between phases)
2. Run `/5:verify-implementation PROJ-1234-add-user-profile`
```

### Step 5: Clear Context and Verify Implementation

```bash
You: /clear
[Context cleared]

You: /verify-implementation

Claude: Loading implementation state...

[FORK] verification-agent
  -> File existence: 4/4 exist
  -> Problem detection: 0 errors, 2 warnings
  -> Build: Successful
  -> Tests: 23/23 passing

Verification Status: PASSED WITH WARNINGS

Would you like to commit these changes now?

Next steps:
1. Run `/clear` to reset context (recommended between phases)
2. Run `/5:review-code`
```

### Step 6: Clear Context and Code Review

```bash
You: /clear
[Context cleared]

You: /review-code

Claude: Checking CodeRabbit CLI... installed
What would you like to review? [Staged changes]

[FORK] review-processor
  -> CodeRabbit found 3 issues
  -> 2 fixable, 1 manual

CodeRabbit Review Results:
- 2 fixable issues
- 1 manual review item

Apply all fixable issues? [Yes]

Applied:
- Removed unused import
- Added missing error handling

Manual issues:
- Consider adding rate limiting (line 42)

Build: Successful
Tests: All passing
```

---

## Tips for Effective Collaboration

### During Feature Planning (Phase 1)

1. **Be thorough with questions**: Don't rush, clarify everything
2. **Challenge assumptions**: If Claude suggests something unexpected, ask why
3. **Provide examples**: If requirements are complex, give examples
4. **Think about edge cases**: What happens when things go wrong?
5. **Consider existing patterns**: Mention similar features for consistency

### During Implementation Planning (Phase 2)

1. **Validate technical approach**: Ensure approach aligns with codebase patterns
2. **Check module dependencies**: Make sure step order is correct
3. **Question complexity**: If plan seems overly complex, challenge it
4. **Clarify verification steps**: Make sure verification will catch issues

### During Implementation (Phase 3)

1. **Monitor progress**: Watch task list for updates
2. **Don't interrupt mid-step**: Let steps complete before reviewing
3. **Review errors promptly**: If Claude escalates, review and respond
4. **Trust the process**: Agents handle heavy lifting, you focus on high-level review

### During Verification (Phase 4)

1. **Review the verification report carefully**: Check all sections
2. **Warnings are OK**: Don't block on warnings, but review them
3. **Fix errors immediately**: Address any errors before proceeding
4. **Re-verify after fixes**: Run `/verify-implementation` again if you made changes

### During Code Review (Phase 5)

1. **Review auto-fixes**: Check what CodeRabbit changed automatically
2. **Address manual issues**: Fix issues that require human judgment
3. **Don't skip this phase**: Code review catches quality issues early
4. **Learn from feedback**: CodeRabbit feedback helps improve coding patterns

### General Tips

1. **Clear context between phases**: Run `/clear` before starting each new phase to reset context. This keeps conversations focused, prevents context pollution, and improves efficiency. Each phase reads necessary artifacts from previous phases.
2. **Use git branches**: Create feature branch before starting
3. **Commit often**: Commit after Phase 3 completes successfully
4. **Run verification manually**: Re-run /verify-implementation after fixes
5. **Review state files**: Check `.5/{feature-name}/state.json` for progress tracking
6. **Save verification reports**: Keep reports for documentation/debugging

---

## Troubleshooting

### Issue: Feature spec is too vague

**Solution**: Ask Claude more questions during Phase 1. Use AskUserQuestion to clarify requirements before finalizing spec.

### Issue: Implementation plan identifies wrong modules

**Solution**: Provide feedback during Phase 2 review. Tell Claude which modules should actually be affected.

### Issue: Component creation fails during implementation

**Symptom**: Claude reports agent failure or compilation error

**Solution**:
1. Check error message in state file
2. If small fix (missing import, syntax error), Claude will fix in main context
3. If large fix needed, Claude will re-spawn agent with corrected prompt
4. If stuck after 2 attempts, Claude will escalate to you

### Issue: Tests fail during verification

**Solution**:
1. Review verification report for test failures
2. Check test output for error details
3. Fix failing tests manually or ask Claude to fix
4. Re-run /verify-implementation after fixes

### Issue: Context usage too high

**Symptom**: Claude warns about 50% or 80% context usage

**Solution**:
1. Let current step complete
2. Commit current progress
3. Break remaining work into new feature
4. Start new session for remaining work

### Issue: State file corrupted

**Symptom**: JSON parse error when reading state file

**Solution**:
1. Open `.5/{ticket}/state.json`
2. Fix JSON syntax error
3. Or delete and re-run /implement-feature (will restart from beginning)

### Issue: Verification passes with warnings

**Status**: PASSED WITH WARNINGS

**Action**:
- Warnings don't block completion
- Review warnings in verification report
- Optionally fix warnings (unused imports, etc.)
- Proceed to commit

### Issue: Need to pause mid-implementation

**Solution**:
1. Let current step complete if possible
2. Commit current progress
3. State file preserves progress
4. Resume later by running /implement-feature {ticket} (will continue from current step)

### Issue: Agent returns unexpected results

**Solution**:
1. Check the agent output for error details
2. The command will attempt to fix small issues
3. For persistent failures, the command will escalate to you
4. You can re-run the command to retry from the failed step

---

## Advanced Topics

### Resuming Interrupted Implementation

If implementation was interrupted:
1. Check state file: `.5/{ticket}/state.json`
2. Note `currentStep` value
3. Re-run `/implement-feature {ticket}`
4. Claude will resume from `currentStep`

### Breaking Large Features into Parts

If feature is too large:
1. Complete Phase 1 (feature planning) for full feature
2. In Phase 2, split implementation plan into parts:
   - Part 1: Core model + validation
   - Part 2: API layer
   - Part 3: Advanced features
3. Implement each part separately
4. Each part gets own state file

### Custom Verification

If you need custom verification:
1. Let /verify-implementation run standard checks
2. Add your own checks (performance tests, integration tests, etc.)
3. Document custom checks in verification report

### Automated Code Review with CodeRabbit

Use `/review-code` to get AI-powered code review before committing:

**Prerequisites:**
- Install CodeRabbit CLI: https://docs.coderabbit.ai/cli/installation
- Authenticate: `coderabbit auth login`

**Usage:**
```bash
# After making changes, stage them
git add .

# Run automated review
/review-code

# review-processor agent will:
# - Run CodeRabbit CLI
# - Parse and categorize findings
# - Return structured results to the command
#
# The command will then:
# - Show overview to you
# - Ask which fixes to apply
# - Apply approved fixes
# - Verify changes build correctly
```

### Working with Existing Features

If modifying existing feature:
1. Phase 1: Describe modifications clearly
2. Phase 2: Plan will include "Modified" status for affected modules
3. Phase 3: Agents will use Edit tool instead of Write for modifications

### Parallel Feature Development

If working on multiple features:
1. Each feature has own branch
2. Each feature has own state file
3. Can run /plan-feature for multiple features
4. Implement one at a time (to avoid context conflicts)

---

## Quick Reference

### Commands

| Command | Phase | Purpose |
|---------|-------|---------|
| `/plan-feature` | 1 | Create feature specification |
| `/plan-implementation {ticket}` | 2 | Create implementation plan |
| `/implement-feature {ticket}` | 3 | Execute implementation via agents |
| `/verify-implementation {ticket}` | 4 | Verify via verification-agent |
| `/review-code` | 5 | Review via review-processor agent |
| `/quick-implement` | - | Fast path for small tasks (inline planning, same state tracking) |

### Agents

| Agent | Phase | Purpose |
|-------|-------|---------|
| `step-executor` | 3 | Execute step components via skills |
| `step-verifier` | 3 | Build and check after each step |
| `integration-agent` | 3 | Wire components and routes (final step) |
| `verification-agent` | 4 | Full verification checks |
| `review-processor` | 5 | Run CodeRabbit and categorize findings |

### File Locations

| File | Purpose | Committed? |
|------|---------|------------|
| `.5/{ticket}/feature.md` | Feature spec | Yes (after approval) |
| `.5/{ticket}/plan/` | Atomic implementation plan (meta.md, step-N.md, verification.md) | Yes (after approval) |
| `.5/{ticket}/state.json` | Progress tracking | No (gitignored) |
| `.5/{ticket}/verification.md` | Verification report | No (gitignored) |
| `.5/{ticket}/review-{timestamp}.md` | CodeRabbit review report | No (gitignored) |

### State File Status Values

| Status | Meaning |
|--------|---------|
| `in-progress` | Implementation ongoing |
| `completed` | Implementation finished successfully |
| `failed` | Implementation failed, needs fixes |

### Verification Status Values

| Status | Meaning | Action |
|--------|---------|--------|
| `passed` | All checks successful | Ready to commit |
| `passed-with-warnings` | Warnings but no errors | Review warnings, then commit |
| `failed` | Errors found | Fix errors, re-verify |

---

## Configuring for Different Tech Stacks

The 5-phase workflow is designed to work with any technology stack. Configuration is stored in `.claude/.5/config.json` and can be customized using the `/5:configure` command.

### Quick Setup

```bash
# Interactive configuration wizard
/5:configure
```

The wizard will:
1. Auto-detect your project type (Node.js, Python, Java, Rust, Go, etc.)
2. Set up appropriate build and test commands
3. Configure ticket ID patterns
4. Set up step structure (default 3 steps)

### Configuration Examples

**JavaScript/TypeScript (Node.js)**
```json
{
  "ticket": {
    "pattern": "[A-Z]+-\\d+",
    "extractFromBranch": true
  },
  "build": {
    "command": "npm run build",
    "testCommand": "npm test"
  },
  "steps": [
    { "name": "foundation", "mode": "parallel" },
    { "name": "logic", "mode": "sequential" },
    { "name": "integration", "mode": "sequential" }
  ]
}
```

**Python**
```json
{
  "build": {
    "command": "python -m py_compile",
    "testCommand": "pytest"
  },
  "steps": [
    { "name": "models", "mode": "parallel" },
    { "name": "services", "mode": "sequential" },
    { "name": "api", "mode": "sequential" }
  ]
}
```

**Java (Gradle)**
```json
{
  "build": {
    "command": "gradle build",
    "testCommand": "gradle test"
  },
  "steps": [
    { "name": "domain", "mode": "parallel" },
    { "name": "business-logic", "mode": "sequential" },
    { "name": "api-integration", "mode": "sequential" }
  ]
}
```

### Customizing Steps

You can configure the number and names of implementation steps. The default is 3 steps:

- **Step 1 (Foundation)**: Core models, types, schemas - executed in parallel
- **Step 2 (Logic)**: Business logic, services - executed sequentially if dependencies exist
- **Step 3 (Integration)**: API routes, wiring, tests - executed sequentially

For more complex projects, you might use 4-5 steps:

```json
{
  "steps": [
    { "name": "models", "mode": "parallel" },
    { "name": "validation", "mode": "parallel" },
    { "name": "services", "mode": "sequential" },
    { "name": "api", "mode": "sequential" },
    { "name": "integration", "mode": "sequential" }
  ]
}
```

### Auto-Detection

The workflow automatically detects:
- **Build system**: package.json, build.gradle, Cargo.toml, go.mod, Makefile, etc.
- **Test runner**: Jest, Vitest, pytest, cargo test, go test, Gradle, Maven, etc.
- **Project type**: Express, NestJS, Next.js, Django, FastAPI, Spring Boot, etc.

You can override auto-detected values in the config file.

### Further Customization

See the `/5:configure` command for interactive configuration, or manually edit `.claude/.5/config.json` to customize:
- Ticket ID patterns
- Branch naming conventions
- Build and test commands
- Step structure and execution modes
- Integration patterns

---

## Related Documentation

- **[CLAUDE.md](../../CLAUDE.md)** - Project context, domain patterns and conventions
- **[Skills README](../../skills/README.md)** - All available skills

---

## Feedback

Found an issue with this workflow or have suggestions?
- Create an issue: https://github.com/anthropics/claude-code/issues
- Or discuss with your team
