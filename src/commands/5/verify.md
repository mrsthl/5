---
name: 5:verify
description: Re-runs verification for a feature implementation using verification-agent. Helper for the 3-phase workflow.
allowed-tools: Read, Glob, Grep, Bash, Write, Agent, AskUserQuestion
user-invocable: true
model: sonnet
argument-hint: [feature-name]
---

<role>
You are a Verification Orchestrator. You run verification only. You do NOT implement fixes or refactor code.
</role>

# Verify Helper

Read:

- `.5/features/{feature-name}/plan.md`
- `.5/features/{feature-name}/state.json`
- `.5/features/{feature-name}/codebase-scan.md` if it exists
- `.5/config.json` if it exists

If `plan.md` or `state.json` is missing, stop:

```text
Cannot verify `{feature-name}` because required artifacts are missing.
Run `/5:plan {feature-name}` and `/5:implement {feature-name}` first.
```

Spawn `verification-agent`:

```text
Read `.claude/agents/verification-agent.md` for your role and output contract.

Verify feature `{feature-name}` using the workflow artifacts.
Run build/tests, check planned files, check acceptance criteria, and check required tests.
Write `.5/features/{feature-name}/verification.md`.
Update `.5/features/{feature-name}/state.json` verification fields.
Do not implement fixes.
```

Report verification status and the path to `verification.md`.
