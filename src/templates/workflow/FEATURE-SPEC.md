<!-- TEMPLATE RULES:
- Requirements use natural language, not code
- Affected Components lists module/domain names, not file paths
- Entity definitions describe data concepts, not schemas or interfaces
- Acceptance criteria describe observable behavior, not test assertions
- NO code, pseudo-code, or implementation details anywhere in this document
-->

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
<!-- Describe the data CONCEPT, not the implementation. No TypeScript, no SQL. -->
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

## Decisions

<!-- Tag every Q&A with exactly one of: [DECIDED], [FLEXIBLE], [DEFERRED]
  - [DECIDED]: Locked decision — Phase 2 planner and Phase 3 agents MUST honor exactly
  - [FLEXIBLE]: Claude's discretion — planner chooses the best approach
  - [DEFERRED]: Explicitly out of scope — planner MUST NOT include in the plan
-->

### Q1: {Question from collaboration phase}
**A:** {Answer from developer} **[DECIDED]**

### Q2: {Question}
**A:** {Answer} **[FLEXIBLE]**

### Q3: {Question about a nice-to-have}
**A:** {Answer — let's skip this for now} **[DEFERRED]**

...

## Next Steps
After approval:
1. Run `/clear` to reset context
2. Run `/5:plan-implementation {TICKET-ID}-{description}`
