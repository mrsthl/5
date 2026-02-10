---
name: run-tests
description: Executes tests using auto-detected or configured test runner. Supports jest, pytest, cargo test, go test, gradle, maven, and more. Use when running tests, verifying test results, or checking test status.
allowed-tools: Bash, Read, Grep
model: sonnet
context: fork
user-invocable: true
---

# Run Tests

## Overview

This skill executes test tasks with auto-detection of the test runner and sufficient timeout for long-running test suites. It provides structured test result reporting and actionable suggestions when tests fail.

## Test Runner Detection

The skill automatically detects the test runner using:

1. **Config file** (`.5/config.json`) - if `build.testCommand` is specified
2. **Auto-detection** - by examining project files and package.json scripts:
   - `package.json` with jest/vitest/mocha → npm test
   - `pytest.ini` or test files → pytest
   - `Cargo.toml` → cargo test
   - `go.mod` → go test
   - `build.gradle` → gradle test
   - `pom.xml` → mvn test

## Test Targets

| Target | Use Case |
|--------|----------|
| `all` | Run all tests in all modules |
| `module` | Run all tests in a specific module |
| `file` | Run tests in a specific file |
| `test` | Run a specific test by name |

## Parameters

When invoked, the skill expects:

- **target** (optional, default: `all`): One of `all`, `module`, `file`, `test`
- **module** (optional): Module name (for monorepos)
- **file** (optional): Test file path (for `file` target)
- **test** (optional): Specific test name (for `test` target)
- **pattern** (optional): Test name pattern/filter

## Execution Process

### 1. Load Configuration

Read `.5/config.json` if it exists:

```json
{
  "build": {
    "testCommand": "npm test",
    "testFileCommand": "npm test -- {{file}}",
    "testNameCommand": "npm test -- -t {{name}}"
  }
}
```

If commands are specified, use them with variable substitution. Otherwise, auto-detect.

### 2. Detect Test Runner

If no config, detect by checking project files: `package.json` (jest/vitest/mocha), `pytest.ini`/test files (pytest), `Cargo.toml` (cargo), `go.mod` (go), `build.gradle` (gradle), `pom.xml` (mvn).

### 3. Determine Test Command

Based on detected runner and target:

| Runner | all | module | file | test |
|--------|-----|--------|------|------|
| npm | `npm test` | `npm test -- {module}` | `npm test -- {file}` | `npm test -- -t "{name}"` |
| jest | `jest` | `jest {module}` | `jest {file}` | `jest -t "{name}"` |
| vitest | `vitest run` | `vitest run {module}` | `vitest run {file}` | `vitest run -t "{name}"` |
| pytest | `pytest` | `pytest {module}` | `pytest {file}` | `pytest -k "{name}"` |
| cargo | `cargo test` | `cargo test -p {module}` | N/A | `cargo test {name}` |
| go | `go test ./...` | `go test ./{module}/...` | `go test {file}` | `go test -run {name}` |
| gradle | `./gradlew test --offline` | `./gradlew :{module}:test --offline` | N/A | `./gradlew test --tests {name} --offline` |
| mvn | `mvn test` | `mvn test -pl {module}` | `mvn test -Dtest={ClassName}` | `mvn test -Dtest={ClassName}#{method}` |

### 4. Execute Tests with Proper Timeout

**IMPORTANT**: Test suites can take several minutes. Use generous timeout:

```bash
# Timeout based on target:
# - single test: 1 minute (60000ms)
# - file: 5 minutes (300000ms)
# - module: 10 minutes (600000ms)
# - all: 15 minutes (900000ms)
```

Execute the command and capture output.

### 5. Parse Test Output

Parse runner-specific output to extract: total tests, passed, failed, skipped, duration, and failed test names with error messages and file/line info.

### 6. Format Output

Provide structured response:

```
TEST STATUS: ✓ PASSED | ✗ FAILED | ⚠ PARTIAL
DURATION: 1m 23s
RUNNER: {detected-runner}
TARGET: {target type}
MODULE: {module or "all"}

SUMMARY:
- {N} tests total
- {N} passed
- {N} failed
- {N} skipped

FAILED TESTS: (if any)

1. {TestSuite} › {test name}
   File: path/to/file.test.ext:42
   Error: {error message}

2. {Another test}
   File: path/to/another.test.ext:15
   Error: {error message}

SUGGESTIONS:
- Review failed test assertions
- Check test fixtures and mocks
- Run specific failed tests individually to debug
```

## Error Handling

- If test runner cannot be detected, return error with detection attempted
- If command times out, report timeout with suggestion
- Always include failed test details with file locations
- If no tests found, report warning (not error)
- Include suggestion to check test file patterns

## DO NOT

- DO NOT modify source or test files
- DO NOT retry failed tests automatically (user decides)
- DO NOT run build before tests (use `/build-project` first if needed)
- DO NOT assume a specific test framework - always detect or use config
- DO NOT truncate test output too aggressively (users need full error messages)

## Example

```
User: /run-tests
Skill: [Detects jest] → [Runs: jest] → [Reports: 47 passed, 0 failed]
```

## Related Documentation

- [5-Phase Workflow Guide](../../docs/workflow-guide.md)
- [/build-project skill](../build-project/SKILL.md)
