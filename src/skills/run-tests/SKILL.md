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

1. **Config file** (`.claude/.5/config.json`) - if `build.testCommand` is specified
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

Read `.claude/.5/config.json` if it exists:

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

If no config, examine project files:

```bash
# Check package.json for test configuration
if [ -f "package.json" ]; then
  # Check for test frameworks
  if grep -q '"jest"' package.json || grep -q '"@jest"' package.json; then
    TEST_RUNNER="jest"
  elif grep -q '"vitest"' package.json; then
    TEST_RUNNER="vitest"
  elif grep -q '"mocha"' package.json; then
    TEST_RUNNER="mocha"
  else
    TEST_RUNNER="npm"  # Use npm test script
  fi
fi

# Check for pytest
if [ -f "pytest.ini" ] || [ -f "setup.py" ] || ls tests/*.py >/dev/null 2>&1; then
  TEST_RUNNER="pytest"
fi

# Check for Cargo
if [ -f "Cargo.toml" ]; then
  TEST_RUNNER="cargo"
fi

# Check for Go
if [ -f "go.mod" ]; then
  TEST_RUNNER="go"
fi

# Check for Gradle
if [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
  TEST_RUNNER="gradle"
fi

# Check for Maven
if [ -f "pom.xml" ]; then
  TEST_RUNNER="mvn"
fi
```

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

Analyze output to extract test results. Parser varies by runner:

#### Jest/Vitest Output
```
Tests:       2 failed, 5 passed, 7 total
```

#### Pytest Output
```
====== 5 passed, 2 failed in 1.23s ======
```

#### Cargo Output
```
test result: FAILED. 5 passed; 2 failed; 0 ignored
```

#### Go Output
```
FAIL    package/name    0.123s
PASS    package/other   0.456s
```

#### Gradle/Maven Output
```
Tests run: 7, Failures: 2, Errors: 0, Skipped: 0
```

Extract:
- Total tests
- Passed
- Failed
- Skipped/Ignored
- Duration
- Failed test names and error messages with file/line info

### 6. Parse Failure Details

For each failed test, extract:

**Jest/Vitest:**
```
  ● TestSuite › test name

    expect(received).toBe(expected)

      at Object.<anonymous> (path/to/file.test.ts:42:5)
```

**Pytest:**
```
FAILED path/to/test_file.py::test_name - AssertionError: assert False
```

**Cargo:**
```
---- test_name stdout ----
thread 'test_name' panicked at 'assertion failed', src/lib.rs:42:5
```

**Go:**
```
--- FAIL: TestName (0.00s)
    file_test.go:42: expected 5, got 3
```

### 7. Format Output

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

## Common Test Scenarios

### Run All Tests Before Commit

```
Target: all
Use: Verify all tests pass before pushing changes
```

### Test Specific Module After Changes

```
Target: module
Module: user-service
Use: Quick verification after modifying specific module
```

### Debug Single Failing Test

```
Target: test
Test: UserService › should create user
Use: Isolate and debug specific test failure
```

### Test File After Refactoring

```
Target: file
File: src/services/user.test.ts
Use: Verify tests in refactored file
```

## Common Test Issues

### Tests Fail with "Module Not Found"

**Indicator**: Import/require errors

**Suggestions**:
- Run `npm install` or equivalent
- Check test file paths
- Verify module resolution config

### Tests Timeout

**Indicator**: `Exceeded timeout` messages

**Suggestions**:
- Increase test timeout in config
- Check for infinite loops or blocking operations
- Review async code completion

### Flaky Tests

**Indicator**: Tests pass sometimes, fail other times

**Suggestions**:
- Check for time-dependent code (use mocked time)
- Review concurrent code and race conditions
- Ensure tests don't depend on execution order

### Environment Issues

**Indicator**: Tests fail in CI but pass locally

**Suggestions**:
- Check environment variables
- Verify test database/services availability
- Review CI-specific configurations

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

## Examples

### Example 1: Auto-detect and run all tests

```
User: /run-tests

Skill: [Detects package.json with jest]
Skill: [Runs: jest]
Skill: [Reports: 47 tests, 47 passed, 0 failed]
```

### Example 2: Run module tests

```
User: /run-tests target=module module=user-service

Skill: [Detects pytest]
Skill: [Runs: pytest tests/user-service]
Skill: [Reports: 12 tests, 10 passed, 2 failed]
Skill: [Lists failed test details]
```

### Example 3: Run specific test

```
User: /run-tests target=test test="should validate email format"

Skill: [Detects jest]
Skill: [Runs: jest -t "should validate email format"]
Skill: [Reports: 1 test, 0 passed, 1 failed]
Skill: [Shows assertion error with file:line]
```

## Related Documentation

- [5-Phase Workflow Guide](../../docs/workflow-guide.md)
- [/build-project skill](../build-project/SKILL.md)
