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

1. **Config file** (`.claude/.5/config.json`) - if `build.command` is specified
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

Read `.claude/.5/config.json` if it exists:

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

If no config, examine project files to detect build system:

```bash
# Check for package.json
if [ -f "package.json" ]; then
  # Check for lock files to determine package manager
  if [ -f "pnpm-lock.yaml" ]; then
    BUILD_TOOL="pnpm"
  elif [ -f "yarn.lock" ]; then
    BUILD_TOOL="yarn"
  else
    BUILD_TOOL="npm"
  fi
fi

# Check for Gradle
if [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
  BUILD_TOOL="gradle"
fi

# Check for Maven
if [ -f "pom.xml" ]; then
  BUILD_TOOL="mvn"
fi

# Check for Cargo
if [ -f "Cargo.toml" ]; then
  BUILD_TOOL="cargo"
fi

# Check for Go
if [ -f "go.mod" ]; then
  BUILD_TOOL="go"
fi

# Check for Make
if [ -f "Makefile" ]; then
  BUILD_TOOL="make"
fi
```

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

Analyze output to identify:

#### Success Indicators

Tool-specific success patterns:
- npm/yarn/pnpm: No error messages, process exits with 0
- Gradle: `BUILD SUCCESSFUL`
- Maven: `BUILD SUCCESS`
- Cargo: `Finished` or `Compiling`
- Go: No error output
- Make: No error messages

#### Error Types

**Compilation Errors**:
```
/path/to/file.ext:42: error: ...
```
Extract: file path, line number, error message

**Dependency Issues**:
```
Could not resolve dependencies
Module not found
```
Suggest: `npm install`, `./gradlew --refresh-dependencies`, etc.

**Out of Memory**:
```
JavaScript heap out of memory
Java heap space
```
Suggest: Increase memory allocation

**Tool Not Found**:
```
command not found: npm
```
Suggest: Install the build tool

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

## Common Build Scenarios

### First-Time Build

May fail with dependency issues. Suggestions:
- npm: `npm install`
- gradle: Remove `--offline` flag temporarily
- cargo: `cargo fetch`

### Incremental Build Issues

Stale cache or artifacts. Suggestions:
- Try `clean` target
- Clear cache manually

### Memory Issues

Build runs out of memory. Suggestions:
- npm: `export NODE_OPTIONS="--max-old-space-size=4096"`
- gradle: Add `org.gradle.jvmargs=-Xmx4g` to `gradle.properties`
- maven: `export MAVEN_OPTS="-Xmx4g"`

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

## Examples

### Example 1: Auto-detect npm and build

```
User: /build-project

Skill: [Detects package.json, uses npm]
Skill: [Runs: npm run build]
Skill: [Reports success with duration]
```

### Example 2: Gradle with module

```
User: /build-project module=user-service

Skill: [Detects build.gradle]
Skill: [Runs: ./gradlew :user-service:build -x test --offline]
Skill: [Reports success]
```

### Example 3: Build failure

```
User: /build-project

Skill: [Detects Cargo.toml]
Skill: [Runs: cargo build]
Skill: [Detects compilation error]
Skill: [Reports: File src/main.rs:42, Error: mismatched types]
Skill: [Suggests: Fix type error in src/main.rs:42]
```

## Related Documentation

- [5-Phase Workflow Guide](../../docs/workflow-guide.md)
- [/run-tests skill](../run-tests/SKILL.md)
