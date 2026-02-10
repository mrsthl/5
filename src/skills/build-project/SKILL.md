---
name: build-project
description: Builds the project using auto-detected or configured build system. Supports npm, gradle, cargo, go, maven, make, and more. Use when compiling, building, or verifying project build status.
allowed-tools: Bash, Read, Grep
model: sonnet
context: fork
user-invocable: true
---

# Build Project

## Overview

This skill executes build tasks with auto-detection of the build system and sufficient timeout for long-running builds. It provides structured error reporting and actionable suggestions when builds fail.

## Build System Detection

The skill automatically detects the build system using:

1. **Config file** (`.5/config.json`) - if `build.command` is specified
2. **Auto-detection** - by examining project files:
   - `package.json` → npm/yarn/pnpm
   - `build.gradle` or `build.gradle.kts` → Gradle
   - `pom.xml` → Maven
   - `Cargo.toml` → Cargo (Rust)
   - `go.mod` → Go
   - `Makefile` → Make
   - `setup.py` or `pyproject.toml` → Python

## Build Targets

| Target | Use Case |
|--------|----------|
| `compile` | Fast compilation check (no tests, no packaging) |
| `build` | Full build (may include tests depending on tool) |
| `clean` | Clean build (removes previous artifacts first) |

## Parameters

When invoked, the skill expects:

- **target** (optional, default: `build`): One of `compile`, `build`, `clean`
- **module** (optional): Specific module to build (for monorepos)

## Execution Process

### 1. Load Configuration

Read `.5/config.json` if it exists:

```json
{
  "build": {
    "command": "npm run build",
    "compileCommand": "npm run compile",
    "cleanCommand": "npm run clean"
  }
}
```

If commands are specified, use them. Otherwise, auto-detect.

### 2. Detect Build System

If no config, detect by checking project files: `package.json` + lock files (npm/yarn/pnpm), `build.gradle` (gradle), `pom.xml` (mvn), `Cargo.toml` (cargo), `go.mod` (go), `Makefile` (make).

### 3. Determine Build Command

Based on detected tool and target:

| Tool | compile | build | clean |
|------|---------|-------|-------|
| npm | `npm run build` | `npm run build` | `rm -rf dist node_modules && npm install` |
| yarn | `yarn build` | `yarn build` | `yarn clean` or `rm -rf dist` |
| pnpm | `pnpm build` | `pnpm build` | `pnpm clean` or `rm -rf dist` |
| gradle | `./gradlew compileJava -x test --offline` | `./gradlew build -x test --offline` | `./gradlew clean build` |
| mvn | `mvn compile` | `mvn package -DskipTests` | `mvn clean package` |
| cargo | `cargo check` | `cargo build` | `cargo clean && cargo build` |
| go | `go build ./...` | `go build ./...` | `go clean && go build ./...` |
| make | `make` | `make` | `make clean` |

### 4. Execute Build with Proper Timeout

**IMPORTANT**: Builds can take several minutes. Use generous timeout:

```bash
# Timeout based on target
# - compile: 2 minutes (120000ms)
# - build: 10 minutes (600000ms)
# - clean: 15 minutes (900000ms)
```

Execute the command and capture output.

### 5. Parse Build Output

Determine success/failure from tool-specific patterns (exit code, `BUILD SUCCESSFUL`, `BUILD SUCCESS`, `Finished`, etc.). For failures, extract file paths, line numbers, and error messages. Identify error type (compilation, dependency, memory, tool not found) and suggest appropriate fix.

### 6. Format Output

Provide structured response:

```
BUILD STATUS: ✓ SUCCESS | ✗ FAILED
DURATION: 2m 34s
TOOL: {detected-tool}
TARGET: {target}
MODULE: {module or "all"}

SUMMARY:
- Build completed successfully
OR
- Build failed with X errors

ERRORS: (if any)
File: path/to/file.ext:42
Error: {error message}

File: path/to/another.ext:15
Error: {error message}

SUGGESTIONS:
- {actionable suggestion based on error type}
```

## Error Handling

- If build tool cannot be detected, return error with list of checked locations
- If command times out, report timeout with suggestion to increase timeout or optimize build
- If build fails, extract and format all errors for user
- Always include the raw command that was executed for reproducibility

## DO NOT

- DO NOT modify source files
- DO NOT install dependencies (unless explicitly part of clean target)
- DO NOT run tests (use `/run-tests` skill for that)
- DO NOT assume a specific build system - always detect or use config
- DO NOT use overly short timeouts (builds can be slow)

## Example

```
User: /build-project
Skill: [Detects npm] → [Runs: npm run build] → [Reports success with duration]
```

## Related Documentation

- [5-Phase Workflow Guide](../../docs/workflow-guide.md)
- [/run-tests skill](../run-tests/SKILL.md)
