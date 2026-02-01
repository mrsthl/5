# README Examples

This file contains approved examples of concise READMEs for different module types.

---

## Example 1: Model Module (user-model)

**Module Type:** Model layer
**Characteristics:** Domain entities, factory, CQRS requests, validators
**Length:** 54 lines

```markdown
# user-model

## Purpose

This module contains the core Mission domain model, including the Mission aggregate root, Order, UnitOrder, and related
entities. It provides the MissionFactory for creating and modifying missions according to business rules, along with
validators, queries, and CQRS request objects for mission operations.

## Key Components

- `Mission` - Root aggregate containing orders, mission units, and mission unit groups
- `MissionFactory` - Factory for all mission operations (create, addOrder, addUnitOrders, updateQuoteTerms)
- CQRS requests in `request/` package for commands and queries
- Validators in `validation/` package
- Predicates in `model/*/Is*Predicate.ts` for business rules

## Testing

Test fixtures available in `src/testFixtures/`:

\`\`\`java
// Simple
var mission = this.missionTestFixture.create();

// Customized
var mission = this.missionTestFixture.createBuilder()
.withOrderTemplateType(OrderTemplateType.DOOR_DOOR)
.withNumberOfUnitOrders(3)
.build();

// Customization of sub objects
var mission = this.missionTestFixture.create(
CreateMissionTestParameters.builderWithOrder(
CreateOrderTestParameters.builderWithUnitOrders(
CreateUnitOrderTestParameters.builder()
.collectionHandoverGroup(collectionHandoverGroup)
.deliveryHandoverGroup(deliveryHandoverGroup)
.build())
.id(orderId)
.orderTemplateType(orderTemplateType)
.build())
.build());

// Add order
var result = missionTestFixture.addOrder(this.mission, addOrderParameters);
\`\`\`

## Critical Patterns

1. **Always use MissionFactory** - Never manually create Mission/Order/UnitOrder connections
2. **Factory manages state** - Offsets, aliases, and IDs are calculated automatically
3. **Result objects** - Factory operations return result objects with both created entity and updated aggregate
4. **Handovers regenerated** - Template type changes recreate entire handover structure
```

**Key observations:**

- Purpose is 3 sentences, clear and specific
- Only 5 key components listed (not exhaustive)
- Uses package references ("Validators in `validation/` package")
- Testing section shows fixture usage with real examples
- Critical Patterns focus on what will break if not followed
- No Dependencies, Local Development, or Related Documentation sections (not needed)
- Total: 54 lines

---

## Example 2: Handler Module (user-handler)

**Module Type:** Handler layer
**Characteristics:** Handlers, validators, repository, storage models
**Length:** ~60-70 lines

```markdown
# user-handler

## Purpose

This module contains the Mission domain handlers, validators, and repository implementations. It provides the business
logic layer for mission operations, including CQRS command/query handlers, comprehensive validation, and both InMemory
and MongoDB repository implementations for persistence.

## Key Components

- `MissionHandlerActive` - Handles write operations (insert, update, upsert, delete)
- `MissionHandlerPassive` - Handles read operations (query, read by ID, read by alias)
- `MissionRepository` - Repository interface with InMemory and MongoDB implementations
- `MissionValidator` - Composite validator with 30+ business rules
- Storage models in `storage/v1/model/` for persistence layer

## Testing

Test fixtures are primarily in `user-model` module's testFixtures.

For repository testing:

- Use `InMemoryMissionRepository` for unit tests
- Use `MongoMissionRepository` with test container for integration tests

## Critical Patterns

1. **Use validator factories** - Don't instantiate validators directly, use `MissionValidatorFactory`
2. **Repository creation** - Use static factory methods: `inMemory()`, `mongo(config)`, `create(config)`
3. **Storage model versioning** - V1 models for backward compatibility, create V2 for breaking changes
4. **Query conversion** - Use `MissionQueryConverter` to convert domain queries to storage queries
5. **Validation is comprehensive** - Mission validation runs 30+ validators, can be slow for complex missions
```

**Key observations:**

- Purpose clearly describes the handler layer responsibilities
- Only 5 key components listed (handlers, repository, validator, storage models)
- Uses package reference for storage models ("Storage models in `storage/v1/model/`")
- Testing section mentions where fixtures are located and testing approach
- Critical Patterns focus on how to use the module correctly
- No exhaustive list of validators (just mentions "30+ business rules")
- Concise and focused

---

## Example 3: ID Module Pattern

**Module Type:** ID layer
**Characteristics:** Only ID types, no dependencies
**Length:** ~20-30 lines

```markdown
# user-id

## Purpose

This module contains ID types for the Mission domain, including MissionId, OrderId, UnitOrderId, MissionUnitId, and
MissionUnitGroupId.

## Key Components

- `MissionId` - Mission aggregate identifier
- `OrderId` - Order entity identifier
- `UnitOrderId` - Unit order entity identifier
- `MissionUnitId` - Mission unit identifier
- `MissionUnitGroupId` - Mission unit group identifier

## Critical Patterns

1. **Use factory methods** - Always use `OrderId.of(value)`, never construct directly
2. **Immutable** - All ID types are immutable value objects
```

**Key observations:**

- Very simple, minimal structure
- Lists the ID types (these are the key components)
- Only 2 critical patterns (factory methods, immutability)
- No Testing section (ID modules rarely have fixtures)
- Total: ~25 lines
