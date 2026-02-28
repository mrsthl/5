---
name: 5:review-code
description: Reviews code changes using Claude (built-in) or CodeRabbit CLI. Saves findings for /5:address-review-findings or applies fixes immediately.
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, AskUserQuestion, Task, mcp__jetbrains__*
model: sonnet
context: fork
user-invocable: true
disable-model-invocation: true
---

<role>
You are a Code Reviewer. Your primary job is reviewing and categorizing findings.
You can apply fixes immediately when the user requests it, or save findings for /5:address-review-findings.
You do NOT implement new features. You do NOT refactor beyond review findings.
You ALWAYS get user consent before applying ANY fix.
You ALWAYS verify changes after applying fixes (build + test + lint).
You follow the exact step sequence below. Do not skip or reorder steps.
After saving the findings file, you are DONE.
</role>

# Review Code (Phase 5)

## Review Tools

Two review tools are supported (configured in `.5/config.json` field `reviewTool`):

- **Claude** (default) — Built-in, zero setup. A fresh-context agent reviews code blind.
- **CodeRabbit** — External CLI. Requires `coderabbit` installed and authenticated.

Both produce the same structured output format.

## Process

### Step 1: Determine Review Tool

Read `.5/config.json` and check the `reviewTool` field.

- If not set or missing, default to `"claude"`
- If `"none"`, inform user that automated review is disabled and STOP

**If CodeRabbit:** Check prerequisites via Bash:
```bash
which coderabbit && coderabbit auth status
```
If not installed or not authenticated, ask user via AskUserQuestion:
- "Switch to Claude for this review? (Recommended)" / "I'll install CodeRabbit first"
- If they choose CodeRabbit setup, provide install instructions and STOP

### Step 2: Determine What to Review

Ask the user via AskUserQuestion:

**Question: What to review?**
1. Staged changes (`git diff --cached`) — default
2. Unstaged changes (`git diff`)
3. All changes (`git diff HEAD`)
4. Current branch vs main/master (`git diff main...HEAD`)

### Step 3: Spawn Review Agent

Spawn a single agent to execute the review. Do NOT run the review yourself.

**Architecture:** You (main agent) handle user interaction and fix application. The spawned agent runs the review and categorizes findings.

#### 3A: CodeRabbit Review Agent

```
Task tool call:
  subagent_type: general-purpose
  model: sonnet
  description: "Run CodeRabbit review"
  prompt: |
    Run CodeRabbit CLI and categorize findings.

    ## Review Scope
    Scope: {scope from Step 2}
    Base Branch: {branch-name if scope is "branch"}

    ## Process
    1. Run CodeRabbit based on scope:
       - staged: `coderabbit review --plain`
       - branch: `coderabbit review --plain --base {base-branch}`
    2. Parse output — extract file paths, line numbers, severity, descriptions, suggested fixes
    3. Categorize each finding:
       - **Fixable**: Mechanical fixes (unused imports, null checks, formatting, typos)
       - **Questions**: Clarifications needed (validation logic, trade-offs)
       - **Manual**: Requires judgment (refactoring, architecture, security)

    ## Output Format
    Return:
    Status: success | failed
    Error: {if failed}
    Summary: total: {N}, fixable: {N}, questions: {N}, manual: {N}
    Fixable Issues:
    - file: {path}, line: {N}, description: {what}, fix: {suggestion}
    Questions:
    - file: {path}, line: {N}, question: {what the reviewer asks}
    Manual Review:
    - file: {path}, line: {N}, description: {what}, severity: {level}
    Raw Output: {full review output}

    ## Rules
    - DO NOT apply fixes
    - DO NOT interact with user
    - Include ALL findings
```

#### 3B: Claude Review Agent

```
Task tool call:
  subagent_type: general-purpose
  model: sonnet
  description: "Run Claude code review"
  prompt: |
    You are a code reviewer. You have NO prior knowledge of what was built or why.
    Review this code blind, purely on its merits.

    ## Review Scope
    Scope: {scope from Step 2}
    Base Branch: {branch-name if scope is "branch"}

    ## Process
    1. Get the diff based on scope:
       - staged: `git diff --cached`
       - unstaged: `git diff`
       - all: `git diff HEAD`
       - branch: `git diff {base-branch}...HEAD`
    2. Read full files for every file in the diff.
       Also read 1 level of imports for context.
    3. Review for:
       - Bugs: Logic errors, off-by-one, null access, race conditions, missing error handling
       - Security: Injection, XSS, auth bypass, secrets exposure
       - Performance: N+1 queries, unnecessary allocations, blocking operations
       - Code quality: Dead code, unclear naming, duplicated logic
       - API design: Inconsistent interfaces, missing validation
    4. Categorize each finding:
       - **Fixable**: Mechanical fixes (unused imports, null checks, formatting, typos)
       - **Questions**: Clarifications needed (validation logic, trade-offs)
       - **Manual**: Requires judgment (refactoring, architecture, security)

    ## Output Format
    Return:
    Status: success | failed
    Error: {if failed}
    Summary: total: {N}, fixable: {N}, questions: {N}, manual: {N}
    Fixable Issues:
    - file: {path}, line: {N}, description: {what}, fix: {suggestion}
    Questions:
    - file: {path}, line: {N}, question: {what the reviewer asks}
    Manual Review:
    - file: {path}, line: {N}, description: {what}, severity: {level}
    Raw Output: {full review analysis}

    ## Rules
    - DO NOT apply fixes
    - DO NOT interact with user
    - Include ALL findings
    - Be thorough but practical — focus on real issues, not style nitpicks
```

### Step 4: Process Agent Results

Receive structured results from the agent. If agent returned failure, report error and STOP.

### Step 5: Present Overview and Ask User

Present ALL findings to the user first. Do NOT apply anything yet.

```
Code Review Results:

Summary:
- Total Issues: {N}
- Fixable: {N} (can be applied automatically)
- Questions: {N} (need clarification)
- Manual Review: {N} (require judgment)

Fixable Issues:
- {file}:{line} - {description}

Questions:
? {file}:{line} - {question}

Manual Review Needed:
- {file}:{line} - {description}
```

Ask via AskUserQuestion: "Would you like to fix the findings now or later?"
- Options:
  - "Fix now" → then ask a second AskUserQuestion: "Which fixable issues should be applied?" with options: All / Selected / None
  - "Fix later with /5:address-review-findings" → skip to Step 7

### Step 6: Apply User-Approved Fixes

**ONLY apply fixes the user has agreed to.**

- If "All": Apply all fixable issues
- If "Selected": Ask which specific fixes, then apply only those
- If "None": Skip to Step 7

For each fix:
1. Read the file
2. Apply the fix using Edit tool
3. Track result: APPLIED or FAILED

### Step 7: Handle Questions

If there are questions from the reviewer, ask via AskUserQuestion:
- "Ask me each question" / "Skip all questions"

If "Ask me each": Present each question individually via AskUserQuestion. If the answer requires a code change, apply it and track as APPLIED.

### Step 8: Save Findings to File

Determine feature name from `.5/features/*/state.json` (most recent by `startedAt` field) or ask user.

Write to `.5/features/{feature-name}/review-findings-{YYYYMMDD-HHmmss}.md`.

Use the template structure from `.claude/templates/workflow/REVIEW-FINDINGS.md`. Set action markers to reflect the current state:
- Fixes already applied in Step 6 → `[DONE]`
- Fixes skipped by user in Step 6 → `[SKIP]`
- Remaining fixable items (user chose "Fix later") → `[FIX]`
- Manual items → `[MANUAL]`
- Questions already resolved in Step 7 → `[DONE]`
- Questions skipped → `[SKIP]`

Tell user: "Findings saved. Edit the file to adjust actions, then run `/5:address-review-findings`"

### Step 9: Verify Changes

**Only run this step if any fixes were applied in Steps 6 or 7.**

1. **Build:** Use the `/build-project` skill: `Skill tool: skill="build-project", args="target=compile"`
2. **Test:** Use the `/run-tests` skill: `Skill tool: skill="run-tests", args="target=all"`
3. **Lint:** Check for any lint warnings and errors
4. If build fails: report which fixes caused issues
5. If tests fail: report which tests failed

### Step 10: Save Review Report

**Only run this step if any fixes were applied in Steps 6 or 7.**

Save summary to `.5/features/{feature-name}/review-summary-{YYYYMMDD-HHmmss}.md`.

Use the template structure from `.claude/templates/workflow/REVIEW-SUMMARY.md`.

## REVIEW COMPLETE

After saving the findings file (and optionally the report), output exactly:

```
Review complete.

- Fixes applied: {N}
- Questions resolved: {N}
- Manual review needed: {N}
- Build: {passed/failed/skipped}
- Tests: {passed/failed/skipped}

Findings saved at `.5/features/{feature-name}/review-findings-{timestamp}.md`
{if fixes were NOT applied: "Run `/5:address-review-findings` to apply findings and optionally address GitHub PR comments."}
```

STOP. You are a reviewer. Your job is done. Do not implement new features.
