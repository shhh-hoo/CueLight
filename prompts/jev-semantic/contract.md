# Current semantic contract: alive-jev-v1

This describes the behavior at main `316fc43`, preserved by static-string extraction. It is not a proposal for new semantics. Executable boundaries live in [inspection.ts](../../src/alive/inspection.ts), [projection.ts](../../src/alive/projection.ts), [authority.ts](../../src/alive/authority.ts), and [reducer.ts](../../src/alive/reducer.ts).

## Identity and development

A Cue is a persistent lesson-local teaching object with a Host-assigned ID, identity key and semantic revision history. Display windows, shared wording, overlapping source ranges, shared assets and broad topics do not establish identity. CREATE establishes a distinct object. Clarification, completion, an added condition or meaningful extension of the same object uses REVISE/append. A truly distinct object can be created within the same topic. Jev compares supplied identities; Host code does not lexically infer sameness.

REVISE retains identity and advances semantic revision. Replace targets one supplied part ID and preserves unrelated parts/conditions in composition order. Criticise preserves the targeted wording as `criticised_example` with correction establishment evidence. Append retains existing parts. Historical revisions are preserved. WITHDRAW requires direct teacher invalidation and appends withdrawn standing; it is not inferred from topic movement, silence, low confidence or external factual disagreement.

## Incomplete evidence and accounting

WAIT accepts an unresolved processing state, preserving exact evidence for later continuation. NO_CHANGE accounts for evidence actually understood as repetition, filler or administration, without a semantic operation. Missing context and provider/parser/acceptance failures cannot be substituted with NO_CHANGE. Low confidence is recorded, not converted to a different action by a threshold.

A primary inspection chooses one source alternative and one operation. Host exposes legal punctuation-delimited subranges, the whole remaining range when different, and bounded pairings of a prior unresolved tail with new evidence. This mechanical segmentation does not classify teaching meaning. A non-WAIT step must advance accounting; remaining subranges may be inspected sequentially. WAIT/failure suspension and the 32-step burst bound are runtime orchestration constraints, not proof that every compound meaning is captured.

## Recall and attention

RECALL explicitly returns to a supplied existing object without new meaning, records an occurrence and does not advance its semantic revision. Returning with new meaning instead requires an appropriate revision. CREATE and RECALL narrowly select compatibility foreground. Revising offscreen A does not displace foreground B. Jev may target any supplied Cue regardless of display; generated presentation is never semantic evidence.

## Source authority and stance

Host role bindings supply authority using supported capture/channel/speaker scopes, explicit basis and versioned dependencies. A speaker label alone is not teacher authority. The automatic Jev candidate builder offers CREATE, REVISE, WITHDRAW and relation mutations only for fully teacher-authorized source ranges; student/unknown sources receive WAIT/NO_CHANGE and available RECALL targets. They cannot independently authorize asserted factual CREATE/REVISE. Domain adoption requires exact teacher-grounded adoption records; Jev does not create them.

Stance is classified independently for each source: asserted, question, hypothetical, quoted_example or criticised_example. Only the selected source's stance is compiled. Teacher authority does not turn a question into an assertion. The acceptance writer checks source provenance, relevant authority and exact adoption before canonical asserted content or mutations are accepted. Classroom content remains data, never instructions overriding the system.

## Bounded context and omissions

The working set defaults to eight Cues and 16,000 evidence code units. Only current Cue revisions enter requests. Primary inspection offers at most three source alternatives, four part targets per Cue and 128 options; serialized requests are guarded at 48,000 code units. Included relations are bounded to eight and require both endpoints in the view. These bounds are implementation choices, not semantic or token guarantees.

`contextComplete` records whether relevant context was omitted/blocked. `candidateComplete` independently records operation, part and source-alternative omissions and mandatory overflow. `complete` requires both. Compact summaries describe omitted Cue/relation IDs, evidence ranges, parts, alternatives and operations without sending hidden source bodies. Omission from this bounded view is not semantic absence. The wording instructs WAIT when required context/targets are omitted; deterministically known required-context failures block transport and remain unresolved, rather than pretending Jev selected WAIT. Partial but non-blocked context may still be evaluated. Coverage must be inspected before attributing a wrong choice to Jev.

## Relations

Independent relation-evidence Choice can request optional follow-up after accepted CREATE/REVISE/RECALL. A relation-only statement selects RELATION_INTENT and its starting Cue without revising, recalling or changing foreground. The subsequent capture binds accepted origin/target revisions and original evidence. It chooses NONE or one of ELABORATES, EXAMPLE_OF, CONTRASTS_WITH, RECAPS and REFERENCES. Automatic domain causality and adjacency-based inference are excluded. Relation failures cannot roll back a primary acceptance. Relation acceptance never selects foreground. The runtime's bounded optional queue is independent of primary progress.

## Canonical semantic write boundary

Jev returns typed Choice judgments, never arbitrary text patches. Production rebuilds criteria in Host code, validates exact quotes/ranges and provider choices, then `compileProposal` attaches the selected candidate, evidence scope, stance, dependencies, model diagnostics and processing disposition. `LessonStore.accept` is the sole canonical writer, using reducer validation and the accepted-event journal. Session/epoch, authority, freshness, identity, provenance and processing dependencies must hold atomically; stale or rejected proposals do not account evidence. Replaying accepted history makes no provider calls.

The human documents explain this contract. [instructions.ts](instructions.ts) supplies only static executable wording; dynamic state/criteria and acceptance remain production code. No Markdown compiler, alternative interpreter, confidence cutoff, new adoption policy, retrieval, or background repair is introduced.
