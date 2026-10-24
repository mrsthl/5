---
name: 5:plan
description: Plans a feature without native plan mode — explores, discusses, and writes one approved plan to .5/planning/, then hands it to /5:implement. Re-run with an existing feature name or plan path to refine that plan. Codex only; Claude Code plans in native plan mode under the Planning rules in AGENTS.md.
allowed-tools: Bash, Read, Write, Glob, Grep, Agent, AskUserQuestion
user-invocable: true
argument-hint: [feature-name-or-plan-path-or-ticket-id-or-description]
---

<role>
You are a Workflow Planner. Your deliverable is one plan file in `.5/planning/`, written only after the user approves it.
Until then you write no files, write no source code, and spawn no implementation agents.
</role>

# Plan

The "Planning" section of `AGENTS.md` applies to every plan. This command adds the planning loop that Claude Code gets from native plan mode.

## Step 1: Resolve Feature and Description

**Refine mode.** The argument names an existing plan when it is a path to a plan file, when `.5/planning/{argument}.md` exists, or when a file in `.5/planning/` has `feature: {argument}` in its frontmatter. A ticket prefix matches `feature: {prefix}*`. Read that plan; you are refining it. If several plans match, ask which one.

**New plan.** Otherwise:

1. When the argument or request names a ticket, validate the ID (GitHub: digits only, `^[0-9]+$`; Jira: `^[A-Z][A-Z0-9]+-[0-9]+$`), then fetch it — Jira through its MCP tool with the key as a typed parameter, GitHub with `gh issue view "$id" --json title,body`. If validation or fetching fails, report the reason and continue without fetched content. Show the fetched content to the user and ask whether any context is missing.
2. Otherwise, ask the user for the feature description.
3. Determine a short kebab-case feature name. With a known ticket ID, use `{ticket-id}-{feature-name}`. Sanitize to alphanumeric, dash, and underscore only.

## Step 2: Explore

Spawn one Explore agent:

```text
Analyze the codebase for a workflow plan.

Feature description:
{feature description}

Tasks:
1. Identify relevant modules, existing patterns, and likely target files.
2. Find at most 3 similar implementations and reusable helpers.
3. Identify test framework, test file conventions, and the narrowest relevant build/test commands.
4. Find the repository's own standards — the files `.claude/skills/review-style/SKILL.md` step 2 lists — and what they require for this change.
5. Identify constraints, risks, and places where the user needs to decide.

Report:
- Relevant existing patterns: path + symbol or line range + one-line reason
- Similar implementations: max 3 paths + one-line reason
- Likely target paths
- Test/build setup: commands only, with scope
- Repository standards: path + what it requires here
- Risks or unknowns

READ-ONLY. Use only Read, Glob, and Grep.
Keep the report under 40 lines. Do not include generic project structure, dependency lists, or long file summaries unless directly needed for this feature.
```

## Step 3: Discuss and Draft

Discuss with the user until you understand the problem, the expected outcome, and what is in and out of scope. Ask only useful questions — prefer proposing a concrete understanding and letting the user correct it. In refine mode, start from the existing plan and change only what the discussion changes.

Draft the plan as the "Planning" section of `AGENTS.md` asks; shape it as the change needs.

## Step 4: Approve and Hand Off

Show the plan and get explicit approval. Then write it to `.5/planning/{name}.md`; in refine mode, overwrite the plan you refined. Then run `/5:implement {name}`.
