# Code Review Findings

**Generated:** {ISO-timestamp}
**Scope:** {what was reviewed}
**Total Findings:** {N}

---

## How to Use This File

`/5:review` hands this file to `/5:address-review-findings`, which fixes the clear findings on its own and asks you, one question at a time, about the rest. Run `/5:address-review-findings --interactive` to decide on every finding yourself.

---

## Finding {N}/{total}

**File:** {file-path}
**Line:** {line-number}
**Category:** {Fixable|Question|Manual}
**Severity:** {error|warning|suggestion}

**Description:**
{what the reviewer found}

**Suggested Fix:**
{how to fix it - can be multi-line}

**Original Reviewer Message:**
```
{raw output from reviewer}
```

---

## Summary

- Total: {N}
- Fixable: {N}
- Questions: {N}
- Manual Review: {N}

**Next Step:** `/5:address-review-findings` (runs automatically after `/5:review`)
