# Alive Cue V1 Slice III — Jev semantic proposals

## Baseline and authority

Stacked on unmerged PR #15, branch `feat/alive-cue-v1-foundation`, exact head
`2b6825a24435f708fc128ca687b80d099b3e52b9`. Main at task start:
`e15d73c64a56ecbf1b3a398be39b45796c3f2261`.

Read the canonical Product Design, Runtime Architecture (especially §§7–9, 14,
19–21), and Ecosystem documents linked in the README. Official TypeSafe docs
were read on 2026-09-22: [state](https://docs.typesafe.ai/concepts/state),
[choice](https://docs.typesafe.ai/primitives/choice), [noul](https://docs.typesafe.ai/primitives/noul),
[score](https://docs.typesafe.ai/primitives/score), [confidence](https://docs.typesafe.ai/confidence),
[HTTP API](https://docs.typesafe.ai/api), [JS SDK](https://docs.typesafe.ai/sdk/javascript),
and [pre-parsed value selection](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook).

Installed Jev SDK: **none**. Both old and new adapters use HTTP API
`POST https://api.typesafe.ai/v1/systemone`. The baseline provider contract was
`structured-v3` with `QUIET / NEW_CUE / UPDATE_CURRENT`. The live product now
uses `alive-jev-v1`. Default model remains `jev-latest`, timeout 5,000 ms;
requested and returned model names are recorded separately. No paid provider calls
or deployment were performed. Mock tests prove contracts, not Jev semantic quality.

## Foundation-only diff

- `8c69d32`: capture/channel authority; mutation/withdrawal and classroom-domain
  relation authority; deterministic replacement positions; proposal-payload identity.
- `dd3659a`: closes the same mutation-authority gap for appending student content
  to teacher-established Cues. It is a three-line correction plus a negative case,
  committed separately from Slice III.

The first checkpoint passed typecheck, 241 unit/contract tests, production build,
26 browser tests and seven Voice SDK tests; GitHub CI run 35629893495 passed.
The authority follow-up also passed GitHub CI run 35631981478. PR #15 remains
untouched and unmerged. See `alive-cue-foundation.md` for the exact foundation policies.

Narrow foundation audit: current/previous are projections; accepted events and
replay are authoritative; identities survive foreground/window changes; lesson-local
lookup recovers old Cues; presentation never enters evidence; one source may ground
several Cues without duplicate accounting; per-object readSets isolate unrelated
writes; LessonJournal is backend-independent. No additional blocking redesign was needed.

See [the stabilization contract](alive-cue-jev-stabilization.md) for the final bounded
ranking, suspension, dependency, coverage and relation scheduling rules.

## Request decomposition

One primary Choice chooses a fully grounded operation candidate. IDs, source spans,
target revision, part and permitted operation come from Host code. Human-readable
source and complete current meanings/parts appear once in state and options refer
to their short aliases, avoiding repeated transcript text in every criterion.

Independent Choice questions classify the stance of EACH supplied source candidate
and whether source contains explicit new relationship evidence. They do not depend
on the chosen operation or on sibling answers. The compiler consumes only the
selected source's stance. Stance distinguishes assertions, questions, hypotheticals,
quoted examples and criticised examples. These questions avoid multiplying every
operation/part option by every stance or relation.

Primary actions: WAIT, NO_CHANGE, CREATE, REVISE (append / replace one part /
mark a part as criticised), RECALL, WITHDRAW, and RELATION_INTENT (select an origin
for optional relation-only interpretation; no Cue mutation or foreground effect). Local correction never replaces
untouched conditions. WITHDRAW is a teacher-grounded conditional option whose
rubric requires direct classroom invalidation; semantic entailment remains a Jev
judgment requiring live qualification, not a lexical Host classifier. Student and
unknown sources have WAIT/NO_CHANGE/RECALL, with no automatic assertion, correction,
withdrawal or adoption. Existing explicit adoption remains in the domain contract.

SETTLE/REOPEN inference is deferred. There is no timer/topic-change auto-settlement,
retrieval, split/merge, background repair, or free-form patch/text generation.

## Bounds and coverage

Reuse PR #15's projection defaults: eight Cues and 16,000 evidence code units.
Only current Cue revisions are transported, never full revision history. Source
candidates include the first punctuation-delimited legal subrange, the whole
remaining pending range if different, then separate alternatives pairing ONE prior
open tail with the new unit. Independent tails are never pre-merged. There are at most three sources, four replaceable part targets per
Cue and 128 primary options. The provider body has a 48,000-code-unit guard.
These are explicit initial bounds, not validated semantic or token thresholds.

Coverage records missing/omitted Cue IDs, relations, evidence, part targets, operation
options and source alternatives. Context and candidate completeness are separate;
overall completeness requires both. Provider coverage carries bounded omission summaries
without copying omitted transcript bodies. Missing required context blocks the call
and remains unresolved. A correct target absent from candidates is a coverage
failure; an evaluator may attribute a wrong choice to the model only after inspecting
candidate coverage. The runtime does not claim to know semantic ground truth.

Server validation checks exact original quotes/code-point boundaries, metadata,
role/version context, source eligibility and request bounds, then reconstructs
options and instructions. It never accepts browser-generated prompts or patches.

## Compilation, acceptance, accounting

The compiler attaches proposal/inspection identity, session/epoch, origin `jev`,
contract and acceptance-policy versions, selected grounded candidate, evidence
scope, processing disposition, provider probabilities/confidence, model identity
and the provider-visible Cue, relation, role and supplied-source processing dependencies. The existing LessonStore is the only writer.

CREATE uses a new Host identity; REVISE preserves identity and unaffected parts;
RECALL appends occurrence without advancing semanticRevision; WITHDRAW appends
withdrawn standing. Accepted events/replay retain the exact source and judgment.
Retries with identical proposal payloads return the original event; changed payloads
fail. A stale primary lineage gets at most one fresh recapture, never textual rebasing.
Separate primary source lineages have separate allowances.

WAIT is an accepted unresolved processing state. NO_CHANGE means understood without
semantic mutation. Failures do not account anything. Transport, timeout, HTTP,
malformed response, invalid choice, cancellation, Host rejection, stale dependencies
and coverage blocking remain distinguishable. Low confidence is recorded verbatim;
there are no automatic confidence thresholds or silent provider retries.

After each accepted non-WAIT primary step, accounting must strictly increase.
Another bounded inspection may process the remainder of a Final. WAIT/failure
ranges are suspended across bursts until their own processing or matching role
dependencies change. Fresh evidence can offer a separate continuation alternative;
it does not unlock unchanged tails for standalone inspection.
Independent later evidence can advance while an earlier tail remains unresolved.
A burst is capped at 32 primary steps; exhaustion is visible and retains pending
source. Already-accounted evidence can still ground a later explicit domain operation
without becoming a new processing step.

## Optional relations and compatibility

After accepting CREATE/REVISE/RECALL, an explicit relationship-evidence judgment
can request the optional second inspection. RELATION_INTENT can request it directly
for a relation-only statement without a content mutation or recall. It captures accepted endpoint revisions
and its own proposal/readSet/evidence. Allowed choices are NONE, ELABORATES,
EXAMPLE_OF, CONTRASTS_WITH, RECAPS and REFERENCES. Automatic CAUSES/DEPENDS_ON is
not enabled here. Domain APIs still require teacher grounding for classroom-domain
relations. A relation failure/stale result cannot roll back creation, and relation
acceptance never selects foreground. There is one active relation slot plus one latest-useful pending snapshot.
Superseded/stale/stopped pending work is explicitly diagnosed; primary work never
waits for it. New optional work stops during drain.

CREATE and RECALL narrowly select compatibility foreground. A REVISE to offscreen
A leaves B foreground; a current revision refreshes in place. Display never decides
semantic validity. Presentation V1 remains source-first, current-only in scheduling,
and separately version-checked; partial subranges that its whole-Final input cannot
represent retain source fallback. No presentation redesign is included.

The old v3 endpoint/provider and historical replay CLI are explicitly quarantined
for reproducing old experiments. The live microphone and Jev text-replay paths use
only the new provider; the offline scripted demo retains its display terms through
the existing acceptance adapter. No second semantic state owner was added.

## Observability and regressions

Diagnostic schema 4 records build revision (with `-dirty` when applicable), capture,
source ranges, Working Set, candidates and omissions, exact request/config when
known, probabilities, compiled proposal, acceptance/rejection, resulting versions,
relation parent identity and foreground consequence. Started attempts and final
traces share an ID; mirrors are not counted as new calls. Reset/disposal can leave
a started attempt without an accepted outcome; replay makes zero provider calls.

Focused tests are in `src/alive/inspection.test.ts` and `server/semantic-jev.test.ts`.
They cover all primary actions; conditions and old-Cue revision/recall; two selectable
Cues; stale roles/revisions and unrelated writes; omitted candidates/parts/context;
identical asset/wording and shared grounding; malformed ranges/choices, transport and
timeout failure; idempotency; exact low-confidence metadata; two-unit Finals including
Chinese punctuation; WAIT continuation/independent progress; optional relation NONE,
provenance, staleness and foreground isolation; the real same-origin HTTP boundary.

Frozen literature sequences cover Insight development, distinct Darcy observation
and theme, Complexity facets, Beloved's simplistic analysis becoming a criticised
example before a stronger analysis, and closing recall. These are authored contract
fixtures, not semantic benchmarks or evidence of live-model correctness.

Existing browser tests now mock the new contract and retain identity, microphone
capture/stop/reset, source-first presentation, cancellation, narrow layout and
production isolation checks. One batched Voice event can now cause more than one
semantic step; tests no longer equate a provider Final with one permanent decision.

Initial Slice III validation passed: typecheck, 278 unit/contract/HTTP tests, production
build, 26 browser tests, seven Voice SDK tests and the whitespace/diff check. The
32/33-unit boundary tests verify that inspection stops at its bound and reports
exhaustion only when eligible source remains. Final-commit CI is linked in the PR.

One inspection still selects one primary operation. Multiple punctuation subranges
may advance sequentially, but a compound utterance can contain additional semantic
changes that realtime Jev misses. Raw evidence and accepted history are preserved;
future Slice VII Background OpenAI semantics may reread them and submit bounded
proposals through the same writer. That system, richer student adoption/attention,
and historical annotation presentation are deliberately unimplemented. Criticised,
corrected, superseded and withdrawn historical wording is not erased.

## Explicit remaining work

Tab-scoped sessionStorage still does not survive tab closure. Durable local
persistence before integrated V1 qualification is tracked in
[issue #17](https://github.com/shhh-hoo/CueLight/issues/17). No backend migration here.

Next implementation slice: IV, Retrieval integration, once this stack is reviewed.
Before semantic-quality claims or any paid run, separately approve the exact small
[live evaluation plan](alive-cue-jev-live-plan.md). Attention V, non-current background
artifacts VI and background semantics VII remain separate.

## Final self-check

- `currentCue` is absent from the new provider ontology; NEW is not topic shift.
- Old Cue/part targets are explicit; recall preserves identity; offscreen revision
  does not take foreground.
- WAIT retains exact unresolved ranges and independent later input can proceed.
- NO_CHANGE consumes only selected, interpreted ranges. Provider errors cannot
  become semantic silence or successful accounting.
- Coverage gaps, source omissions and Host rejections remain separate from model
  choice error; relation work neither blocks creation nor drives foreground.
- Every mutation uses Semantic Acceptance; generated presentation is not evidence.
- Multi-unit progression is monotonic and bounded; no retrieval, UI redesign,
  semantic repair or storage-backend work slipped into this slice.
