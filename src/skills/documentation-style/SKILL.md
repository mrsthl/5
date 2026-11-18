---
name: documentation-style
description: How to write documents, Javadoc and code comments. Short plain sentences, one idea each. Use when writing or reviewing comments, doc comments or Markdown.
---

# Documentation Style

This applies to everything written for people: documents, Markdown files, Javadoc, code comments, and messages to the
developer.

Write short, plain sentences without jargon. Put one idea in each sentence. Never chain several ideas into one sentence
with semicolons or em-dashes.

When a comment covers more than one concern, split it into separate sentences. Use separate paragraphs (a blank `//`
line) when the concerns are distinct enough. A comment reads like a short explanation to a colleague.

Bad:

```java
// These two are the "projected new missions" the mocked projection returns for this saga run;
// they must be move participants (i.e. targets of a movedOrder from sourceMissionId) so the
// reprojector's participant filter keeps them — the hard fail this test exercises is that
// NEITHER has a corresponding entry in newMissionRequest's OWN movedOrders (which target an
// unrelated random MissionId), not that they were pruned as non-participants.
```

Good:

```java
// These two missions are what the mocked projection returns as the new missions for this run.
// They must be move participants, so give them entries in the stubbed movedOrders as targets
// of sourceMissionId. Otherwise, the reprojector's participant filter would prune them, and the
// test would no longer exercise the hard fail it's meant to check.
//
// The hard fail itself comes from something else: newMissionRequest's own movedOrders target
// an unrelated random MissionId, so neither mission has a matching entry there.
```
