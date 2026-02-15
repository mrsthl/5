---
name: release
description: Create a GitHub release from the latest release notes
allowed-tools: Bash, Read, Grep, AskUserQuestion
context: fork
user-invocable: true
---

# Create GitHub Release

## Step 1: Get Release Version from Release Notes

Read `RELEASE_NOTES.md` and find the first `## v{X.Y.Z}` heading — this is the version to release. Extract the version number (e.g., `1.5.3` from `## v1.5.3`).

Also extract the full release notes section for this version — everything from the `## v{version}` heading up to (but not including) the next `## v` heading or `---` separator.

If no version entry is found, tell the user:

> No release notes found in RELEASE_NOTES.md. Please run `/release-notes` first to generate them.

Then **stop**.

**Important:** Do NOT read `package.json` for the version. The version comes from RELEASE_NOTES.md. The GitHub workflow bumps `package.json` automatically after the release is created.

## Step 2: Ensure Clean Git State

Run `git status --porcelain`. If there are uncommitted changes, tell the user:

> There are uncommitted changes. Please commit or stash them before releasing.

Then **stop**.

## Step 3: Push to Remote

Run `git status -sb` to check if the branch is ahead of remote. If there are unpushed commits, ask the user if they want to push, then run `git push` to sync with the remote.

## Step 4: Check Tag Doesn't Already Exist

Run `git tag -l "{version}"`. If the tag already exists, tell the user:

> Tag {version} already exists. The release may have already been created.

Then **stop**.

## Step 5: Confirm with User

Show the user a summary:

- **Version:** {version}
- **Tag:** {version} (no `v` prefix)
- **Release notes preview:** (show the extracted release notes)

Ask: "Everything look good? Should I create the GitHub release?"

Wait for user confirmation before proceeding.

## Step 6: Create GitHub Release

Use `gh` to create the release. Pass the release notes body via a temp file to avoid shell escaping issues:

1. Write the extracted release notes to a temp file
2. Run: `gh release create {version} --title "{version}" --notes-file {temp-file}`
3. Remove the temp file

This creates a git tag and GitHub release. The tag push triggers the GitHub workflow which automatically bumps `package.json` and publishes to npm.

If `gh` is not installed or not authenticated, inform the user and stop.

## Step 7: Confirm Success

Show the user the release URL returned by `gh release create` and confirm the release was created successfully.
