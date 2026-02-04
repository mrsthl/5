---
name: 5:review-code
description: Reviews code changes using Claude (built-in) or CodeRabbit CLI. Handles user interaction and fix application in main context.
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, AskUserQuestion, Task, mcp__jetbrains__*
model: sonnet
context: fork
user-invocable: true
---

# Review Code (Phase 5)

## Prerequisites Check

**CRITICAL: Check for configuration before proceeding**

```bash
if [ ! -f ".claude/.5/config.json" ]; then
  echo "❌ Configuration not found"
  echo ""
  echo "Please run /5:configure first to set up your project."
  echo ""
  echo "The configure command will:"
  echo "  • Detect your project type and build commands"
  echo "  • Set up ticket tracking conventions"
  echo "  • Generate documentation (CLAUDE.md)"
  echo "  • Create project-specific skills"
  exit 1
fi
```

**If config doesn't exist, STOP IMMEDIATELY. Do not proceed with the workflow.**

## Overview

This command automates code review using a configurable review tool. The review tool is set in `.claude/.5/config.json` (`reviewTool` field). Two tools are supported:

- **Claude** (default) — Built-in, zero setup. A fresh-context agent reviews code blind with no knowledge of what was built.
- **CodeRabbit** — External CLI tool. Requires installation and authentication.

Both tools produce the same structured output format, so all downstream steps (presenting results, applying fixes, saving reports) work identically regardless of which tool is used.

**Workflow A: Interactive Review** (default)
1. Checks prerequisites in main context
2. Asks user what to review
3. Delegates review execution and output parsing to a spawned agent
4. Presents structured results and asks user for decisions
5. Applies fixes based on user approval
6. Reports results

**Workflow B: File-Based Annotation** (user preference)
1. Runs review and saves findings to `.5/features/{feature-name}/review-{timestamp}-findings.md`
2. User edits the file to mark which findings to fix ([FIX], [SKIP], [MANUAL])
3. User runs `/review-code apply` to read annotations and apply marked fixes

**Architecture:** `Command -> Agent -> Review Tool`
- This command stays in the main context (user interaction, fix application)
- Spawned agent runs the review and categorizes findings (forked context)

## ⚠️ Scope Constraint

**THIS COMMAND REVIEWS CODE AND APPLIES USER-APPROVED FIXES ONLY.**

✅ Read config to determine review tool
✅ Check prerequisites for the selected tool
✅ Ask user what to review
✅ Spawn review agent (Claude or CodeRabbit)
✅ Present findings overview to user
✅ Ask user which fixes to apply
✅ Apply ONLY user-approved fixes
✅ Verify changes (compile and test)
✅ Save review report

❌ Run the review tool directly (agent does this)
❌ Parse review output directly (agent does this)
❌ Apply fixes without user approval
❌ Skip the overview step — user must see all findings first
❌ Skip verification — always compile and test after fixes

**ALWAYS GET USER CONSENT BEFORE APPLYING ANY FIXES.**

## Prerequisites

**Claude reviewer (default):**
- Git repository with changes to review
- No additional setup needed

**CodeRabbit reviewer:**
- CodeRabbit CLI installed (`coderabbit` command available)
- User logged in to CodeRabbit (`coderabbit auth status` shows authenticated)
- Git repository with changes to review

## Review Process

### Step 1: Determine Review Tool and Check Prerequisites

**1a. Read config:**
```bash
# Read review tool preference
cat .claude/.5/config.json
# Look for "reviewTool" field — values: "claude", "coderabbit", or "none"
```

If no config exists or `reviewTool` is not set, default to `"claude"`.

If `reviewTool` is `"none"`, inform user that automated review is disabled and exit.

**1b. If review tool is CodeRabbit, check prerequisites:**

```bash
# Check if coderabbit command exists
which coderabbit

# Check authentication status
coderabbit auth status
```

**If CodeRabbit not installed or not logged in:**
- Inform user: "CodeRabbit CLI is not installed or you're not logged in."
- Provide installation guidance:
  - macOS: `brew install --cask coderabbit`
  - Other: `curl -fsSL https://cli.coderabbit.ai/install.sh | sh`
  - Then: `coderabbit auth login`
- Ask user (via AskUserQuestion): "Would you like to switch to Claude (built-in) for this review instead?"
  - Options: "Yes, use Claude for this review (Recommended)", "No, I'll install CodeRabbit first"
  - If yes: proceed with Claude as the review tool for this session
  - If no: exit without reviewing

**1c. If review tool is Claude:** no prerequisites to check — proceed directly.

### Step 2: Check for Special Modes

**Check if user invoked with `apply` argument:**
```
/review-code apply
```

If `apply` mode:
- Skip to Step 11 (Apply Annotated Findings)
- Do NOT run a new review

**Otherwise, proceed with new review:**

### Step 3: Determine What to Review

Ask the user what to review and how to present results using AskUserQuestion:

**Question 1: What to review?**
1. **Staged changes** (default) - Review `git diff --cached`
2. **Unstaged changes** - Review `git diff`
3. **All changes** - Review both staged and unstaged
4. **Current branch** - Review all commits on current branch vs main/master
5. **Specific files** - User specifies file paths

**Question 2: How to review?**
1. **Interactive** (default) - Show findings and apply fixes immediately
2. **Save to file** - Save findings to `.5/{feature-name}/` for later annotation

### Step 4: Spawn Review Agent

Branch based on the review tool determined in Step 1.

#### Step 4A: CodeRabbit Review Agent

If the review tool is **CodeRabbit**, spawn:

```
Task tool call:
  subagent_type: general-purpose
  model: sonnet
  description: "Run CodeRabbit review"
  prompt: |
    Run CodeRabbit CLI and categorize findings.

    ## Review Scope
    Scope: {scope from Step 3}
    Base Branch: {branch-name if scope is "branch"}
    Files: [{file-paths if scope is "files"}]

    ## Process

    1. **Run CodeRabbit** based on scope:
       - staged: `coderabbit review --plain`
       - files: `coderabbit review --plain {file1} {file2}`
       - branch: `coderabbit review --plain --base {base-branch}`

    2. **Parse output** - Extract file paths, line numbers, severity, descriptions, suggested fixes

    3. **Categorize each finding:**
       - **Fixable**: Mechanical fixes (unused imports, null checks, formatting, typos)
       - **Questions**: Clarifications needed (validation logic, trade-offs)
       - **Manual**: Requires judgment (refactoring, architecture, security)

    ## Output Format
    Return:
    ```
    Status: success | failed
    Error: {if failed}

    Summary:
      total: {N}, fixable: {N}, questions: {N}, manual: {N}

    Fixable Issues:
    - file: {path}, line: {N}, description: {what}, fix: {suggestion}

    Questions:
    - file: {path}, line: {N}, question: {what the reviewer asks}

    Manual Review:
    - file: {path}, line: {N}, description: {what}, severity: {level}

    Raw Output:
    {full review output}
    ```

    ## Rules
    - DO NOT apply fixes (parent handles with user consent)
    - DO NOT interact with user
    - Include ALL findings - let parent decide what to apply
```

#### Step 4B: Claude Review Agent

If the review tool is **Claude**, spawn:

```
Task tool call:
  subagent_type: general-purpose
  model: sonnet
  description: "Run Claude code review"
  prompt: |
    You are a code reviewer. You have NO prior knowledge of what was built, why it was built,
    or what the implementation plan was. You are reviewing this code blind, purely on its merits.

    ## Review Scope
    Scope: {scope from Step 3}
    Base Branch: {branch-name if scope is "branch"}
    Files: [{file-paths if scope is "files"}]

    ## Process

    1. **Get the diff** based on scope:
       - staged: run `git diff --cached`
       - unstaged: run `git diff`
       - all: run `git diff HEAD`
       - branch: run `git diff {base-branch}...HEAD`
       - files: run `git diff -- {file1} {file2}` (or `git diff --cached -- {file1} {file2}` if staged)

    2. **Read full files** — For every file that appears in the diff, read the complete file content.
       Also read 1 level of imports (files directly imported by changed files) to understand context.

    3. **Review for:**
       - **Bugs**: Logic errors, off-by-one, null/undefined access, race conditions, missing error handling
       - **Security**: Injection, XSS, auth bypass, secrets exposure, insecure defaults
       - **Performance**: N+1 queries, unnecessary allocations, missing pagination, blocking operations
       - **Code quality**: Dead code, unclear naming, duplicated logic, overly complex conditionals
       - **API design**: Inconsistent interfaces, missing validation, breaking changes, poor error responses

    4. **Categorize each finding:**
       - **Fixable**: Mechanical fixes (unused imports, null checks, formatting, typos, dead code removal)
       - **Questions**: Clarifications needed (validation logic, trade-offs, ambiguous intent)
       - **Manual**: Requires judgment (refactoring, architecture decisions, security implications)

    ## Output Format
    Return:
    ```
    Status: success | failed
    Error: {if failed}

    Summary:
      total: {N}, fixable: {N}, questions: {N}, manual: {N}

    Fixable Issues:
    - file: {path}, line: {N}, description: {what}, fix: {suggestion}

    Questions:
    - file: {path}, line: {N}, question: {what the reviewer asks}

    Manual Review:
    - file: {path}, line: {N}, description: {what}, severity: {level}

    Raw Output:
    {full review analysis}
    ```

    ## Rules
    - DO NOT apply fixes (parent handles with user consent)
    - DO NOT interact with user
    - Include ALL findings - let parent decide what to apply
    - Be thorough but practical — focus on real issues, not style nitpicks
    - You have NO context about the feature intent — review what the code DOES, not what it was supposed to do
```

### Step 5: Process Agent Results

Receive structured results from the agent:
- Total issues count
- Categorized findings: fixable, questions, manual
- Raw review output

If agent returned failure (review failed), report error and exit.

### Step 6: Branch Based on Review Mode

**If user selected "Save to file":**
- Skip to Step 10 (Save Findings to File)

**If user selected "Interactive":**
- Continue to Step 7

### Step 7: Provide Overview and Ask User

Present a concise overview of all findings:

```
Code Review Results:

Summary:
- Total Issues: {N}
- Fixable: {N} (can be applied automatically)
- Questions: {N} (need clarification)
- Manual Review: {N} (require judgment)

Fixable Issues:
- ProductFactory.ts:45 - Remove unused import
- OrderValidator.ts:23 - Add null check for parameter

Questions:
? ProductFactory.ts:67 - Should validation check for empty strings?

Manual Review Needed:
- ProductFactory.ts:120 - Consider extracting method (complexity: 15)
```

**Use AskUserQuestion to ask:**
- Which fixable issues should be applied? (options: All, Selected, None)

### Step 8: Apply Fixes Based on User Agreement

Only apply fixes that the user has agreed to:

**If user chose "All fixable issues":**
- Apply all fixable issues automatically
- Track applied fixes

**If user chose "Selected":**
- Ask which specific fixes to apply
- Apply only selected fixes

**If user chose "None":**
- Skip to reporting

**For each fix to apply:**
1. Read the file
2. Apply the suggested fix using Edit tool
3. Format using IDE (if available) `reformat_file` if available
4. Track applied fixes

### Step 9: Handle Questions Based on User Preference

If there are questions from the reviewer, use AskUserQuestion:

**Options:**
1. "Ask me for each" - Present each question individually
2. "Skip all" - Add to manual review list

**If "Ask me for each":**
- For each question, use AskUserQuestion to get answer
- If answer requires code change, apply it
- Track as user-resolved

### Step 9b: Verify Changes

After applying fixes:

1. **Compile:**
   Use the `/build-project` skill to compile:
   ```
   Skill tool call:
     skill: "build-project"
     args: "target=compile"
   ```

2. **Check for problems:**
   Use IDE (if available) `get_file_problems` on modified files

3. **Run tests:**
   Use the `/run-tests` skill to run tests:
   ```
   Skill tool call:
     skill: "run-tests"
     args: "target=all"
   ```

4. **Report results:**
   - If compilation fails: Revert problematic fixes, report to user
   - If tests fail: Report which tests failed, suggest manual review
   - If all pass: Confirm fixes are successful

### Step 9c: Generate Review Summary

Create comprehensive summary report using the template structure.

**Template Reference:** Use the structure from `.claude/templates/workflow/REVIEW-SUMMARY.md`

The template contains placeholders for:
- **Header:** Reviewed scope, timestamp, user decisions summary
- **Summary:** Counts for total issues, applied fixes, user-resolved questions, manual review, skipped
- **Applied Fixes:** List of fixes applied with user approval (file:line - description)
- **User-Resolved Questions:** Questions answered by user with their decisions
- **Manual Review Needed:** Issues requiring human judgment
- **Skipped Issues:** Fixes user chose not to apply
- **Files Modified:** Summary of modified files with fix counts

### Step 10: Save Findings to File (File-Based Mode)

When user selects "Save to file", create a structured findings file that allows user annotation.

**Determine feature name:**
- Check most recent state file in `.5/features/*/state.json` to find current feature
- Or ask user which feature they're reviewing
- Use feature name for organizing review files

**Create directory if needed:**
```bash
mkdir -p .5/features/{feature-name}
```

**Generate timestamp:**
```
{timestamp} = Custom timestamp format: YYYYMMDD-HHmmss
Example: 20260128-103045
```

**File path:**
```
.5/features/{feature-name}/review-{timestamp}-findings.md
```

**File format:**

**Template Reference:** Use the structure from `.claude/templates/workflow/REVIEW-FINDINGS.md`

The template contains:
- **Header:** Generated timestamp, scope, total findings count
- **How to Use This File:** Instructions for user annotation with [FIX], [SKIP], [MANUAL] actions
- **Finding sections:** Repeated for each finding with:
  - File path, line number, category, severity
  - Description of what the reviewer found
  - Suggested fix
  - Original reviewer message
  - Action placeholder (default [FIX])
  - Custom instructions field for [MANUAL] fixes
- **Summary:** Counts of total, fixable, questions, manual review
- **Next Steps:** Instructions to edit and run `/review-code apply`

**After saving file:**
- Inform user: "Findings saved to .5/features/{feature-name}/review-{timestamp}-findings.md"
- Provide instructions: "Edit the file to mark findings, then run: /review-code apply"
- Skip remaining steps (don't apply fixes interactively)

### Step 11: Apply Annotated Findings

When user runs `/review-code apply`, read the most recent findings file and apply marked fixes.

**Determine feature name:**
- Check most recent state file in `.5/features/*/state.json` to find current feature
- Or ask user which feature they're reviewing

**Find the most recent findings file:**
```bash
# Find most recent review findings file in the feature folder
ls -t .5/features/{feature-name}/review-*-findings.md | head -1
```

**If no findings file exists:**
- Inform user: "No findings file found. Run /review-code first to generate findings."
- Exit

**Read the findings file:**
- Parse each finding section
- Extract action marker: [FIX], [SKIP], or [MANUAL]
- For [MANUAL], also extract custom instructions

**Apply fixes:**

For each finding marked `[FIX]`:
1. Read the file specified in the finding
2. Apply the suggested fix using Edit tool
3. Track applied fix

For each finding marked `[MANUAL]` with custom instructions:
1. Read the file
2. Use the custom instructions to determine what to change
3. Apply the change using Edit tool
4. Track applied fix

For findings marked `[SKIP]`:
- Skip, don't apply

**After applying all marked fixes:**
- Continue to Step 9b (Verify Changes)
- Then Step 12 (Update Findings File)

### Step 12: Update Findings File After Apply

After applying fixes from an annotated file, update the findings file with results:

**Append to the end of the findings file:**

```markdown

---

## Application Results

**Applied:** {timestamp in ISO 8601 format, e.g., 2026-01-28T10:30:45Z}
**Fixes Applied:** {N}
**Custom Fixes:** {N}
**Skipped:** {N}

### Applied Fixes

- Finding #1 - {file}:{line} - {description} - ✓ Applied
- Finding #5 - {file}:{line} - {description} - ✓ Applied

### Custom Fixes

- Finding #3 - {file}:{line} - {description} - ✓ Applied with custom instructions

### Skipped

- Finding #2 - {file}:{line} - {description} - Skipped by user
- Finding #4 - {file}:{line} - {description} - Skipped by user

### Verification

**Compilation:** {success|failed}
**Tests:** {passed|failed|skipped}

{any error messages if failed}
```

**Inform user:**
- Show summary of applied fixes
- Reference the updated findings file
- Indicate if compilation/tests passed

### Step 13: Save Review Report (Interactive Mode)

For interactive mode only, save the review summary to:
```
.5/features/{feature-name}/review-{timestamp}.md
```

## Error Handling

### CodeRabbit Not Installed
```
CodeRabbit CLI is not installed.

To install:
- macOS: brew install --cask coderabbit
- Other: curl -fsSL https://cli.coderabbit.ai/install.sh | sh
- Then: coderabbit auth login

Or switch to the built-in Claude reviewer by running /5:configure
and selecting "Claude" as your review tool.
```

### CodeRabbit User Not Logged In
```
You're not logged in to CodeRabbit.

To log in:
1. Run: coderabbit auth login
2. Follow authentication prompts
3. Then re-run: /5:review-code
```

### Claude Review Agent Failed
```
Claude code review failed.

Error: {error from agent}

Troubleshooting:
1. Check if git repository is valid
2. Ensure there are changes to review (run git status)
3. Try again — transient failures can occur
```

### CodeRabbit Agent Failed
```
CodeRabbit review failed.

Error: {error from agent}

Troubleshooting:
1. Check if you have internet connection
2. Verify CodeRabbit CLI is up to date: coderabbit update
3. Check if git repository is valid
4. Try running manually: coderabbit review --plain
```

### Compilation Failed After Fixes
```
Compilation failed after applying fixes.

Reverting problematic fixes:
- ProductFactory.ts:45 (reverted)

Error:
{compilation error}

Action: Please review the suggested fix manually.
```

## Integration with Workflow

**When to use:**
- Before committing changes
- After completing a feature (before PR)
- When fixing bugs (to catch additional issues)

**Workflow integration:**
```
1. Make code changes
2. Stage changes: git add .
3. Run `/clear` to reset context
4. Run review: /5:review-code
5. Address manual issues if needed
6. Commit: git commit -m "message"
7. For next feature: Run `/clear` before starting /5:plan-feature
```

## Configuration

**Directory:** `.5/features/{feature-name}/` (organized by feature)

**File Types:**
- `review-{timestamp}-findings.md` - Annotatable findings (file-based mode)
- `review-{timestamp}.md` - Review summary reports (interactive mode)

**Timestamp Format:** Custom format `YYYYMMDD-HHmmss` (e.g., `20260128-103045`)

**Feature Detection:** Review files are organized by feature. The command will:
- Check most recent state file in `.5/features/*/state.json` to find current feature
- Or ask user which feature they're reviewing if unclear

## Related Documentation

- [Workflow Guide](../docs/workflow-guide.md)
