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

## Step 1: Locate the Parent Plan

Resolve `{feature-name}` to `.5/features/{feature-name}/plan.md`. Given only a ticket ID or prefix, glob `.5/features/{prefix}*/plan.md`. Given nothing, use the most recently modified `.5/features/*/plan.md`, asking the user to choose between several plausible recent ones. If no parent plan exists, stop and tell the user to run `/5:plan` first.

Read the parent `plan.md` and its `codebase-scan.md` if it exists. Do not read source files unless those two are insufficient to identify safe split boundaries; if they are, use targeted Glob/Grep or one read-only Explore agent.

## Step 2: Agree on the Split

Propose 2-5 boundaries optimized for running `/5:implement` on each child independently: prefer components touching different files or modules, keep each child's acceptance criteria coherent and independently verifiable, and make dependency order explicit when one child must land first. Avoid technical-layer splits that produce children nobody can verify alone, and avoid splitting tightly coupled same-file changes unless the user asks for it.

Present the recommendation compactly:

```text
Recommended split:
1. {child title} - {scope} - {why this boundary is independent}
2. {child title} - {scope} - {why this boundary is independent}

Dependency order: {none | child A before child B because ...}
```

Agree with the user on the boundaries, each child's scope and folder slug, and which components go where. Show the final split summary and get confirmation before writing anything.

Folder naming: `{parent-feature}-{nn}-{child-slug}`, with `nn` a 2-digit index starting at `01` and the slug sanitized to lowercase kebab-case (alphanumeric, dash, underscore). If a folder already exists, ask whether to choose a new slug or stop — never overwrite an existing child folder without explicit approval.

## Step 3: Write Child Artifacts

For each confirmed child, write `.5/features/{child-feature}/plan.md` using `.claude/templates/workflow/PLAN.md`, or `PLAN-COMPACT.md` when the child clearly has only 1-2 low-risk components. Copy only the parent context relevant to that child. Keep decisions labeled `[DECIDED]` / `[FLEXIBLE]` / `[DEFERRED]`, acceptance criteria as independently verifiable checkboxes, and the component checklist lean (component, action, target path, intent — no step/model/pattern/verify columns, no code).

Each child plan carries this section after its overview:

```markdown
## Split Metadata

- Parent plan: `.5/features/{parent-feature}/plan.md`
- Split manifest: `.5/features/{parent-feature}/split-manifest-{timestamp}.json`
- Split index: {N} of {total}
- Sibling plans:
  - `.5/features/{sibling-feature}/plan.md`
- Dependency order: {none | sibling names and reason}
```

Also write `.5/features/{child-feature}/codebase-scan.md` with the parent scan's patterns, target paths, test/build setup, risks, and unknowns that apply to that child. If there is no parent scan, write `# Codebase Scan` followed by `No parent codebase scan was available when this plan was split.`

## Step 4: Write the Split Manifest

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

Leave the parent `plan.md` unchanged.

## Step 5: Report

Output the parent path, the manifest path, each child plan path, and the `/5:implement {child}` command for each. Then stop.
