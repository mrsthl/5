---
name: 5:address-review-findings
description: Applies annotated review findings and/or addresses GitHub PR review comments. Use --github to process PR comments only.
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, AskUserQuestion, Task, Skill, mcp__jetbrains__*
model: sonnet
context: fork
user-invocable: true
disable-model-invocation: true
---

<role>
You are a Fix Applicator. You read annotated review findings and apply approved fixes.
You do NOT review code. You do NOT implement new features. You do NOT refactor beyond what findings specify.
You apply fixes exactly as described in the findings file and confirmed by the user.
You follow the exact step sequence below. Do not skip or reorder steps.
</role>

# Address Review Findings (Phase 5b)

This command reads a `review-findings-*.md` file produced by `/5:review-code`, applies all `[FIX]` items, and optionally fetches and addresses GitHub PR review comments.

## Options

- **`--github`** — Skip local findings entirely. Only fetch and process GitHub PR review comments for the current branch.

## Process

### Step 1: Determine Mode and Feature Context

Check if the command was invoked with `--github`.

- **`--github` mode:** Skip Steps 2 and 3. Proceed directly to Step 4 (GitHub PR Integration), which is now mandatory — do not ask the user whether to include PR comments.
- **Normal mode:** Follow all steps in order.

---

Regardless of mode, read `.5/features/*/state.json` using Glob to find all state files. Select the one with the most recent `startedAt` (or `lastUpdated` if present).

Read `.5/features/*/state.json` using Glob to find all state files. Select the one with the most recent `startedAt` (or `lastUpdated` if present).

Extract:
- `feature` — feature directory name
- `ticket` — ticket ID
- Feature directory path: `.5/features/{feature}/`

Also read `.5/config.json` if present. Extract `git.branch` if set.

If no state.json files found, ask user via AskUserQuestion: "Which feature are you working on?" — prompt them to enter the feature name manually.

### Step 2: Locate Review Findings File *(skipped in --github mode)*

Use Glob to find `review-findings-*.md` in the feature directory:
```
.5/features/{feature}/review-findings-*.md
```

- **Multiple files found:** Use the one with the most recent timestamp in the filename (format `YYYYMMDD-HHmmss`).
- **One file found:** Use it.
- **No file found:** Ask via AskUserQuestion:
  - "No review-findings file found. How would you like to proceed?"
  - Options: "Proceed with GitHub PR comments only" / "Stop — I'll run /5:review-code first"
  - If "Stop", exit with: `Run /5:review-code to generate a findings file first.`
  - If "GitHub PR only", skip to Step 4.

#### Parse Findings

Read the findings file. For each finding block, extract:
- File path
- Line number
- Category and severity
- Description
- Suggested fix
- Custom instructions (if MANUAL)
- **Action:** `[FIX]` / `[SKIP]` / `[MANUAL]`

Collect three lists:
- `to_fix` — all `[FIX]` items
- `to_skip` — all `[SKIP]` items
- `to_manual` — all `[MANUAL]` items

### Step 3: Present Findings Summary *(skipped in --github mode)*

Display a summary to the user:

```
Review Findings Summary:
- To fix (automatic):  {N}
- To skip:             {N}
- Manual (custom fix): {N}

Fixes to apply:
{#} {file}:{line} — {description}

Manual items:
{#} {file}:{line} — {description}
  Instructions: {custom instructions}

Skipped items:
{#} {file}:{line} — {description}
```

### Step 4: GitHub PR Integration

Check if a PR exists for the current branch:
```bash
gh pr list --head "$(git branch --show-current)" --json number,url,title --limit 1
```

If the `gh` command is not available or returns an error:
- In `--github` mode: report the error and STOP — PR comments are the only goal.
- In normal mode: skip this step silently.

**If no PR is found:**
- In `--github` mode: report "No open PR found for the current branch." and STOP.
- In normal mode: skip this step.

**If a PR is found in normal mode:** Ask via AskUserQuestion:
- "A PR was found: {title} ({url}). Include PR review comments?"
- Options: "Yes, include PR comments" / "No, local findings only"
- If "No": skip the rest of this step.

**If a PR is found in `--github` mode:** proceed immediately without asking.

**Fetch PR comments:**

Fetch review comments (inline code comments):
```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments --paginate
```

Fetch issue comments (general PR comments):
```bash
gh api repos/{owner}/{repo}/issues/{number}/comments --paginate
```

To get `{owner}` and `{repo}`, run:
```bash
gh repo view --json owner,name
```

Spawn a sonnet agent to analyze PR comments:

```
Task tool call:
  subagent_type: general-purpose
  model: sonnet
  description: "Analyze PR review comments"
  prompt: |
    Analyze these GitHub PR review comments and categorize each one.

    ## Local Findings (already being addressed)
    {list of file:line:description from to_fix + to_skip + to_manual — or "none" in --github mode}

    ## PR Review Comments
    {raw JSON of review comments}

    ## PR Issue Comments
    {raw JSON of issue comments}

    ## Instructions
    For each PR comment, categorize it as:
    - **actionable_fix**: Clear code change needed, not already covered by local findings
    - **duplicate**: Same file + similar issue already in local findings
    - **manual**: Requires judgment or discussion, not a simple code fix
    - **skip**: Automated, bot-generated, resolved, or not actionable

    For duplicates, note which local finding covers it.

    ## Output Format
    Return a structured list:

    ---PR-COMMENTS---
    {id} | {file}:{line} | {category} | {description} | {duplicate_of or "none"}
    ---END-PR-COMMENTS---

    Rules:
    - DO NOT apply fixes
    - DO NOT interact with user
    - Include every comment in the output
```

Parse the `---PR-COMMENTS---` block. Collect:
- `pr_to_fix` — actionable_fix items
- `pr_duplicates` — duplicate items
- `pr_manual` — manual items

**Present PR comment summary to user:**
```
PR Review Comments:
- Actionable (new): {N}
- Duplicates (covered by local findings): {N}
- Manual/Discussion: {N}
- Skipped (bot/resolved): {N}

Actionable PR comments:
{#} {file}:{line} — {description}

Manual PR comments:
{#} {file}:{line} — {description}
```

Ask via AskUserQuestion for each actionable PR comment batch:
- "Apply actionable PR fixes?" Options: "All" / "None" / "Let me choose"
- If "Let me choose": present each one and ask Fix / Skip per item.

Collect final `pr_approved_fixes` list.

### Step 5: Apply Fixes

Apply fixes in this order: local `[FIX]` items first, then local `[MANUAL]` items, then approved PR fixes.

#### Grouping Strategy

Group fixes by target file. For each file:
- **1–3 fixes:** Apply directly using Read + Edit tools (bottom-to-top by line number to preserve positions)
- **4+ fixes or complex logic:** Spawn a haiku or sonnet agent per file

#### Direct Application (1–3 fixes per file)

For each fix:
1. Read the file
2. Apply the change using Edit tool
3. Track result: APPLIED or FAILED

Apply from highest line number to lowest within each file to avoid line offset shifts.

#### Agent Application (4+ fixes per file)

```
Task tool call:
  subagent_type: general-purpose
  model: {haiku for simple | sonnet for complex}
  description: "Apply fixes to {file-path}"
  prompt: |
    Apply these fixes to the file below. Apply all fixes.
    Work from the highest line number to the lowest to avoid line offset issues.

    ## File
    {file-path}

    ## Fixes to Apply
    {#1} Line {N}: {description}
    Fix: {suggested fix or custom instructions}

    {#2} Line {N}: {description}
    Fix: {suggested fix or custom instructions}

    ## Instructions
    1. Read the file first
    2. Apply each fix using Edit tool
    3. Apply from highest line to lowest
    4. Do NOT introduce unrelated changes
    5. Report each fix as APPLIED or FAILED with reason

    ## Output Format
    {#} APPLIED | {description}
    {#} FAILED | {description} | {reason}
```

Collect all APPLIED/FAILED results.

#### Apply [MANUAL] Items

For each `[MANUAL]` item with custom instructions:
- Read the file
- Apply the custom instructions using Edit tool
- If instructions are ambiguous, spawn a sonnet agent with the full context

### Step 6: Reply to GitHub PR Comments

For each PR comment that was processed (from `pr_approved_fixes`, `pr_duplicates`, and `pr_manual`):

Post a reply using the GitHub API:

**For review comments (inline):**
```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments/{comment_id}/replies \
  --method POST \
  --field body="{reply text}"
```

**For issue comments (general):**
```bash
gh api repos/{owner}/{repo}/issues/{number}/comments \
  --method POST \
  --field body="{reply text}"
```

Reply templates:
- **Fixed:** `Applied fix: {description}. Will be included in the next push.`
- **Skipped:** `Reviewed — not addressing: {reason if known, else "will handle separately"}`
- **Duplicate (applied):** `Covered by local review findings — fix applied.`
- **Duplicate (skipped):** `Covered by local review findings — marked as skip.`
- **Manual/Discussion:** `Noted. This requires manual review: {description}`

If `gh api` is unavailable or fails, log the failure and continue. Do NOT abort for reply failures.

### Step 7: Verification

After all fixes are applied:

1. **Build:** Use the `/build-project` skill: `Skill tool: skill="build-project", args="target=compile"`
2. **Test:** Use the `/run-tests` skill: `Skill tool: skill="run-tests", args="target=all"`
3. **Lint:** Check for any lint warnings and errors

If build fails:
- Report which file(s) were modified and likely caused the failure
- Ask via AskUserQuestion: "Build failed after applying fixes. What would you like to do?"
  - Options: "Show me the error and I'll fix manually" / "Revert the last fix and retry"
  - If revert: re-read the original file content (from git: `git show HEAD:{file}`) and restore it, then re-run build

### Step 8: Save Summary Report

Write `.5/features/{feature}/review-summary-{YYYYMMDD-HHmmss}.md`.

Use the template structure from `.claude/templates/workflow/REVIEW-SUMMARY.md`. Include:

```markdown
# Code Review Summary

**Reviewed:** {feature} — findings from {findings-filename}
**Timestamp:** {ISO-timestamp}
**User Decisions:** Applied {N} fixes, skipped {N}, {N} manual

## Summary

- **Local Fixes Applied:** {N}
- **Local Fixes Skipped:** {N}
- **Manual Items Applied:** {N}
- **PR Comments Fixed:** {N}
- **PR Comments Skipped:** {N}
- **Build:** {passed/failed}
- **Tests:** {passed/failed}

## Applied Fixes
...

## Skipped Items
...

## Manual Items
...

## PR Comment Replies
...
```

### Step 9: Final Output

Output exactly:

```
Review findings addressed.

Local findings:       {N fixed / N skipped / N manual  — or "skipped (--github mode)"}
PR comments:          {N fixed / N skipped / N replied  — or "none"}

Build: {passed/failed/skipped}
Tests: {passed/failed/skipped}

Summary saved at .5/features/{feature}/review-summary-{timestamp}.md
```

STOP. Do not implement new features. Your job is done.
