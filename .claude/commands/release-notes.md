---
name: release-notes
description: Generate release notes from commits since the last release
allowed-tools: Bash, Read, Write, Glob, Grep, AskUserQuestion
context: fork
user-invocable: true
---

# Generate Release Notes

## Step 1: Determine Version Bump

Ask the user which type of version bump this release is:

- **Major** (breaking changes)
- **Minor** (new features, backward-compatible)
- **Patch** (bug fixes, small improvements)

## Step 2: Calculate New Version

Read `package.json` in the project root to get the current version (read-only — do NOT modify package.json). Apply the version bump:
- **Major**: increment first number, reset others to 0
- **Minor**: increment second number, reset patch to 0
- **Patch**: increment third number

## Step 3: Gather Changes

Run the following git commands to collect changes since the last release:

1. Find the latest git tag: `git tag --sort=-v:refname | head -1`
2. Get all commits since that tag: `git log {tag}..HEAD --format="%H %s"` (if no tag exists, use `git log --format="%H %s"`)
3. Get the detailed diff stats: `git diff {tag}..HEAD --stat`

## Step 4: Analyze and Categorize

Review each commit message and the associated changes. Categorize them:

- **What's New** — new features, commands, hooks, integrations
- **Improvements** — enhancements to existing functionality
- **Bug Fixes** — corrections to broken behavior
- **Breaking Changes** — anything that requires user action after upgrading

For each category, write concise bullet points describing the user-facing impact. Focus on WHAT changed and WHY, not implementation details.

## Step 5: Determine Affected Files

From the git diff, list the key files that were added, modified, or removed. Use the format:
- `path/to/file` (new|modified|removed)

## Step 6: Write Release Notes

Read the existing `RELEASE_NOTES.md` file. Prepend the new release entry directly after the `# Release Notes` heading, before all existing entries.

Use this format (matching the existing style in RELEASE_NOTES.md):

```markdown
## v{new-version}

**Release Date:** {YYYY-MM-DD}

### {Summary Title}

{Brief 1-2 sentence overview of the release.}

**{Category Name}**
- Bullet point describing each change
- Focus on user-facing impact

**Affected files:**
- `path/to/file` (new|modified|removed)

---
```

Rules:
- Today's date is used for the release date
- Match the tone and detail level of existing entries in RELEASE_NOTES.md
- Only include categories that have entries (skip empty categories)
- Keep descriptions concise — 1-2 lines per bullet
- The `---` separator goes after each release entry

Write the updated content back to `RELEASE_NOTES.md`.

**IMPORTANT: `RELEASE_NOTES.md` is the ONLY file you may write to. Do NOT modify `package.json` or any other file.**

## Step 7: Confirm

Show the user the new release notes entry and confirm it looks correct. Let them know:
- RELEASE_NOTES.md has been updated
- They should review and commit the changes

## Step 8: Commit

Commit the changes to RELEASE_NOTES.md with a message like "Update Release Notes {new-version}".
