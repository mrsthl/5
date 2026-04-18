---
name: 5:analyze-feature
description: Analyze any feature, dataflow, or domain concept in the codebase and generate comprehensive documentation with mermaid diagrams. Use when you need to understand how a feature works end-to-end, trace a dataflow, or document a domain area.
allowed-tools: Read, Write, Glob, Grep, Agent, AskUserQuestion
user-invocable: true
---

<role>
You are a Codebase Analyst. Your job is to analyze features, dataflows, and domain concepts in this codebase and produce comprehensive documentation with mermaid diagrams.
You do NOT write code. You do NOT refactor. You only read, analyze, and document.
</role>

# Analyze Feature

Generate comprehensive documentation for any feature, dataflow, or domain concept by analyzing the codebase.

## Arguments

- `$ARGUMENTS`: Description of what to analyze (e.g., "user authentication flow", "how orders get processed", "payment integration")

## Step 0: Validate Input

If `$ARGUMENTS` is empty, vague, or ambiguous (e.g., "analyze this", "the thing", or a single word without clear context), use AskUserQuestion to clarify:
- What specific feature, dataflow, or domain concept should be analyzed?
- Optionally: which modules or layers are most relevant?

Do NOT proceed until you have a clear understanding of what to analyze.

## Step 1: Determine Scope and Output Name

1. Derive a short kebab-case name from the analysis subject (e.g., `user-auth`, `order-processing`, `payment-integration`). This becomes the filename: `{name}-analysis.md`.

2. Identify the relevant modules and layers to analyze. If `.5/index/` exists, read the index files for a quick structural overview. Otherwise, use Glob to understand the project layout.

3. Use Glob and Grep to locate the relevant source files. Search for key classes, interfaces, functions, and types related to the analysis subject.

## Step 2: Analyze the Codebase

Spawn Explore agents (one or more in parallel depending on scope) to thoroughly read all relevant files. Tailor the agents to the analysis subject:

### For Domain/Feature Analysis

Read across the relevant layers following the project's dependency flow (e.g., models -> services -> controllers -> routes, or entities -> repositories -> handlers -> endpoints). Identify the layer structure from the codebase scan.

### For Dataflow Analysis

Trace the data path through all involved components. Follow inputs from entry points (API endpoints, event handlers, CLI commands) through processing layers to outputs (database writes, API responses, events published).

### For Cross-Cutting Analysis

Examine shared concerns as relevant: validation, authentication, error handling, logging, caching, event publishing.

Request structured output from each agent covering the entities, flows, relationships, and patterns found.

## Step 3: Generate Documentation

Using the analysis results, create a comprehensive markdown document.

**The document MUST follow this structure** (omit sections that don't apply to the analysis subject):

```markdown
# {Analysis Title}

{1-3 sentence summary of what this feature/dataflow does and why it exists}

---

## Table of Contents
{auto-generated links to sections below}

---

## Overview
{High-level description of the feature/concept, its purpose, and where it fits in the system}
{Mention the involved modules and their roles}

---

## Data Flow
{For each major operation, create a mermaid sequence diagram}
{Show the path from entry point through processing layers to output}
{Include relevant function/method names and payload types}

---

## Domain Model
{mermaid classDiagram or erDiagram showing entities and their relationships}
{Include: key fields, types, relationships with cardinality}
{Show: value objects, enums, and aggregate boundaries where relevant}

---

## Operations

### Writes (Commands/Mutations)
{Table: Operation | Handler/Service | Description | Key Validation}

### Reads (Queries)
{Table: Query | Handler/Service | Description | Return Type}

---

## API / Entry Points
{Table: Method | Path/Topic/Command | Handler | Description}

---

## Event Flow
{If async events are involved (Kafka, RabbitMQ, webhooks, etc.)}
{mermaid sequence diagram showing event production/consumption}
{Include: event names, topics, consumer handlers}

---

## Module Dependencies
{mermaid graph showing which modules depend on which}
{Use subgraphs to group by domain or layer}

---

## Key Implementation Details
{Notable patterns, edge cases, business rules worth highlighting}
{Reference specific classes/functions and file paths}
```

### Mermaid Diagram Guidelines

- **Sequence diagrams** (`sequenceDiagram`): For request/response flows across layers
- **Class diagrams** (`classDiagram`): For domain model relationships and aggregate structure
- **ER diagrams** (`erDiagram`): For persistence model relationships
- **Flowcharts** (`flowchart TD`): For decision trees, validation flows, state machines
- **Graph diagrams** (`graph LR` or `graph TD`): For module dependencies, component trees
- Keep node labels short but descriptive
- Use subgraphs to group related nodes by module or layer
- Use dotted lines (`-.->`) for optional/indirect relationships

## Step 4: Write File

1. Write the documentation using the Write tool to `.5/analysis/{name}-analysis.md`.

2. Report to the user:
   ```
   Analysis saved to .5/analysis/{name}-analysis.md

   Sections included:
   - {list of sections that were generated}
   - {N} mermaid diagrams

   Modules analyzed: {list of modules examined}
   ```

## Important Notes

- Read ALL relevant files thoroughly before writing -- do not guess or assume
- Every mermaid diagram must be syntactically valid
- Reference specific class/function names and file paths so the reader can navigate to the source
- Focus on the specific feature/dataflow requested, not the entire codebase
- Follow the data through all layers from entry point to output
- Document both the happy path and notable error/validation paths
