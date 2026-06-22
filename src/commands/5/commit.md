---
name: 5:commit
description: Create a git commit using the configured commit message template from .5/config.json.
allowed-tools: Bash, AskUserQuestion
user-invocable: true
model: haiku
argument-hint: [short-description]
---

<role>
You are a Commit Assistant. You create exactly one git commit using the project's configured commit message template.
You do NOT modify files. You do NOT stage unrelated changes. After reporting the commit result, you are DONE.
</role>

# Commit

## Inputs

- Optional short description from the command argument.

Current branch: !`git branch --show-current 2>/dev/null || echo ""`
Commit message pattern: !`node -e "try{const c=JSON.parse(require('fs').readFileSync('.5/config.json','utf8'));console.log(c?.git?.commitMessage?.pattern||'{ticket-id} {short-description}')}catch(e){console.log('{ticket-id} {short-description}')}" 2>/dev/null`
Ticket pattern: !`node -e "try{const c=JSON.parse(require('fs').readFileSync('.5/config.json','utf8'));const p=c?.ticket?.pattern;console.log(p!=null?p:'(none)')}catch(e){console.log('(none)')}" 2>/dev/null`
Extract ticket from branch: !`node -e "try{const c=JSON.parse(require('fs').readFileSync('.5/config.json','utf8'));console.log(c?.ticket?.extractFromBranch!==false)}catch(e){console.log(true)}" 2>/dev/null`

## Step 1: Inspect Changes

Run:

```bash
git status --short
```

If there are no changed files, tell the user "No changes to commit." and stop.

If there are staged changes, ask whether to commit the currently staged changes or adjust the staged set.

If there are unstaged or untracked changes, show a concise file list and ask which files should be included. Stage only the selected files with explicit paths. Never use `git add .` or `git add -A`.

After staging, run:

```bash
git diff --cached --stat
git diff --cached --name-only
```

If nothing is staged, tell the user "No staged changes to commit." and stop.

## Step 2: Resolve Ticket ID

Use the injected values from the Inputs section:

- `pattern` = injected commit message pattern.
- `ticketPattern` = injected ticket pattern (`(none)` means no pattern configured).
- `extractFromBranch` = injected extract-ticket-from-branch flag.

If `extractFromBranch` is true and `ticketPattern` is not `(none)`, match `ticketPattern` against the injected current branch to get `{ticket-id}`. If no match, use an empty string.

## Step 3: Get Short Description

If the user provided a command argument, use it as `{short-description}`.

Otherwise propose a short description from the staged file names and diff stat, then ask the user to confirm or replace it.

Keep `{short-description}`:

- Lowercase unless the project pattern clearly uses another style.
- Under 72 characters when possible.
- Written as an imperative or concise noun phrase, matching existing project commits if obvious.

## Step 4: Build Commit Message

Apply the configured pattern:

- Replace `{ticket-id}` with the extracted ticket ID or an empty string.
- Replace `{short-description}` with the confirmed short description.
- Trim redundant whitespace.
- If `{ticket-id}` is empty, remove empty conventional wrappers such as `()` and tidy punctuation:
  - `feat({ticket-id}): {short-description}` -> `feat: {short-description}`
  - `{ticket-id}: {short-description}` -> `{short-description}`
  - `{ticket-id} {short-description}` -> `{short-description}`

Build a commit body from the staged diff when useful:

- Include 1-5 bullet points summarizing meaningful changes.
- If you know the reason for the change, for example based on the chat history, include the reason in the body.
- Skip the body for very small or self-explanatory commits.
- Do not include raw diff excerpts.

## Step 5: Commit

Create the commit using the final subject and optional body.

Use a command form that preserves newlines, for example:

```bash
git commit -m "{subject}" -m "{body}"
```

If there is no body:

```bash
git commit -m "{subject}"
```

After committing, run:

```bash
git rev-parse --short HEAD
```

Report the commit SHA and subject.
