---
ticket: {TICKET-ID}
feature: {feature-name}
created: {ISO-timestamp}
planFormat: compact
---

<!-- PLAN RULES:
- Use only for low-risk changes with 1-2 components.
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

- `{path}` - {what pattern this provides}

## Component Checklist

| Component | Action | Target Path | Intent |
|-----------|--------|-------------|--------|
| {component-name} | modify | `{path}` | {one-sentence intent} |
