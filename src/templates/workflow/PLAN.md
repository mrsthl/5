---
ticket: {TICKET-ID}
feature: {feature-name}
created: {ISO-timestamp}
---

<!-- PLAN RULES:
- This file is interpolated into agent prompts. Write it as instructions, not documentation.
- Description column: one action-oriented sentence per component
- Implementation Notes: reference existing files as patterns, no code snippets
- Components table must cover all functional requirements from feature.md
-->

# Implementation Plan: {TICKET-ID}

{One sentence summary of what this plan builds}

## Components

| Step | Component | Action | File | Description | Complexity |
|------|-----------|--------|------|-------------|------------|
| 1 | {name} | create | {path} | {what it does} | simple |
| 1 | {name} | create | {path} | {what it does} | simple |
| 2 | {name} | create | {path} | {what it does} | moderate |
| 2 | {name} | modify | {path} | {what to change} | moderate |
| 3 | {name} | create | {path} | {what it does} | complex |

## Implementation Notes

- Follow the pattern from {existing-file} for {component-type}
- {Key business rule to remember}
- {Integration point to wire up}

## Verification

- Build: {command or "auto"}
- Test: {command or "auto"}
