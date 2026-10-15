---
name: baseline-conventions
description: Baseline rules for errors, types, names and tests. They keep a codebase clean when the repository documents no rules of its own. Use when writing, refactoring or reviewing code.
---

# Baseline conventions

These rules fill the gaps a repository leaves open. A repository standard always wins over them. Each rule reads
_what it is_ → _how to fix_:

## Errors

- **Swallowed error**: an empty catch, or a catch that ignores the error. → Log it, rethrow it, or turn it into a typed result.
- **Unhandled async failure**: a promise or future whose failure path nobody handles. → Handle the failure where it is awaited, or pass it on to the caller.
- **Bare error message**: an error that carries only a string. → Use a typed error that carries the context a reader needs.
- **Errors as control flow**: an exception thrown for an expected case. → Check the case up front, or return a result.

## Types and names

- **Untyped boundary**: a public function, exported type or data shape without an explicit type, where the language supports one. → Declare the type.
- **Escape hatch**: `any`, a non-null assertion or an unchecked cast. → Narrow the type. When it can't be avoided, say why in a comment.
- **Magic value**: a literal number or string whose meaning the reader must guess. → Give it a named constant.
- **Unclear boolean**: a boolean whose name doesn't read as a question. → Prefix it with `is`, `has`, `can` or `should`.

## Tests

- **Mixed test**: one test that checks several behaviours. → Split it, so each test checks one behaviour.
- **Method-named test**: a test named after the method it calls. → Name it after the behaviour, such as `returns 404 when the user is missing`.
- **Weak assertion**: an assertion that only checks a value exists, or that can't fail. → Assert the actual value or outcome.
- **Tangled test**: setup, action and checks are mixed together. → Order them as arrange, act, assert.
- **Internal mock**: a mock of an internal module or a pure function. → Mock only at system boundaries such as network, database, filesystem and clock. Test the rest directly.
- **Silent skip**: a disabled test with no reason. → Fix it, delete it, or link the issue that tracks it.
- **Unprotected bug fix**: a fix that no test guards. → Add a regression test that fails without the fix, when practical.

## Leftovers

- **Commented-out code**: code kept alive in a comment. → Delete it. Version control keeps the history.
