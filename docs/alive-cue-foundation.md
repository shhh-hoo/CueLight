# Alive Cue V1 foundation — Slices I and II

## Baseline and question

Implemented from `main` at `e15d73c64a56ecbf1b3a398be39b45796c3f2261`, after PRs #5, #13 and #14 merged. #14 needed a README-only merge resolution; its final head `d9f71350f2477c8f8c1ba98a45d68ba7645789fe` passed local and GitHub checks. Source/provenance validation, Voice SDK evidence, speaker/language propagation, Jev choice diagnostics, source-first rendering, strict text/list/chain schema, atomic replacement and stale-result guards were inspected and preserved.

Product question: can a lesson retain and recover the same instructional objects independently of screen slots? This PR verifies the deterministic machinery with authored fixtures. It does not evaluate model object boundaries, entailment, adoption judgments or classroom usefulness.

Authority is the linked Product Design → Runtime Architecture → Ecosystem documents in README, read in full before edits. Historical implementation is evidence, not a competing product specification.

## One authoritative acceptance path

`LessonStore` owns an append-only `LessonHistory`. `prepareAcceptance`/`reduceAccepted` are pure domain functions. Every captured evidence batch and semantic proposal passes validation, becomes one `AcceptedEvent`, and is persisted before publication. The store's state is an immutable replay projection of that history. No diagnostic trace or generated presentation is a recovery input.

Events preserve identity/sequence, session/epoch, proposal identity/origin, dependency read set, operation group, processing effects, acceptance time, Host-assigned CREATE IDs and resulting versions. Replay checks order, proposal uniqueness and version results; no provider code is imported. A duplicate proposal returns its original event before checking now-stale dependencies. A failed write leaves the published state untouched. If the event was durably written but its acknowledgement failed, exact event identity/content readback recovers it.

The local transaction is synchronous and non-reentrant, from validation through append and publication. The journal also checks the expected append sequence. Per-Cue/relationship/role/deferred/processing/lifecycle dependencies decide semantic conflicts; log sequence orders acceptance, not all semantic work. Unrelated B revisions do not stale a proposal reading A. There is no textual rebase. Background LLM semantic operations are disabled in this slice, and the legacy Jev origin cannot bind roles or establish relations/lifecycle authority.

`types.ts` is the single shared contract: EvidenceRecord (retains EvidenceFragment provider fields), EvidenceBinding, RoleBinding, AssetRef, CueRecord, CueRevision, CueContentPart, CueRelation, ContributionAdoption, DeferredEvidence, SemanticProposal, ReadSet, AcceptedEvent and processing state. Runtime checks live at acceptance, not in parallel client/server schemas.

## Identity, content and lifecycle

CREATE requires a lesson semantic `identityKey` and allocates a Host Cue ID. The key is independent of request/candidate/window identity. Reusing it is rejected; callers must target the existing Cue for recall or revision. Different keys may legitimately use the same exact source. Deterministic code does not infer whether two different supplied keys mean the same teaching object; that bounded semantic judgment belongs to Slice III.

EXTEND adds parts; REVISE explicitly replaces/removes named parts and preserves the rest. Revisions and withdrawal append history. MENTION/RECALL append occurrences without a semantic revision. SETTLE/REOPEN update lifecycle metadata and require its dependency; they do not delete or revise meaning. WITHDRAW appends a non-current standing and removes it from usable display/lookup. Ordinary operations cannot resurrect it. Timers and new Cue creation never settle previous objects.

Content parts carry exact source ranges or selected Asset release/version/digest, establishment evidence, explicit stance, role/adoption references and optional replacement lineage. They are portions of accepted classroom content, not knowledge-graph nodes. Stance stays an extensible string; deterministic fixtures exercise questions, hypotheses, quoted/criticised examples and asserted material. The legacy adapter uses `unclassified` rather than inventing teaching roles. `asserted` parts require sourced teacher authority or exact adoption. Adoption retains student speech, teacher confirmation, adopted/excluded ranges and target parts. Unknown speakers stay unknown; S1/S2 never proves teacher authority.

## Evidence accounting

Provider text and metadata are immutable, including whitespace, source identity, sequence/cycle, source times, receive time, speaker and language. Exact Voice event retransmission is idempotent; changed payloads are rejected. Identical words with different source identities are separate evidence.

Bindings use half-open JavaScript UTF-16 offsets and an exact quote verified against the immutable original. Surrogate-pair splits are rejected. Multiple ranges may cross Finals. No custom VAD or semantic transcript concatenation was added to the adapter; joining selected source spans is a display/request projection only.

Every record has disjoint processing ranges: recorded, wait, accounted or deferred. WAIT is unresolved. NO_CHANGE explicitly accounts understood speech without semantic mutation. ACCOUNT applies to the exact understood ranges selected by the accepted proposal. Processing revisions prevent competing consumption; accounted ranges cannot be consumed again. Grounding/recall does not touch processing, so an accounted source can ground another distinct Cue.

DeferredEvidence stores only exact unresolved ranges, a reason, related Cue IDs and resolution state. It lets later independent sources proceed. Resolution is explicit and version checked. `closed_incomplete` preserves incompleteness and does not claim understanding. No Stage/Core machinery or timer-driven completion exists.

## Projections and compatibility

`projectDisplay` derives the existing source `Cue` current/previous shape. Previous expires after four seconds as a view policy; canonical records survive. It preserves unchanged object references for the existing React/presentation contracts. `projectEvidenceWindow` derives the old bounded evidence window from full lesson evidence, including after recovery.

`semanticWorkingSet` is a pure request projection containing pending evidence, open tail, explicit/recalled objects, relevant open and recently settled objects, relations and required endpoints, role/adoption context, teacher attention, read versions and coverage/omissions. Required content is never truncated into a purportedly complete request: missing/oversized required context is marked `contextBlocked`. The initial budgets (8 Cues, 16,000 source code units) are adjustable implementation starting points, not product/semantic boundaries. `lookupLessonCues` performs deterministic lesson-local ID/key/text lookup with original parts; it does not query a Domain Pack or classify topics.

The current structured-v3 request/prompt/options remain unchanged. Its adapter maps:

| Old surface/action | Transitional behavior |
| --- | --- |
| `currentCue` | Accepted lesson record projected into the display slot |
| `NEW_CUE` | CREATE plus foreground selection; exact re-selection of the same source identity becomes RECALL |
| `UPDATE_CURRENT` | REVISE the whole legacy source part; unchanged source selection becomes MENTION; no current Cue falls back to CREATE |
| successful `QUIET` | Keep display and WAIT on pending inspected evidence; not automatically NO_CHANGE |
| failed/invalid/stale provider result | No semantic acceptance or successful accounting |

v3 has no multi-object identity key, stance, part targeting or explicit processing disposition. It cannot safely resolve every overlapping-window semantic duplicate. The foundation requires stable keys and preserves exact re-selections; Slice III must judge identity/novelty across differently worded/windows of evidence. No lexical topic classifier is substituted. Canonical Host CREATE can establish multiple distinct objects from identical source ranges; v3 cannot disambiguate that case itself.

Presentation V1's model, prompt, grammar and API are unchanged. It still schedules only the current Cue in this slice. `matchesCueRevision` checks semantic validity independently of foreground; the controller's `canPublish` separately requires the display target. Source recovery uses the captured request for ordinary Jev results and canonical original records for explicit recall. Partial-span/asset content that cannot satisfy the unchanged whole-Final presentation input stays source fallback. Generated text is absent from evidence, revisions, accepted history and Jev requests. Non-current jobs remain deferred.

## Persistence choice and limits

The browser journal uses versioned **sessionStorage**, with one synchronous JS writer per tab and atomic `setItem` replacement. This avoids claiming that a localStorage check/write pair is a cross-tab transaction. It retains all accepted source text/events across reload in that tab. It does not survive tab closure, sync devices, or promise unbounded lesson capacity. Quota/write errors fail closed and remain visible; no silently accepted in-memory fallback. Each append currently rewrites the journal, so larger lessons need a measured IndexedDB migration before claiming long-session capacity. No retention days, server database or background service was introduced.

Tests/CLI may explicitly use `memoryJournal`. Browser App and microphone instantiate `browserJournal`. `LessonStore.export()`/`CueEngine.exportLesson()` return portable JSON, `replayLesson(history)` restores state without calls, and `LessonStore.delete()` removes the journal and blocks late writes. Reload does not automatically resume capture, model calls or old UI interventions. The UI starts a new session, while prior tab journals remain available for explicit recovery. A teacher-facing history/export/delete control belongs to the later teacher surface; no new learner design is introduced here. In-process Engine reset advances epoch; browser UI reset creates a fresh persisted runtime.

## Verification map and changed regressions

- `src/alive/domain.test.ts`: identity/lifecycle, partial revisions, duplicate identity/proposal, source identity, UTF-16 and cross-Final grounding, WAIT/NO_CHANGE/defer, shared source without double accounting, per-object conflicts, storage failure, lost acknowledgement, deterministic races, relations, roles/partial adoption, replay and coverage.
- `src/alive/fixtures.ts`: CREATE A → EXTEND A → CREATE B → RECALL A → REVISE A, plus one source grounding two distinct objects. Each fixture produces serializable accepted history.
- `src/cue/cue-engine.test.ts`: complete evidence and departed Cues survive window eviction; provider failures stay unresolved; retransmissions do not rerun Jev.
- Existing `cue-reducer.test.ts` cases migrated through the real writer/projection. The production slot reducer was removed to avoid a second semantic owner. QUIET display, in-place UPDATE, NEW/previous, expiry and invalid candidates are still tested; expiry now also proves the Cue remains in lesson history.
- `segment-adapter.test.ts`: replaces repeated-event rejection with exact retransmission idempotency; changed payload and malformed batch rejection remain.
- `tests/production.spec.ts`: replaces the obsolete zero-storage invariant with a versioned source-only tab journal; retains no credentials, diagnostics, external model calls and no automatic UI resumption on reload.
- `tests/alive.spec.ts`: actual UI → persisted journal → reload/replay and storage failure before publication.
- Existing Presentation V1 regressions retained; an additional assertion excludes generated text from exported semantic history.

Full unit/HTTP/browser/Voice checks use mocks and synthetic audio. No paid Jev, OpenAI or Speechmatics evaluation is part of this PR.

## Deferred / next slice

Next: Slice III, bounded redesigned Jev proposals over this authoritative state and Working Set, with explicit processing completeness, stable identity targeting and typed part operations. Then Domain Pack recognition/enrichment, teacher attention/controls, non-current artifact jobs and background semantic policy qualification. Automatic relationship inference, split/merge, external factual correction, cross-course memory, mastery, graph/vector stores, CMS/Foundry integration, new presentation forms and deployment are outside this PR.

## Pre-Slice III corrections (separate stacked commit)

Base: PR #15 `2b6825a24435f708fc128ca687b80d099b3e52b9`; main at audit:
`e15d73c64a56ecbf1b3a398be39b45796c3f2261`. PR #15 remains unmerged.

- Role subjects support speaker, configured capture, or input channel. Capture/channel
  bindings may cover the configured subject before any Final arrives (`sourceRanges: []`);
  explicit nonempty ranges narrow authority. Provider speaker labels grant nothing by
  themselves. Conflicting applicable roles fail closed. Host/teacher alone bind roles;
  all authority use reads the current binding revision. Legacy speaker bindings remain
  readable without a history migration.
- Replacing/removing asserted or teacher-grounded parts requires a teacher-grounded
  correction basis. Withdrawing such a Cue requires teacher-grounded withdrawal basis.
  Existing adoption remains available for asserting precisely adopted source; it does
  not independently authorize deleting established semantics. Classroom-domain relations
  require teacher evidence and role dependencies as well as exact endpoint revisions.
- REVISE anchors replacements at their earliest replaced position, preserving surviving
  order. Disjoint replacements sort by those original positions regardless of proposal
  array order. New parts append in proposal order. Removal closes gaps. Overlapping
  replacement groups are rejected as ambiguous; EXTEND cannot replace parts.
- Proposal retries compare the complete proposal payload, ignoring object-key insertion
  order but preserving array order. Changed payloads fail before any write, also on reload.

Focused regressions: `src/alive/foundation-fixes.test.ts`; existing identity replay now
asserts definition-before-condition composition instead of incidental append order.
No retrieval, provider-contract change, UI redesign, or persistence backend migration
is part of this correction commit.
