---
name: review-style
description: Review changes against coding and documentation standards (repo standards, user-level rules and a list of style skills), then optionally fix the findings. Use when the user wants a style, standards or conventions review of a branch, a commit range or uncommitted work.
---

# Review style

Review a change against three kinds of standards:

- **Repo standards**: whatever the repository documents about how code is written.
- **User-level rules**: the rules the developer keeps outside the repository, in their home folder.
- **Styles**: the style skills listed below. They apply in every repository.

The order of precedence is repo standards, then user-level rules, then styles.
Where a repo standard endorses something a user-level rule or a style would flag, that finding is **suppressed**.
Where a user-level rule endorses something a style would flag, the style finding is suppressed too.

## Styles

Each path is relative to this skill's base directory. Add a style by adding one line.

- `../fowler-code-smells/SKILL.md`
- `../cognitive-load/SKILL.md`
- `../documentation-style/SKILL.md`. It applies only to code comments, doc comments and Markdown files.
- `../baseline-conventions/SKILL.md`

## Process

### 1. Pin the scope

The caller's words pick one of these modes:

| Mode | Example | Diff |
|------|---------|------|
| Since fixed point plus uncommitted (default) | `/review-style master` | `git diff $(git merge-base <fixed-point> HEAD)`, plus untracked files |
| Committed only | `/review-style master committed only` | `git diff <fixed-point>...HEAD` |
| Uncommitted only | `/review-style uncommitted` | `git diff HEAD`, plus untracked files |
| Staged only | `/review-style staged` | `git diff --cached` |
| Unstaged only | `/review-style unstaged` | `git diff`, plus untracked files |

When the words don't clearly name a mode, ask. When a mode needs a fixed point and none is given, ask for it.
Offer the merge-base with the default branch (`master` or `main`) as the suggested answer.

When the caller names files, limit the diff to them, for example `git diff <fixed-point> -- <files>`. Other
changed files stay out of the review and out of the fixes.

Untracked files are those from `git ls-files --others --exclude-standard`. In the modes whose diff says "plus
untracked files", add each one to the diff as a new file whose every line is added. The other modes leave them out.

Confirm the fixed point resolves with `git rev-parse`. Stop when the diff is empty. Write the diff to one temp
file, in the scratchpad when there is one. Also note `git log <fixed-point>..HEAD --oneline` when the mode
includes commits.

The step is done when one diff file exists and every reviewer will read that same file.

### 2. Collect the repo standards

Search the repository for every file that documents how code is written:

- `CODING_STANDARDS.md`, `CONTRIBUTING.md`, `CODESTYLE.md`, `STYLEGUIDE.md`, and docs about style or conventions.
  Look at the repository root, `.github/` and `docs/`.
- `CLAUDE.md` and `AGENTS.md` at every level, plus every file they link to about code, tests or docs.
  The block between `<!-- foifi:start` and `<!-- foifi:end -->` holds workflow rules, not repository
  standards; count only the files it links under "Standards". In a legacy file that says a workflow generated it
  from a template, count only the parts it names as repository standards.
  A nested `CLAUDE.md` or `AGENTS.md` applies to the changed files below it.
- Every file in `.claude/rules/*.md`.
  A rule file applies to a changed file when the file's path matches one of its `paths:` globs.
  The path is relative to the repo root.
  A rule file without `paths:` applies to every changed file.

Skip process instructions, such as how to build, commit, run commands or talk to the developer.
They cannot be checked against a diff.

Skip linter and formatter configs. Tooling enforces them already.

### 3. Collect the user-level rules

Read these files from the developer's home folder:

- On Claude Code: `~/.claude/CLAUDE.md` and every file in `~/.claude/rules/`.
- On Codex: `~/.codex/AGENTS.md`.

A rule file applies to a changed file when the file's path matches one of its `paths:` globs.
The path is relative to the repo root.
A rule file without `paths:` applies to every changed file.

A missing file or folder is fine. Skip it and go on.

Skip process instructions, as for repo standards.

### 4. Resolve the styles

Turn each path in [Styles](#styles) into an absolute path from this skill's base directory. Reviewers don't
know that directory, so they only get absolute paths.

### 5. Review in parallel

Start both reviewers in one message, as foreground sub-agents:

- One **repo reviewer** for all repo standards and user-level rules together, when step 2 or 3 found any.
- One **style reviewer** for all styles together. Two reviewers keep the token cost flat as styles are added.

Each prompt carries:

- The diff file path and the commit list.
- Its standards: the repo standard files and the user-level rule files, or the absolute paths of every
  style's `SKILL.md`. The style reviewer reads each `SKILL.md` and every file it links to, and applies each
  style only where it says it applies.
- For the style reviewer, the repo standard files and the user-level rule files too, so they can suppress
  overridden findings.
- The **context rule**: before judging a hunk, read its whole enclosing method and type. Follow the calls,
  types and parents it touches whenever a rule needs them. Search the repository when a rule asks about
  duplication.
- The **scope rule**: anchor every finding on a changed line. Flag a problem in surrounding code only when the
  change creates or worsens it, such as adding a fourth level of nesting. Leave problems that already existed
  alone. Lift this rule only when the caller asked for it.
- The brief:

  > Apply every rule of your standard to every changed hunk. Report each finding as:
  > `path:line`, a title of a few words, the quoted code, the rule (standard file plus rule name), the rule
  > sentence quoted verbatim, hard or judgement, and a suggested fix in a few words. Every finding gets a
  > suggested fix. Use one sentence when a few words can't carry it.
  >
  > Severity comes from the wording of the rule. A repo or user-level rule written as a statement or a command is hard.
  > A repo or user-level rule worded with "prefer", "should" or "usually", or that calls itself a guideline,
  > is a judgement call. A style finding is always a judgement call. Skip anything tooling enforces.
  >
  > Style reviewer only: when a repo standard or a user-level rule endorses what your style would flag,
  > report it under **Suppressed**, citing the rule that overrides it.
  >
  > Repo reviewer only: when a repo standard endorses what a user-level rule would flag, report it under
  > **Suppressed**, citing the repo source.
  >
  > Quote user-level rules verbatim too.

### 6. Merge and report

- Merge findings that flag the same line for the same reason. Cite every rule involved.
- Drop a finding that has no verbatim quote. Drop one whose quote does not state what the finding claims.
  List each dropped finding in a short **Dropped** section with the reason.
- Number the findings `F1`, `F2`, … and group them by file.
- Write each finding in this shape. ⛔️ marks a repo or user-level rule worded as a statement or a command. ⚠️ marks a judgement call.
  The title names the problem in a few words. The quote is the rule sentence, verbatim.
  ```
  - <icon> **<ID> <title>** _(<lines>)_
    <what is wrong and why>
    > "<rule sentence>"
    → <fix> _(<standards>)_
  ```
  For example:
  ```
  - ⛔️ **F1 Javadoc repeats the accessor** _(:71)_
    `@return the entity links.` adds nothing the method name doesn't say.
    > "Do not repeat the method name in a Javadoc line."
    → Drop the line. _(Repo comment rules, Doc)_
  - ⚠️ **F7 Plural name on an invariant checker** _(:12)_
    The plural name suggests a collection, but the class checks an invariant.
    > "Name a class after what it does."
    → Rename to `DocumentEntityLinkInvariantHelper`. _(Cog)_
  ```
- Every finding shows its fix. When a reviewer sent none, write one.
- List suppressed findings in a separate **Suppressed** section, each with its overriding repo rule or user-level rule.
- End with one line: findings per standard, hard violations count, and the worst issue.

### 7. Fix

When the caller asked for a report only, stop after step 6. When the caller asked for fixes up front, fix every
finding. Otherwise, and only when there are findings, ask: fix all, fix hard violations only, fix the IDs I list,
or fix nothing.

Start one **fixer** sub-agent with:

- The selected findings, verbatim, with their rule references.
- The absolute paths of all standards, so it can look a rule up.
- The brief:

  > Fix each finding in the working tree. Then run the repository's documented cheap check, such as compile
  > and format, the way its `CLAUDE.md` or `CONTRIBUTING.md` says. Leave the changes uncommitted. Report
  > each ID as fixed or skipped, with the reason for every skip.

Suppressed findings are never fixed. Relay the fixer's report.
