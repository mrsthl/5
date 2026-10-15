---
name: fowler-code-smells
description: Martin Fowler's code smells (Refactoring, ch. 3), each with its fix. Use when writing, refactoring or reviewing code.
---

# Fowler code smells

A smell is a heuristic, never a hard rule. It hints that the design could be better. Each smell reads
_what it is_ → _how to fix_:

- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it does or holds. → Rename it. If no honest name comes, the design is murky.
- **Duplicated Code**: the same logic shape appears in more than one place. → Extract the shared shape and call it from both.
- **Feature Envy**: a method that reaches into another object's data more than its own. → Move the method onto the data it envies.
- **Data Clumps**: the same few fields or parameters keep travelling together. A type wants to be born. → Bundle them into one type and pass that.
- **Primitive Obsession**: a primitive or string standing in for a domain concept that deserves its own type. → Give the concept its own small type.
- **Repeated Switches**: the same `switch` or `if` cascade on the same type recurs in several places. → Replace it with polymorphism, or with one map all sites share.
- **Shotgun Surgery**: one logical change forces scattered edits across many files. → Gather what changes together into one module.
- **Divergent Change**: one file or module is edited for several unrelated reasons. → Split it so each module changes for one reason.
- **Speculative Generality**: abstraction, parameters, or hooks that nothing in the code uses yet. → Delete them. Inline back until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. → Hide the walk behind one method on the first object.
- **Middle Man**: a class or function that mostly just delegates onward. → Cut it and call the real target directly.
- **Refused Bequest**: a subclass or implementer that ignores or overrides most of what it inherits. → Drop the inheritance and use composition.

Source: Martin Fowler, _Refactoring_ (2nd ed.), chapter 3. The selection and wording follow Matt Pocock's
[code-review skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md).
