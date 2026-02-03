# Verification Report: {TICKET-ID}

**Feature:** {feature-name}
**Status:** PASSED | PARTIAL | FAILED
**Verified:** {timestamp}

---

## Layer 1: Infrastructure

### Files

- [x] {path} — exists
- [ ] {path} — MISSING

**Result:** {N}/{M} files exist

### Build

**Command:** `{build-command}`
**Status:** SUCCESS | FAILED

{build errors if any}

### Tests

**Command:** `{test-command}`
**Status:** SUCCESS | FAILED
**Total:** {N} | **Passed:** {N} | **Failed:** {N}

{test failure details if any}

**Layer 1 Result:** PASSED | FAILED

---

## Layer 2: Feature Completeness

{If feature.md was not found: "Skipped — no feature.md available (normal for quick-implement workflows)"}

### Acceptance Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | {criterion text} | SATISFIED | {file:line} |
| 2 | {criterion text} | NOT SATISFIED | — |

**Result:** {N}/{M} criteria satisfied

### Functional Requirements

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | {requirement text} | IMPLEMENTED | {file:line} |
| 2 | {requirement text} | NOT IMPLEMENTED | — |

**Result:** {N}/{M} requirements implemented

### Component Completeness

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| {name} | {path} | COMPLETE | — |
| {name} | {path} | PARTIAL | {what's missing} |

**Result:** {N}/{M} components complete

**Layer 2 Result:** PASSED | PARTIAL | SKIPPED

---

## Layer 3: Quality

### Test Coverage for New Files

| New File | Test File | Status |
|----------|-----------|--------|
| {src/path/File.ts} | {src/path/File.test.ts} | HAS TEST |
| {src/path/Other.ts} | — | NO TEST |

**Result:** {N}/{M} new files have tests

**Layer 3 Result:** PASSED | PARTIAL

---

## Summary

| Layer | Result | Details |
|-------|--------|---------|
| Infrastructure | PASSED / FAILED | {N}/{M} files, build {status}, tests {status} |
| Feature Completeness | PASSED / PARTIAL / SKIPPED | {N}/{M} criteria, {N}/{M} requirements |
| Quality | PASSED / PARTIAL | {N}/{M} new files have tests |

**Overall:** PASSED | PARTIAL | FAILED
