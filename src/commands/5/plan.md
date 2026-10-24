---
name: 5:plan
description: Plans a feature in native plan mode, which saves the approved plan in .5/planning/. Uses an equivalent prose loop when plan mode is unavailable. Implements compact plans inline; hands larger ones to /5:implement. Re-run with an existing feature name or plan path to refine that plan.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent, AskUserQuestion, EnterPlanMode, Skill, TaskCreate, TaskUpdate, mcp__claude_ai_Atlassian_Rovo__getJiraIssue
user-invocable: true
argument-hint: [feature-name-or-plan-path-or-ticket-id-or-description]
---

<role>
You are a Workflow Planner. Your deliverable is one plan file in `.5/planning/`. Plan mode saves it there because `/5:configure` sets `plansDirectory` to `.5/planning`.
Exploration, questions, and the approval gate belong to plan mode — you write no code until the user approves the plan.
After approval you implement only **compact** plans, inline in this session. Anything larger goes to `/5:implement`.
</role>

# Plan

## Options

- `--github` - Auto-fetch the feature description from the GitHub issue linked to the current branch.
- `--jira` - Auto-fetch the feature description from the Jira ticket linked to the current branch.

Current branch: !`git branch --show-current`

## Step 1: Resolve Feature and Description

Run these before entering plan mode.

**Refine mode.** The argument names an existing plan when it is a path to a plan file, or when a file in `.5/planning/` has `feature: {argument}` in its frontmatter. A ticket prefix matches `feature: {prefix}*`. Read that plan. You are refining it; skip ticket fetching and go to Step 2. If several plans match, ask which one. A plan without frontmatter, such as one made in plain plan mode, gets its feature name in Step 2.

**New plan.** Otherwise:

1. Only when `--github` or `--jira` was passed, resolve the ticket:
   - Read `.5/config.json` if it exists and extract `ticket.pattern`.
   - Match the pattern against the branch name above.
   - Validate the ID before fetching: `--github` requires digits only (`^[0-9]+$`), `--jira` requires key format (`^[A-Z][A-Z0-9]+-[0-9]+$`).
   - `--jira`: fetch via `mcp__claude_ai_Atlassian_Rovo__getJiraIssue` using the validated key as a typed parameter.
   - `--github`: run `gh issue view "$id" --json title,body`.
   - If no ticket ID is found, ask the user for it, validate, then fetch. If validation or fetching fails, report the reason and continue without fetched content.
   - Show fetched content to the user and ask whether any context is missing.
2. Otherwise, ask the user for the feature description.
3. Determine a short kebab-case feature name. With a known ticket ID, use `{ticket-id}-{feature-name}`. Sanitize to alphanumeric, dash, and underscore only.

**Plans directory (Claude Code only — skip on Codex).** If `.claude/settings.json` does not set `plansDirectory` to `.5/planning`, tell the user once that plan mode will save the plan outside `.5/planning/` until they run `/5:reconfigure`. Continue anyway.

## Step 2: Plan in Plan Mode

Call `EnterPlanMode`. Plan mode owns codebase exploration, clarifying questions, the plan file, and the approval gate — do not run a parallel discovery pass of your own. The plan file is the only planning artifact; never write a second copy of it.

Carry these constraints into the planning work:

**Output shape.** Write the plan using the section shape of `.claude/templates/workflow/PLAN.md`, including its frontmatter with `feature` set to the feature name from Step 1. Plan files get generated names, so this field is how `/5:implement` finds the plan. Use `.claude/templates/workflow/PLAN-COMPACT.md` instead for small, low-risk changes with 1-2 components, no data migration, no security/auth change, and no public API contract change; its frontmatter adds `planFormat: compact`. The plan must contain a Component Checklist table of `Component | Action | Target Path | Intent`, where action is `create`, `modify`, `delete`, or `rename`. For `rename`, the target path is the destination and the intent names the original path. Do not add step, model, skill, pattern-file, or verify-command columns — `/5:implement` derives that wiring mechanically. End with the template's Next Steps section, so the hand-off survives a cleared context.

**Diagram.** When the change has a flow across components, a state machine, or new component relationships, add the template's Diagram section with one valid mermaid diagram of what changes. Omit it for linear or single-file changes.

**Discovery goes into the plan.** `/5:implement` reads only the plan. Name each pattern to follow with its path and a symbol or line range, and put the narrowest test or build command in Technical Notes.

**Repository standards.** Read the repository's own standards — the files `.claude/skills/review-style/SKILL.md` step 2 lists. Plan what they require, such as tests, a changelog entry, or docs. They win over the workflow's own rules.

**Necessity gate.** Apply this to every component before it enters the plan. Ask "does this need to exist?" and prefer the simplest approach that meets the acceptance criteria: reuse the standard library, a native platform/framework feature, or an already-installed dependency before adding anything new. Push speculative or "might need later" work to `[DEFERRED]`. Do not plan abstractions, flexibility, or configurability that no acceptance criterion requires.

**No code.** Requirements and implementation intent only — no code or pseudo-code in the plan.

In refine mode, seed the plan file with the existing plan's content and change only what the discussion actually changes.

**Self-check before `ExitPlanMode`.** Approval makes the plan final, so verify first:

- The frontmatter has `feature`, plus `planFormat: compact` for a compact plan.
- The plan has all required template sections, and optional sections with no useful content were omitted.
- Acceptance criteria are checkboxes.
- A Diagram, when present, is valid mermaid and shows what changes, not the whole system.
- Decisions are labeled `[DECIDED]`, `[FLEXIBLE]`, or `[DEFERRED]`.
- Every component traces to scope or acceptance criteria, and none adds abstraction, flexibility, or configurability beyond what an acceptance criterion requires.
- No implementation code or pseudo-code is present.

## Step 3: After Approval

The approved plan file is the plan. Note its path.

- In refine mode, delete the plan file this plan replaces, unless it is the same file. The new plan carries its content.
- If the plan file is not inside `.5/planning/`, use its path instead of the feature name in the hand-off below, so `/5:implement` can find it.

## Step 4: Hand Off

Approving a plan means the user wants it built. Branch on the plan format you chose in Step 2 — the point is to spend a fresh delegated run only where it pays for itself.

**Compact plan** (`planFormat: compact`, 1-2 low-risk components): implement it here, in this session. The context is already warm, and spinning up orchestration to edit one or two files costs more than it saves. In refine mode, only do this when the refined plan has not been implemented yet — check `.5/features/{name}/state.json`.

1. Record `git rev-parse HEAD` as the review's fixed point. Say what you are about to do, then implement the Component Checklist directly. Follow the repository's standards first, then the style skills listed under `## Styles` in `.claude/skills/review-style/SKILL.md`. Make the smallest coherent change per component and follow the patterns named in the plan.
2. Run the verify commands from `.5/config.json`. Skip any set to `none`.
   Then check scope: `git status --short` must list only the Component Checklist target paths and what they strictly need (their tests, import sites, files a repository standard requires). Revert anything else before continuing, and tell the user in one line what you deliberately left out (`skipped: X — add when Y`).
3. Write `.5/features/{name}/state.json`:

```json
{
  "feature": "{name}",
  "status": "completed|failed",
  "completedComponents": ["component-name"],
  "verification": {"status": "passed|partial|failed", "summary": "one line"},
  "startedAt": "{ISO-timestamp}",
  "lastUpdated": "{ISO-timestamp}"
}
```

Component names must match the plan's Component Checklist verbatim, so a later `/5:implement` can resume against them. This file is also how `/5:review` finds the feature.

4. If `.5/config.json` `git.autoCommit` is `true`, make one commit for the change using `git.commitMessage.pattern`, staging only the files you touched. Never `git add .` or `git add -A`.
5. Review the change against the standards: `Skill(skill: "review-style", args: "{fixed-point} files: {files-you-touched}")`. Naming the files keeps changes the user already had out of the review and its fixes. It checks those files since the fixed point, committed or not, against the repository's standards and the style skills. It reports the findings and asks which ones to fix.
6. Report what changed, the verification result, the standards findings, and:

```text
✓ Plan at `{plan-path}` — implemented inline (compact plan)

Run `/5:review` when you are ready.
```

If verification fails, leave `status: "failed"` and tell the user they can fix the issue and rerun `/5:implement {name}` to resume.

**Full plan:** do not implement. A multi-component plan is worth a fresh run — `/5:implement` executes independent components in parallel waves, routes mechanical work to cheaper models, and gives each executor a narrow context instead of this whole conversation. Output exactly:

```text
✓ Plan saved at `{plan-path}`

Review the plan, then run `/5:implement {name}` in a fresh context.
```

Then stop immediately.

## Fallback path

On Codex, or in any runtime without `EnterPlanMode`, replace Step 2 with this loop. Steps 1, 3, and 4 are unchanged — including the compact-plan inline implementation, which matters more here because Codex has no Workflow tool to parallelize a delegated run.

1. Spawn one Explore agent:

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

2. Discuss with the user until you can articulate the problem and expected outcome, scope in and out, acceptance criteria, key decisions labeled `[DECIDED]` / `[FLEXIBLE]` / `[DEFERRED]`, existing patterns to follow, and a component checklist with target paths. Ask only useful questions — prefer proposing a concrete understanding and letting the user correct it.

3. Apply the same output shape, diagram, discovery, repository standards, necessity gate, and no-code constraints from Step 2, and run its self-check.

4. Show the plan to the user and get explicit approval before writing it.

5. After approval, write the plan to `.5/planning/{name}.md`. In refine mode, overwrite the plan you refined instead.

Until the user approves the plan you are a planner, not an implementer: write no files, write no source code, and spawn no implementation agents. Claude Code enforces this through plan mode; here it is on you. After approval, Steps 3 and 4 apply as written.
