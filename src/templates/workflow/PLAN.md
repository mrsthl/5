---
ticket: {TICKET-ID}
feature: {feature-name}
spec: .5/features/{feature-name}/feature.md
created: {ISO-timestamp}
---

<!-- PLAN RULES:
- This file is interpolated into agent prompts. Write it as instructions, not documentation.
- Description column: one action-oriented sentence per component
- Pattern File column: path to an existing file the executor MUST read before implementing (establishes conventions)
- Verify column: a concrete command or check the executor runs after implementing (grep pattern, test command, build check)
- Depends On column: name of a component this one depends on (for cross-step data dependencies), or "—" if none
- Implementation Notes: scoped with [global], [Step N], or [component-name] prefixes — the orchestrator filters per agent
- Components table must cover all functional requirements from feature.md
- Three test tiers: unit (always required for logic), integration (when framework detected + cross-module/DB/API), e2e (when framework detected + endpoints/UI flows)
- Every "create" component with logic (services, controllers, repositories, utilities) must have a corresponding unit test component
- Integration/e2e test components are planned only when the project has the corresponding framework
- Declarative-only components (types, interfaces, route wiring) are exempt from test requirements
-->

# Implementation Plan: {TICKET-ID}

{One sentence summary of what this plan builds}

## Components

| Step | Component | Action | File | Description | Pattern File | Verify | Complexity | Depends On |
|------|-----------|--------|------|-------------|-------------|--------|------------|------------|
| 1 | {name} | create | {path} | {what it does} | {existing file to read first} | {grep/test command} | simple | — |
| 1 | {name} | create | {path} | {what it does} | {pattern} | {verify} | simple | — |
| 2 | {name} | create | {path} | {what it does} | {pattern} | {verify} | moderate | {step-1-component} |
| 2 | {name} | modify | {path} | {what to change} | {target file} | {verify} | moderate | — |
| 3 | {name} | create | {path} | {what it does} | {pattern} | {verify} | complex | {step-2-component} |
| 4 | {name} unit tests | create | {test-path} | Test {what it tests} | {existing test} | {test command} | moderate | {tested-component} |
| 4 | {name} integration tests | create | {test-path} | Test {cross-module interaction} | {existing test} | {test command} | moderate | {tested-component} |
| 4 | {name} e2e tests | create | {test-path} | Test {user-facing flow end-to-end} | {existing test} | {test command} | moderate | {tested-component} |

## Testing Strategy

{Which test tiers apply to this feature and why. E.g.: "Unit tests for service logic. Integration tests for API endpoints using Supertest. No e2e — no UI changes."}

## Implementation Notes

- [global] Follow the pattern from {existing-file} for {component-type}
- [Step N] {Convention or context relevant to all components in step N}
- [{component-name}] {Key business rule or integration point specific to this component}

## Verification

- Build: {command or "auto"}
- Test: {command or "auto"}
