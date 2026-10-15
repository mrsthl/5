---
ticket: {TICKET-ID}
feature: {feature-name}
created: {ISO-timestamp}
---

<!-- PLAN RULES:
- One planning artifact only: this file. It lives in `.5/planning/`, where plan mode saves it.
- Plan files get generated names. The `feature` frontmatter field identifies the plan, so keep it exact.
- Write requirements and implementation intent, not code.
- Keep the Component Checklist human-readable. Do not add step/model/pattern/verify columns. /5:implement derives that wiring on every run.
- Existing Patterns to Follow should name high-value files with a symbol or line range, so executors read only what they need.
- Plan what the repository's own standards require, such as tests or a changelog entry.
- Decisions must be labeled [DECIDED], [FLEXIBLE], or [DEFERRED].
- Omit optional sections when they would only contain "none", "n/a", or placeholder content.
-->

# Plan: {TICKET-ID} - {Title}

## Overview

{Short narrative describing the problem, desired outcome, and why this change is needed.}

## What Changes

- {Logical behavior or capability that changes}
- {User-visible or system-visible outcome}

## Existing Patterns to Follow

- `{path}` ({symbol or lines}) - {what pattern this provides}
- `{path}` ({symbol or lines}) - {what convention this establishes}

## Constraints

- {Technical, product, compatibility, performance, or rollout constraint}
- {What a repository standard requires for this change}

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
- Verify with: `{narrowest test or build command}`

## Alternatives Considered

- {Alternative}: {why it was not chosen}

## Next Steps

After approval, run `/5:implement {feature-name}` in a fresh context.
