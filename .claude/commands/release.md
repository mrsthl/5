---
name: release
description: Create a GitHub release from the latest release notes
allowed-tools: Bash, Read, Grep, AskUserQuestion
context: fork
user-invocable: true
---

# Create GitHub Release

## Step 1: Get Current Version

Read `package.json` in the project root and extract the `version` field. This is the version to release (e.g., `1.5.2`). Tags and releases use this version **without** a `v` prefix.

## Step 2: Check Release Notes Exist

Read `RELEASE_NOTES.md` and verify that an entry exists for `v{version}` (e.g., `## v1.5.2`). Extract the full release notes section for this version — everything from the `## v{version}` heading up to (but not including) the next `## v` heading or `---` separator.

If no entry exists for the current version, tell the user:

> No release notes found for v{version} in RELEASE_NOTES.md. Please run `/release-notes` first to generate them.

Then **stop**. Do not proceed.

## Step 3: Ensure Clean Git State

Run `git status --porcelain`. If there are uncommitted changes, tell the user:

> There are uncommitted changes. Please commit or stash them before releasing.

Then **stop**.

## Step 4: Push to Remote

Run `git status -sb` to check if the branch is ahead of remote. If there are unpushed commits, run `git push` to sync with the remote.

## Step 5: Check Tag Doesn't Already Exist

Run `git tag -l "{version}"`. If the tag already exists, tell the user:

> Tag {version} already exists. The release may have already been created.

Then **stop**.

## Step 6: Confirm with User

Show the user a summary:

- **Version:** {version}
- **Tag:** {version} (no `v` prefix)
- **Release notes preview:** (show the extracted release notes from Step 2)

Ask: "Everything look good? Should I create the GitHub release?"

Wait for user confirmation before proceeding.

## Step 7: Create GitHub Release

Use `gh` to create the release. Pass the release notes body via a temp file to avoid shell escaping issues:

1. Write the extracted release notes to a temp file
2. Run: `gh release create {version} --title "{version}" --notes-file {temp-file}`
3. Remove the temp file

If `gh` is not installed or not authenticated, inform the user and stop.

## Step 8: Confirm Success

Show the user the release URL returned by `gh release create` and confirm the release was created successfully.
