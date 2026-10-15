---
name: cognitive-load
description: Rules for keeping the cognitive load of code low. Use when writing, refactoring or reviewing code.
---

# Cognitive load

Cognitive load is how much a reader must hold in mind to understand the code. Working memory holds about
**four chunks**: a variable's value, a branch taken, a call to chase, a mapping to remember. Past four, the
reader loses the thread.

_Intrinsic_ load comes from the problem itself and stays. _Extraneous_ load comes from how the code is
written. The rules below cut extraneous load.

## Rules

- **Named conditions.** Give the parts of a compound condition intermediate variables named after what they
  mean. The `if` then reads as one chunk:
  ```java
  var isFresh = price.timestamp().isAfter(cutoff);
  var isKnownVendor = vendors.contains(price.vendor());
  if (isFresh && isKnownVendor) { ... }
  ```
- **Early returns.** Handle invalid cases with guard clauses at the top. The happy path then runs
  unindented. Nesting makes the reader carry every outer condition along.
- **Composition over inheritance.** Deep inheritance chains make the reader trace behaviour across levels.
  A change in a parent can silently break a child.
- **Deep modules.** A module earns its place with a simple interface over substantial behaviour. Many
  shallow modules whose interface is as complex as their body are tiring to navigate. Merge them.
- **Important logic can be large.** Keep the crux of a feature in one substantial function. Splitting it
  into many tiny hops hides it.
- **One stakeholder per module.** A module answers to one user or one concern. "Does one thing" is too vague
  to judge.
- **Plain language subset.** Use constructs any developer of the language reads fluently. A clever feature
  makes the reader learn the feature before the code.
- **Self-describing values.** Prefer names, enums and descriptive strings over codes that need a lookup
  table. Return `"jwt_has_expired"` rather than relying on HTTP status `401` vs `403`. Keep business meaning
  out of transport details.
- **Plain terms.** Name things with the plainest accurate words, in the problem's own language. Reuse terms
  already in the codebase.
- **Duplication over coupling.** A few copied lines beat a premature shared abstraction that couples
  unrelated code. Every dependency is code the reader may have to debug.
- **Framework at the edge.** Core logic uses the framework like a library. It stays readable to someone who
  doesn't know the framework's magic.
- **Layers only where they hide something.** Add an abstraction only at a real extension point. A layer that
  only forwards calls is pure indirection.
- **Boring over clever.** Pick the straightforward solution. Debugging is twice as hard as writing the code.
- **Familiar is not simple.** Code feels simple to its author. Judge it as a newcomer would. If a newcomer
  stays confused for about 40 minutes, the code needs work.

Source: Artem Zakirullin, [Cognitive load is what matters](https://github.com/zakirullin/cognitive-load),
CC BY 4.0. Condensed and adapted.
