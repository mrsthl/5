# Code Conventions

{PROJECT_CONVENTIONS_SUMMARY}

## Typing

- Never use implicit `any` types; if unavoidable, add a `// reason:` comment explaining why.
- Enable strict null checks: treat `null` and `undefined` as distinct types.
- Avoid non-null assertions (`!`) without an explanatory comment.
- Prefer explicit return types on all public functions and methods.
- Use typed/domain types for IDs, money, dates, and other value objects; avoid raw primitives.

{PROJECT_TYPING}

## Code Structure

- Maximum function or method body: 40 lines of logic.
- Maximum file length: 300 lines (excluding generated or vendor code).
- One primary responsibility per file, class, or module — split when in doubt.
- No more than three levels of nesting; use early returns to flatten control flow.
- Extract helpers when logic mixes orchestration, IO, parsing, and mapping in one place.

{PROJECT_STRUCTURE}

## Naming

- Names must express intent; avoid abbreviations (exceptions: `i`, `j`, `err`, `ctx`, `req`, `res`).
- No magic numbers or strings: extract to named constants with descriptive names.
- Booleans: prefix with `is`, `has`, `can`, `should`, or `needs`.
- Collections and arrays: plural noun names (`users`, `errors`, `pendingItems`).
- Functions and methods: verb phrases that describe the action (`fetchUser`, `validateEmail`, `parseResponse`).

{PROJECT_NAMING}

## Error Handling

- Never silently swallow exceptions or errors — always log, rethrow, or convert to a typed result.
- Distinguish recoverable errors from unrecoverable ones; do not use exceptions for control flow.
- All async code must handle error paths: catch rejected promises and wrap `async/await` in `try/catch`.
- Use typed/structured errors with context, not raw strings.

{PROJECT_ERROR_HANDLING}

## Testing

- Follow AAA structure in each test: **Arrange** (set up state), **Act** (call the subject), **Assert** (verify the outcome).
- One behavior per test — a single test function must cover exactly one scenario.
- Test names describe the behavior being tested, not the method: `"returns 404 when user not found"`, not `"test getUserById"`.
- Assert on meaningful, observable outcomes. Forbidden:
  - `expect(result).toBeDefined()` as the only assertion
  - `expect(true).toBe(true)` or any trivially-passing assertion
  - Empty or body-less tests
- Mock only at system boundaries: external HTTP, databases, filesystem, and clocks.
- Never mock internal modules or pure functions — test them directly.
- Cover all paths: happy path, known error cases, boundary values, and null/empty inputs.
- No disabled tests (`skip`, `xtest`, `xit`, `@Ignore`) without a linked issue comment.
- New code must reach ≥ 80% branch coverage; bug fixes must include a regression test.
- Use factories or builders for test data; avoid inline hardcoded objects duplicated across tests.

{PROJECT_TESTING}

## Comments and Documentation

- Comment the **why**, not the what; well-named code should be self-documenting.
- Forbidden: comments that restate the code (`// increment counter`, `// call save()`).
- Document: non-obvious invariants, workarounds, performance trade-offs, and cross-system constraints.
- All public APIs (functions, classes, interfaces, endpoints) require a docstring or docblock.
- Never leave commented-out code; use version control history instead.

{PROJECT_COMMENTS}

---

*Project-specific conventions above were derived from codebase analysis and supplement the defaults.*
