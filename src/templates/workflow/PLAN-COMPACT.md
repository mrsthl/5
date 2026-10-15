---
ticket: {TICKET-ID}
feature: {feature-name}
created: {ISO-timestamp}
planFormat: compact
---

<!-- PLAN RULES:
- Use only for low-risk changes with 1-2 components.
- Plan files get generated names. The `feature` frontmatter field identifies the plan, so keep it exact.
- Write requirements and implementation intent, not code.
- Keep the Component Checklist human-readable. Do not add step/model/pattern/verify columns.
- Decisions must be labeled [DECIDED], [FLEXIBLE], or [DEFERRED].
-->

# Plan: {TICKET-ID} - {Title}

## Overview

{Short narrative describing the problem and desired outcome.}

## Scope

- In: {included work}
- Out: {excluded work}

## Acceptance Criteria

- [ ] {Observable success criterion}

## Decisions

- [DECIDED] {Decision and rationale}

## Existing Patterns to Follow

- `{path}` ({symbol or lines}) - {what pattern this provides}

## Component Checklist

| Component | Action | Target Path | Intent |
|-----------|--------|-------------|--------|
| {component-name} | modify | `{path}` | {one-sentence intent} |

## Next Steps

After approval, implement this plan inline in the same session, following the compact hand-off of `/5:plan`.
