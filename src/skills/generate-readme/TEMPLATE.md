# Module README Template

Use this template structure for all module READMEs. Keep them concise and focused.

---

# [Module Name]

## Purpose

[1-3 sentences describing what this module does and its role in the system]

Example: "This module contains the core Mission domain model, including the Mission aggregate root, Order, UnitOrder,
and related entities. It provides the MissionFactory for creating and modifying missions according to business rules."

## Key Components

[List only the 3-5 most important components - not exhaustive]

- `EntityName` - Brief description of key entity
- `EntityFactory` - Key factory operations (create, addX, updateY)
- `EntityRepository` - Repository interface with implementations
- Package references for groups: "Validators in `validation/` package"

**Guidelines:**

- **DO NOT** list every file
- **DO** use package references for groups of related files
- **DO** focus on what developers will use most frequently
- **DO** mention main interfaces/abstractions, not every implementation

## Testing

[Brief description of test fixtures and key testing patterns]

**Only include this section if:**

- Module has test fixtures in `src/testFixtures/`
- Module has a separate `-testing` sibling
- Testing approach is non-standard or important to document

Example:

```java
// Simple example
var entity = entityTestFixture.create();

// Customized example
var entity = entityTestFixture.createBuilder()
    .withProperty(value)
    .build();
```

---

## Optional Sections

Include these sections only if they add significant value:

### Critical Patterns

[List only 3-5 most important patterns specific to this module]

Focus on patterns that:

- Will break things if not followed
- Are non-obvious
- Are critical to understanding the module

Examples:

1. **Always use MissionFactory** - Never manually create Mission/Order/UnitOrder connections
2. **Factory manages state** - Offsets, aliases, and IDs are calculated automatically
3. **Result objects** - Factory operations return result objects with both created entity and updated aggregate

**DO NOT include:**

- General patterns covered in CLAUDE.md
- Obvious patterns like "use builders for construction"
- Implementation details

### Dependencies

**Only include if:**

- Dependencies are non-obvious
- There are critical ordering or version requirements
- External systems are involved

**Depends on:** [Brief list of key dependencies]

**Used by:** [Brief list of main consumers]

### Related Documentation

**Don't include:**

- Links to CLAUDE.md sections relevant to this module
- Don't repeat things and patterns already documented in CLAUDE.md

**Include for:**

- Parent or sibling module READMEs
- External documentation
- [Related module READMEs](../path/README.md)

---

## Anti-Patterns in READMEs

**DO NOT:**

1. List every validator, query, or handler class individually
2. Document implementation details
3. Copy content from CLAUDE.md
4. Include exhaustive method signatures
5. Create walls of text
6. Document every package
7. Include obvious information

**DO:**

1. Focus on top-level overview
2. List 3-5 key components only
3. Reference CLAUDE.md for patterns
4. Keep it under 100 lines
5. Use examples sparingly
6. Use package references for groups
7. Document only critical information

---

## Example README Lengths

- **ID module**: 10-30 lines (very simple)
- **Model module**: 20-80 lines
- **Handler module**: 20-80 lines
- **Service module**: 20-80 lines
- **Testing module**: 20-60 lines

If your README exceeds 150 lines, it's too detailed.