---
name: documentation-style
description: How to write documents, Javadoc and code comments. Short plain sentences, one idea each. Use when writing or reviewing comments, doc comments or Markdown.
---

# Communication and Documentation Style

When communicating or documenting anything (a document, JavaDoc, comments in the code, etc.),
write it as short, plain sentences, without jargon, and one idea per sentence.
Never chain multiple ideas into a single sentence with semicolons or em-dashes.
If a comment covers more than one concern (e.g., "why this setup looks odd" vs.
"what this test actually checks"), split it into separate sentences, or separate
paragraphs (blank `//` line) if the concerns are distinct enough. A comment should
read like a short explanation to a colleague, not a dense clause-stacked run-on.

For reference, here's the failure mode it's meant to block, and the fix, so you can sanity-check the wording still points at the right thing:

Bad (what I wrote first):
// These two are the "projected new missions" the mocked projection returns for this saga run;
// they must be move participants (i.e. targets of a movedOrder from sourceMissionId) so the
// reprojector's participant filter keeps them — the hard fail this test exercises is that
// NEITHER has a corresponding entry in newMissionRequest's OWN movedOrders (which target an
// unrelated random MissionId), not that they were pruned as non-participants.

Good (the rewrite):
// These two missions are what the mocked projection returns as the new missions for this run.
// They must be move participants, so give them entries in the stubbed movedOrders as targets
// of sourceMissionId. Otherwise the reprojector's participant filter would prune them, and the
// test would no longer exercise the hard fail it's meant to check.
//
// The hard fail itself comes from something else: newMissionRequest's own movedOrders target
// an unrelated random MissionId, so neither mission has a matching entry there.
