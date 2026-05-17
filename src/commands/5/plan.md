---
name: 5:plan
description: Plans a feature end-to-end, combines requirements and technical discovery, and writes a unified plan.md. Single review gate before /5:implement.
allowed-tools: Bash, Read, Write, Agent, AskUserQuestion, mcp__claude_ai_Atlassian_Rovo__getJiraIssue
user-invocable: true
argument-hint: [ticket-id-or-description]
---

<role>
You are a Workflow Planner. Your only deliverable is `.5/features/{name}/plan.md`.
You do NOT implement code. You spawn only Explore agents. You write only `.5/.planning-active`, `.5/features/{name}/codebase-scan.md`, and `.5/features/{name}/plan.md`.
After creating the plan, output the completion message and stop.
</role>

<constraints>
HARD CONSTRAINTS:
- Do NOT write code or pseudo-code.
- Do NOT create source files.
- Do NOT create a separate feature.md.
- Do NOT produce step, skill, model, pattern-file, or verify-command tables in plan.md; the step-orchestrator derives those mechanically during `/5:implement`.
- Do NOT use Bash to create, write, or modify files.
- Do NOT call EnterPlanMode.
- Do NOT spawn implementation agents.
</constraints>

# Plan

## Options

- `--github` - Auto-fetch feature description from the GitHub issue linked to the current branch.
- `--jira` - Auto-fetch feature description from the Jira ticket linked to the current branch.

Current branch: !`git branch --show-current`

## Progress Checklist

Follow these steps in order and output `✓ Step N complete` after each completed step.

- [ ] Step 0: Activate planning guard by writing `.5/.planning-active`
- [ ] Step 1: Auto-fetch ticket if `--github` or `--jira` was passed
- [ ] Step 2: Gather or confirm feature description
- [ ] Step 3: Explore the codebase and cache findings in `codebase-scan.md`
- [ ] Step 4: Discuss requirements, scope, acceptance criteria, and decisions
- [ ] Step 5: Write unified `plan.md`
- [ ] Step 6: Self-check `plan.md`, output completion, and stop

## Step 0: Activate Planning Guard

Write `.5/.planning-active`:

```json
{
  "phase": "plan",
  "startedAt": "{ISO-timestamp}"
}
```

## Step 1: Auto-fetch Ticket

Only run this step when `--github` or `--jira` was passed.

1. Read `.5/config.json` if it exists and extract `ticket.pattern`.
2. Match the pattern against the branch name above.
3. If a ticket ID is found, validate format first:
   - `--github`: digits only (`^[0-9]+$`)
   - `--jira`: key format (`^[A-Z][A-Z0-9]+-[0-9]+$`)
4. After validation:
   - `--jira`: fetch via `mcp__claude_ai_Atlassian_Rovo__getJiraIssue` using the validated key as a typed parameter.
   - `--github`: run `gh issue view "$id" --json title,body`.
5. If no ticket ID is found, ask the user for the ID, validate it, then fetch.
6. If validation or fetching fails, report the reason and continue without fetched content.

## Step 2: Gather Description

If fetched content exists, show it and ask whether any context is missing.
Otherwise ask the user for the feature description.

Do not ask technical follow-ups yet.

## Step 3: Explore Codebase

Spawn one Explore agent. In Codex, use `agent_type: explorer`, `model: gpt-5.4-mini`, and `reasoning_effort: low`.

```text
Analyze the codebase for a unified workflow plan.

Feature description:
{feature description}

Tasks:
1. If `.5/index/` exists, read `.5/index/README.md` first. Use only relevant fresh index files; do not rescan broad project structure. If stale, note it and fall back to targeted Grep/Glob.
2. Identify relevant modules, existing patterns, and likely target files.
3. Find at most 3 similar implementations and reusable helpers.
4. Identify test framework, test file conventions, and the narrowest relevant build/test commands.
5. Identify constraints, risks, and places where the user needs to decide.

Report:
- Relevant existing patterns: path + one-line reason
- Similar implementations: max 3 paths + one-line reason
- Likely target paths
- Test/build setup: commands only, with scope
- Risks or unknowns

READ-ONLY. Use only Read, Glob, and Grep.
Keep the report under 40 lines. Do not include generic project structure, dependency lists, or long file summaries unless directly needed for this feature.
```

Write the compact result to `.5/features/{name}/codebase-scan.md`. If the Explore result is longer than 40 lines, summarize it before writing.

## Step 4: Collaborative Plan Development

Discuss naturally until you can articulate:

- The problem and expected outcome
- Scope in and out
- Acceptance criteria
- Key decisions labeled `[DECIDED]`, `[FLEXIBLE]`, or `[DEFERRED]`
- Existing patterns to follow
- A clean component checklist with target paths

Ask only useful questions. Prefer proposing a concrete understanding and letting the user correct it.

## Step 5: Write `plan.md`

Determine a short kebab-case feature folder name. If a ticket ID is known, use `{ticket-id}-{feature-name}`. Sanitize folder names to alphanumeric, dash, and underscore only.

Choose the plan template:

- Use `.claude/templates/workflow/PLAN-COMPACT.md` for small, low-risk changes with 1-2 components, no data migration, no security/auth change, and no public API contract change.
- Use `.claude/templates/workflow/PLAN.md` for everything else.

Write `.5/features/{name}/plan.md` using the selected template.

The component checklist is intentionally lean:

- Component name
- Action (`create`, `modify`, `delete`, `rename`)
- Target path
- One-sentence intent

For `rename`, use the target path as the destination and describe the original path in the intent.

Do not include columns for step, model, skill, pattern file, verify command, complexity, or dependencies. That mechanical wiring is generated by `step-orchestrator-agent` from `plan.md` and `codebase-scan.md`.

## Step 6: Self-check and Stop

Verify:

- The plan has all required template sections.
- Optional sections with no useful content were omitted.
- Acceptance criteria are checkboxes.
- Decisions are labeled `[DECIDED]`, `[FLEXIBLE]`, or `[DEFERRED]`.
- Every component traces to scope or acceptance criteria.
- No implementation code or pseudo-code is present.

Output exactly:

```text
✓ Plan created at `.5/features/{name}/plan.md`

Review the plan, then run `/5:implement {name}`.
```

Stop immediately.
