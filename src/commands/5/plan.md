---
name: 5:plan
description: Plans a feature and persists the approved plan as .5/features/{name}/plan.md. Uses native plan mode when available, otherwise an equivalent prose loop. Implements compact plans inline; hands larger ones to /5:implement. Re-run with an existing feature name to refine that plan.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent, AskUserQuestion, EnterPlanMode, TaskCreate, TaskUpdate, mcp__claude_ai_Atlassian_Rovo__getJiraIssue
user-invocable: true
argument-hint: [feature-name-or-ticket-id-or-description]
---

<role>
You are a Workflow Planner. Your deliverables are `.5/features/{name}/plan.md` and `.5/features/{name}/codebase-scan.md`.
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

**Refine mode.** If the argument names an existing `.5/features/{name}/plan.md` — directly, or via a ticket prefix matched with Glob on `.5/features/{prefix}*/plan.md` — read that plan and its `codebase-scan.md`. You are refining an existing plan; skip ticket fetching and go to Step 2. If a ticket prefix matches several features, ask which one.

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
3. Determine a short kebab-case feature folder name. With a known ticket ID, use `{ticket-id}-{feature-name}`. Sanitize to alphanumeric, dash, and underscore only.

## Step 2: Plan in Plan Mode

Call `EnterPlanMode`. Plan mode owns codebase exploration, clarifying questions, the plan file, and the approval gate — do not run a parallel discovery pass of your own.

If `.5/index/` exists, read `.claude/skills/use-index/SKILL.md` and follow it to select index files instead of scanning the project broadly. Check the `Generated:` timestamp in `.5/index/README.md` first; if the index is more than a day old, run `.5/index/rebuild-index.sh`.

Carry these three constraints into the planning work:

**Output shape.** Write the plan using the section shape of `.claude/templates/workflow/PLAN.md`. Use `.claude/templates/workflow/PLAN-COMPACT.md` instead for small, low-risk changes with 1-2 components, no data migration, no security/auth change, and no public API contract change. The plan must end with a Component Checklist table of `Component | Action | Target Path | Intent`, where action is `create`, `modify`, `delete`, or `rename`. For `rename`, the target path is the destination and the intent names the original path. Do not add step, model, skill, pattern-file, or verify-command columns — `/5:implement` derives that wiring mechanically.

**Necessity gate.** Apply this to every component before it enters the plan. Ask "does this need to exist?" and prefer the simplest approach that meets the acceptance criteria: reuse the standard library, a native platform/framework feature, or an already-installed dependency before adding anything new. Push speculative or "might need later" work to `[DEFERRED]`. Do not plan abstractions, flexibility, or configurability that no acceptance criterion requires.

**No code.** Requirements and implementation intent only — no code or pseudo-code in the plan.

In refine mode, seed the planning work with the existing plan's content and change only what the discussion actually changes.

## Step 3: Persist the Approved Plan

Once the user approves the plan, write:

1. `.5/features/{name}/plan.md` — the approved plan. In refine mode, overwrite the existing file and append to a `## Discussion History` section:

```markdown
## Discussion History

### {ISO-date} - {topic}

**Changes made:**
- {added / clarified / removed}

**Rationale:** {why}
```

2. `.5/features/{name}/codebase-scan.md` — the exploration findings `/5:implement` needs, under 40 lines:

```markdown
# Codebase Scan

## Relevant Existing Patterns
- `{path}` - {one-line reason}

## Similar Implementations
- `{path}` - {one-line reason}

## Likely Target Paths
- `{path}`

## Test/Build Setup
- {command} - {scope}

## Risks or Unknowns
- {risk}
```

In refine mode, update this file only where exploration produced new findings.

## Step 4: Self-check

Verify:

- The plan has all required template sections, and optional sections with no useful content were omitted.
- Acceptance criteria are checkboxes.
- Decisions are labeled `[DECIDED]`, `[FLEXIBLE]`, or `[DEFERRED]`.
- Every component traces to scope or acceptance criteria, and none adds abstraction, flexibility, or configurability beyond what an acceptance criterion requires.
- No implementation code or pseudo-code is present.

## Step 5: Hand Off

Approving a plan means the user wants it built. Branch on the plan format you chose in Step 2 — the point is to spend a fresh delegated run only where it pays for itself.

**Compact plan** (`planFormat: compact`, 1-2 low-risk components): implement it here, in this session. The context is already warm, and spinning up orchestration to edit one or two files costs more than it saves. In refine mode, only do this when the refined plan has not been implemented yet — check `.5/features/{name}/state.json`.

1. Say what you are about to do, then implement the Component Checklist directly. Make the smallest coherent change per component and follow the patterns named in the plan.
2. Run the verify commands from `.5/config.json`. Skip any set to `none`.
   Then check scope: `git status --short` must list only the Component Checklist target paths and what they strictly need (their tests, import sites). Revert anything else before continuing, and tell the user in one line what you deliberately left out (`skipped: X — add when Y`).
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
5. Report what changed, the verification result, and:

```text
✓ Plan at `.5/features/{name}/plan.md` — implemented inline (compact plan)

Run `/5:review` when you are ready.
```

If verification fails, leave `status: "failed"` and tell the user they can fix the issue and rerun `/5:implement {name}` to resume.

**Full plan:** do not implement. A multi-component plan is worth a fresh run — `/5:implement` executes independent components in parallel waves, routes mechanical work to cheaper models, and gives each executor a narrow context instead of this whole conversation. Output exactly:

```text
✓ Plan created at `.5/features/{name}/plan.md`

Review the plan, then run `/5:implement {name}` in a fresh context.
```

Then stop immediately.

## Fallback path

On Codex, or in any runtime without `EnterPlanMode`, replace Step 2 with this loop. Steps 1, 3, 4, and 5 are unchanged — including the compact-plan inline implementation, which matters more here because Codex has no Workflow tool to parallelize a delegated run.

1. Spawn one Explore agent:

```text
Analyze the codebase for a unified workflow plan.

Feature description:
{feature description}

Tasks:
1. If `.5/index/` exists, read the `use-index` skill and follow its guidance to select and read relevant index files. Skip broad project scanning. If the index is missing, fall back to targeted Grep/Glob and note it in the report.
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

2. Discuss with the user until you can articulate the problem and expected outcome, scope in and out, acceptance criteria, key decisions labeled `[DECIDED]` / `[FLEXIBLE]` / `[DEFERRED]`, existing patterns to follow, and a component checklist with target paths. Ask only useful questions — prefer proposing a concrete understanding and letting the user correct it.

3. Apply the same output shape, necessity gate, and no-code constraints from Step 2.

4. Show the plan to the user and get explicit approval before writing it.

Until the user approves the plan you are a planner, not an implementer: write nothing outside `.5/features/{name}/`, write no source code, and spawn no implementation agents. Claude Code enforces this through plan mode; here it is on you. After approval, Step 5 applies as written.
