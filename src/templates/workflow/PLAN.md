---
ticket: {TICKET-ID}
feature: {feature-name}
created: {ISO-timestamp}
---

<!-- PLAN RULES:
- One planning artifact only: this file.
- Write requirements and implementation intent, not code.
- Keep the Component Checklist human-readable. Do not add step/model/pattern/verify columns; step-orchestrator-agent derives those into state.json.
- Existing Patterns to Follow should name high-value files and conventions so the orchestrator can wire executor prompts cheaply.
- Decisions must be labeled [DECIDED], [FLEXIBLE], or [DEFERRED].
-->

# Plan: {TICKET-ID} - {Title}

## Overview

{Short narrative describing the problem, desired outcome, and why this change is needed.}

## What Changes

- {Logical behavior or capability that changes}
- {User-visible or system-visible outcome}

## Existing Patterns to Follow

- `{path}` - {what pattern this provides}
- `{path}` - {what convention this establishes}

## Constraints

- {Technical, product, compatibility, performance, or rollout constraint}

## Scope

### In

- {Included work}

### Out

- {Explicitly excluded work}

## Acceptance Criteria

- [ ] {Observable success criterion}
- [ ] {Observable success criterion}

## Decisions

- [DECIDED] {Decision and rationale}
- [FLEXIBLE] {Area where implementation may choose the best local pattern}
- [DEFERRED] {Work intentionally not included}

## Module Impact

| Module/Area | Impact |
|-------------|--------|
| {module} | {create/modify/delete behavior at a high level} |

## Component Checklist

| Component | Action | Target Path | Intent |
|-----------|--------|-------------|--------|
| {component-name} | create | `{path}` | {one-sentence intent} |
| {component-name} | modify | `{path}` | {one-sentence intent} |

## Technical Notes

- {Important implementation context, invariants, or migration notes}

## Alternatives Considered

- {Alternative}: {why it was not chosen}

## Next Steps

1. Review this plan.
2. Run `/5:implement {feature-name}`.
