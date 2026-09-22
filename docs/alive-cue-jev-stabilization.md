# PR #16 — Slice III stabilization

Starting head: `9e171e2a17af74d25fafc9b2c06e399e40a8e075`, on
`feat/alive-cue-v1-jev-proposals`, still stacked on unmerged PR #15.
This repair changes bounded interpretation and scheduling, not the Alive Cue domain,
journal format, single Semantic Acceptance writer, Attention or Presentation.

## Ranking and bounds

Cue order before the eight-Cue bound:

1. Explicit/recalled IDs supplied by Host, preserving their specified order.
2. Current foreground.
3. Cues with accepted MENTION/RECALL occurrences, descending latest occurrence sequence.
4. Semantically revised Cues, descending last semantic acceptance sequence.
5. Other Host-relevant IDs, then remaining open Cues by most recent accepted relevance.
6. Remaining settled Cues by most recent accepted relevance.

The list is deduplicated; withdrawn/nonexistent objects are excluded. Explicit IDs
that cannot fit are reported as missing required context. Recency uses lesson-local
accepted event sequence, not timestamps or reversed object insertion. Ties use Cue ID.
Explicitly relevant and recently used settled objects can rank ahead of remaining
open objects; final settled ordering applies to those not already selected.

Part ranking is derived from full accepted revision history locally, then only the
ranking and current semantic revision cross the HTTP boundary. Explicit Host part
IDs come first. Remaining parts sort by their most recent modification/replacement
or establishment revision; a modification takes precedence over establishment in
the same revision, then composition position breaks ties. An old modification does
not outrank a newly established condition forever. The top **four** are eligible
part targets. This changes candidate priority, never semantic composition order or
historical annotations.

Primary candidates are allocated in three deterministic phases:

- A: every source gets WAIT, NO_CHANGE, and teacher-authorized CREATE.
- B: action rounds over Cue × source for RECALL, teacher-authorized REVISE append,
  WITHDRAW, and RELATION_INTENT (one starting Cue only).
- C: part-rank rounds, then replace/criticise mode, Cue, and source, until capacity.

For three teacher sources, eight Cues and at least four parts each, the bounded
universe is **9 + 96 + 192 = 297** candidates. The provider receives **128**:
all 105 source/Cue choices and the first 23 fairly interleaved part choices. The
other **169** are explicitly omitted; additional parts beyond four are separately
reported. Each source retains all its source/Cue choices and receives part choices.
Later part modes/ranks may be omitted; this is visible candidate coverage loss, not
a promise that every possible edit fits. A mandatory set over 128 returns no
candidates and blocks explicitly. This is unreachable for valid three-source input;
validation also rejects out-of-bound transports.

Existing limits stay at eight Cues, three source alternatives, four part targets,
128 operation choices, 16,000 evidence code units and 48,000 request code units.
A relation inspection has one source, NONE and at most seven targets × five kinds:
**36** choices. No Cue-pair × kind product enters the primary question.

## Suspended evidence and stale work

Pending source and provider eligibility are separate. A session-local bounded
suspension map survives evaluation bursts. A fingerprint includes exact source
range, overlapping processing status/event identity, and matching RoleBinding
identities/revisions. Processing events supply local revision identity without
using the whole fragment's revision to unlock an unrelated subrange. No lesson
sequence, unrelated Cue version, foreground or clock enters this fingerprint.

WAIT is fingerprinted after acceptance. Provider/schema/Host failures are also
suspended, without successful accounting. A matching authority change or changed
processing of that range makes it eligible again. Matching role changes via the
Host entry point can wake eligible work without new speech. Completed ranges are
pruned. Reset/dispose clears scheduling state; evidence and WAIT remain in their
normal semantic history until the existing session reset behavior applies.

Fresh source alternatives are: first legal unit; whole pending range if different;
then individual WAIT-tail + new-unit pairs, newest tail first, capped at three.
A suspended A remains available in A+B even though A alone is ineligible. If B is
understood independently, A is not automatically retried. Two independent tails
are never concatenated together. Omitted alternatives remain visible in coverage.

The map holds at most **256** unresolved fingerprints. It never evicts old entries
into automatic re-eligibility. At capacity, automatic primary inspection stops with
an explicit diagnostic while new evidence is retained; reset or dependency changes
that free entries permit resumption. This fail-closed guard is not a semantic timeout
or permission to discard evidence.

Every proposal binds all provider-visible Cue revisions, relation revisions and
relevant role revisions, plus processing revisions for every supplied source
alternative. Hidden/unseen lesson state is not bound. Attention is bound only for
CREATE/RECALL proposals that actually change foreground. Existing relation endpoint
and authority acceptance rules still apply.

Each primary source-range lineage gets one fresh stale recapture, with a new
inspection identity and explicit parent-inspection link. A and B in one burst each get their own allowance. A second
stale result suspends that lineage. Transport/schema failures get no automatic
semantic retry. The existing 32-step burst cap still applies; old choices are never
textually rebased.

## Relations remain optional

Primary context includes only nonwithdrawn relations whose two endpoints already
fit the selected Cue view. Candidates rank by their latest source's committed
sequence, then relation ID; at most **eight** relations are included. Their provenance
must fit after Cue facts and pending source, within the existing evidence budget.
Optional relations that cannot fit are reported and omitted. No graph closure adds
extra Cues or blocks a clarification merely due to degree.

RELATION_INTENT selects a teacher-authorized source and one existing origin Cue.
Its accepted primary event accounts that interpreted source with **zero Cue content
operations, zero occurrences, and no foreground change**. A separate optional
inspection selects NONE or one target/kind and compiles a normal RELATE proposal.
CREATE/REVISE/RECALL retain their independent explicit-relation-evidence trigger.

Scheduling permits one active and one latest-useful pending relation snapshot.
Another accepted relation intent replaces a pending snapshot with a `superseded`
trace naming its replacement. `queued`, `superseded` and `invalidated` are scheduling
records, not provider attempts. Pending dependencies are checked before starting;
stale pending work is explicitly invalidated rather than silently rebased or lost.
Active responses still pass Semantic Acceptance. Stop invalidates pending work;
reset/disposal invalidates scheduling and prevents late responses from mutating a
new epoch. Primary processing/drain never waits for the relation slot.

## Coverage and observability

Working Set projection reports `contextComplete` and `contextBlocked`; it does not
claim candidate completeness before candidates exist. Context is incomplete when
Cue/evidence/relation context was omitted or required context is blocked. Optional
omissions alone do not block a request.

Candidate construction computes the single final coverage record:

- `contextComplete`: the projection's context coverage.
- `candidateComplete`: no operation, part or source alternatives were truncated.
- `complete`: both flags are true.
- `contextBlocked`: required context is missing/over-budget, or mandatory actions
  cannot fit; optional candidate truncation alone is not blocking.

The provider request, validation and trace diagnostics use these definitions.
Omission counts/ranges remain distinguishable from model choice errors. Unique
provider attempts still count `started` identities only; scheduling events have a
separate diagnostic list.

## Regressions and validation

`src/alive/stabilization.test.ts` adds focused engineering regressions for:

- Ten open Cues with recently revised/mentioned C9 and foreground C10; settled order.
- Six-part targets, explicit parts, and recent establishment after older modifications.
- Three sources/eight Cues at 128 choices, exact omissions, mandatory-overflow blocking.
- Separate tails, omitted alternatives, relation hub degree and oversized provenance.
- Visible comparison Cue, relation version and unused-source races; hidden-Cue isolation.
- WAIT across idle/unrelated Cue changes; resolving A+C while B remains suspended.
- Authority re-eligibility; failure suspension; reset/dispose and suspension capacity.
- Two independent stale lineages and the one-recapture limit under repeated races.
- Relation-only acceptance, one-active/one-pending progress, supersession, stop,
  stale pending withdrawal and reset immunity.

The historical relation-closure test now requires omission instead of budget
overflow. The browser request-shape assertion includes source-omission diagnostics.
Local validation passed typecheck, **301 unit/contract/HTTP tests** (including
**23 new stabilization regressions**), production build, **26 browser tests**, **7 Voice
SDK tests**, and `git diff --check`. Final-head GitHub CI and the frozen SHA are
recorded in PR #16.

Exact files changed from the starting head:

- `src/alive/projection.ts`
- `src/alive/inspection.ts`
- `src/alive/inspection-suspension.ts` (new)
- `src/cue/cue-engine.ts`
- `src/speechmatics/session-diagnostics.ts`
- `src/alive/stabilization.test.ts` (new)
- `src/alive/domain.test.ts`
- `tests/jev.spec.ts`
- `docs/alive-cue-jev-stabilization.md` (new)
- `docs/alive-cue-jev-proposals.md`
- `README.md`

## Deferred behavior and live evaluation

One inspection still proposes one primary realtime semantic change. Legal remaining
subranges can progress sequentially; Jev is not a free-form multi-operation patch
planner. A compound classroom utterance may contain further changes not captured
by its chosen primary interpretation. Raw source and accepted history are retained
for future **Slice VII Background OpenAI semantics**, which must also use bounded
proposals through Semantic Acceptance. This task does not implement that system.

Historical criticised/superseded/corrected/withdrawn wording and `criticised_example`
remain available. Their eventual presentation treatment is deferred. Student adoption
sophistication, student foreground policy and learner models remain deferred; current
teacher-centric authority is preserved. Retrieval and final Attention are unchanged.
Tab-closure durability remains [issue #17](https://github.com/shhh-hoo/CueLight/issues/17).

Mocks establish deterministic contracts. Live evaluation must still establish whether
Jev selects the right primary meaning, Cue, part, continuation and relation under the
bounded option set, including stance/correction and omission cases. Ranking quality,
allocation coverage and latency are still product questions. The existing 12-request
plan remains **unexecuted**; review the frozen head before considering authorization.
No paid Jev/OpenAI/Speechmatics calls, merge or deployment occurred.
