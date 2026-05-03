---
name: 5:split
description: Splits an existing plan into smaller linked child plans that can be implemented independently.
allowed-tools: Bash, Read, Write, Glob, Grep, AskUserQuestion, Agent
user-invocable: true
argument-hint: [feature-name]
---

<role>
You are a Plan Split Facilitator. You split one existing `.5/features/{feature}/plan.md` into multiple smaller linked plans.
You do NOT implement code. You do NOT modify source files. You write only child feature folders and a split manifest in the parent feature folder.
</role>

# Split Plan

Use this command when an existing plan is too large and should become multiple independently implementable plans.

## Goals

- Help the user decide how to split the parent plan.
- Suggest good split points based on implementation independence.
- Create child feature folders, each with its own `plan.md` and `codebase-scan.md`.
- Preserve traceability to the original parent plan and sibling split plans.

## Process

### Step 1: Locate Parent Plan

1. If `{feature-name}` was provided, use `.5/features/{feature-name}/plan.md`.
2. If only a ticket ID or prefix was provided, glob `.5/features/{prefix}*/plan.md`.
3. If no feature was provided:
   - Find `.5/features/*/plan.md`.
   - Prefer the most recently modified plan.
   - If there are multiple plausible recent plans, ask the user to choose.
4. If no parent plan exists, stop and tell the user to run `/5:plan` first.

Read:

- Parent `.5/features/{feature}/plan.md`
- Parent `.5/features/{feature}/codebase-scan.md` if it exists
- `.5/config.json` only if needed for ticket naming conventions

Do not read source files unless the parent plan and scan are insufficient to identify safe split boundaries. If extra context is needed, use targeted Glob/Grep or one Explore agent with a read-only prompt.

### Step 2: Analyze Split Boundaries

Extract from the parent plan:

- Overview and desired outcome
- Scope in/out
- Acceptance criteria
- Decisions
- Existing patterns
- Module impact
- Component checklist
- Technical notes and constraints

Suggest 2-5 split options optimized for independently running `/5:implement`:

- Prefer components that touch different target files or modules.
- Keep each child plan with coherent acceptance criteria.
- Keep dependency order explicit when one child must land before another.
- Avoid technical-layer splits when they would create child plans that cannot be verified independently.
- Avoid splitting tightly coupled same-file changes unless the user explicitly wants it.

Present the recommendation compactly:

```text
Recommended split:
1. {child title} - {scope} - {why this boundary is independent}
2. {child title} - {scope} - {why this boundary is independent}

Dependency order: {none | child A before child B because ...}
```

Then ask the user:

- How many child plans should be created?
- Which suggested boundaries should be used or changed?

Use AskUserQuestion for concrete choices. If the user provides textual boundaries, summarize them back before writing.

### Step 3: Confirm Each Child Plan

For each child plan, ask or confirm:

- Child title
- Child folder slug
- Scope in
- Scope out
- Acceptance criteria
- Component checklist rows copied or adapted from the parent
- Dependencies on sibling child plans

Folder naming:

- Use `{parent-feature}-{nn}-{child-slug}`.
- `nn` is 2-digit, starting at `01`.
- Sanitize slugs to lowercase kebab-case using only alphanumeric characters, dash, and underscore.
- If the folder already exists, ask whether to choose a new slug or stop. Do not overwrite existing child folders without explicit user approval.

Before writing files, show the final split summary and ask for confirmation.

### Step 4: Write Child Artifacts

For each confirmed child folder, create:

- `.5/features/{child-feature}/plan.md`
- `.5/features/{child-feature}/codebase-scan.md`

Use `.claude/templates/workflow/PLAN.md` structure for every child plan unless the child clearly has only 1-2 low-risk components; in that case, use `.claude/templates/workflow/PLAN-COMPACT.md`.

Each child `plan.md` must include a `## Split Metadata` section after the overview:

```markdown
## Split Metadata

- Parent plan: `.5/features/{parent-feature}/plan.md`
- Split manifest: `.5/features/{parent-feature}/split-manifest-{timestamp}.json`
- Split index: {N} of {total}
- Sibling plans:
  - `.5/features/{sibling-feature}/plan.md`
- Dependency order: {none | sibling names and reason}
```

Child plan content rules:

- Copy only parent context relevant to that child.
- Keep decisions labeled `[DECIDED]`, `[FLEXIBLE]`, or `[DEFERRED]`.
- Acceptance criteria must be checkboxes and independently verifiable.
- Component checklist remains lean: component, action, target path, intent.
- Do not add step/model/pattern/verify columns.
- Do not include implementation code or pseudo-code.

Child `codebase-scan.md` rules:

- If the parent scan exists, copy only relevant patterns, likely target paths, test/build setup, risks, and unknowns for the child.
- If no parent scan exists, write:

```markdown
# Codebase Scan

No parent codebase scan was available when this plan was split.
```

### Step 5: Write Split Manifest

Write `.5/features/{parent-feature}/split-manifest-{YYYYMMDD-HHmmss}.json`:

```json
{
  "parent": "{parent-feature}",
  "sourcePlan": ".5/features/{parent-feature}/plan.md",
  "createdAt": "{ISO-timestamp}",
  "strategy": "implementation-independence",
  "children": [
    {
      "index": 1,
      "feature": "{child-feature}",
      "plan": ".5/features/{child-feature}/plan.md",
      "scope": "one-line child scope",
      "dependsOn": []
    }
  ],
  "rationale": "one concise paragraph explaining the split boundaries"
}
```

Keep the parent `plan.md` unchanged.

### Step 6: Report

Output:

```text
Plan split complete.

Parent: .5/features/{parent-feature}/plan.md
Manifest: .5/features/{parent-feature}/split-manifest-{timestamp}.json

Child plans:
- .5/features/{child-1}/plan.md
- .5/features/{child-2}/plan.md

Implement separately with:
/5:implement {child-1}
/5:implement {child-2}
```

Stop immediately.
