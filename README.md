# CueLight

A small teaching-attention experiment. A learner sees the teaching point worth keeping in view, not a running transcript.

This first slice is a single React + TypeScript application with five text replays and a deterministic, explicitly scripted decision provider. It runs without a microphone, backend, API key, or model call. The scripts demonstrate product behavior; **they do not validate semantic Cue selection**.

## Run it

Use Node 24 or newer and npm. Node 24 is used in CI.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Choose Science, History, Literature, Programming, or Mathematics, then select **Start replay**. Each 16.8-second sample includes filler, a new point, a clarification, and a different point. Pause/continue preserves replay timing. Reset clears evidence, Cues, diagnostics, and replay position. Changing lessons starts a fresh session.

**Show diagnostics** opens the development-only panel. It shows incoming text, rolling evidence, candidate spans, versions, in-flight status, the last decision and whether it was applied/discarded, and Cue provenance. It retains a bounded snapshot, not a growing event log.

```sh
npm run build
npm run preview
```

The production build has the same replay and Cue Engine, without the debug panel or Jev adapter. Fonts use local system fallbacks, so the app makes no external requests. There is no persistence; reloading starts over.

## Runtime and ownership

```text
ReplayEvidenceSource.subscribe(finalFragment)
  → CueEngine.accept(fragment)
  → appendEvidence
  → buildCandidates
  → CueDecisionProvider.decide(snapshot)
  → validate decision + evidence version + session generation
  → applyDecision
  → current Cue / previous Cue
  → CueSurface
```

| Module | Responsibility |
| --- | --- |
| `src/evidence/evidence-buffer.ts` | Immutable snapshots of up to 20 seconds / 32 finalized fragments; version increments on accepted input. |
| `src/candidates/candidate-builder.ts` | Up to four deduplicated, contiguous source spans. No paraphrasing, summarization, NLP, or ontology. |
| `src/decision/` | Provider contract, runtime validation, scripted mock, and server-only Jev adapter. |
| `src/cue/cue-engine.ts` | Evidence intake, a single in-flight request, one dirty bit, version/session guards, diagnostics, and previous-Cue expiry. |
| `src/cue/cue-reducer.ts` | Pure `QUIET`, `NEW_CUE`, and `UPDATE_CURRENT` transitions. |
| `src/replay/` | Timer-driven finalized input and five fixtures with separate, explicit decision scripts. |
| `src/ui/` | Clean learner surface and separately loaded development diagnostics. |
| `src/App.tsx` | Connects one source and provider to one Engine; owns session setup/cleanup and controls. |
| `src/clock.ts` | Injectable clock/timer functions for replay and display timing. |

### Evidence and candidates

Source adapters must deliver unique finalized fragment IDs in chronological `endMs` order with valid nonnegative timestamps and nonempty text. A fragment is limited to 4,096 characters to keep the in-memory bound meaningful; oversized text is rejected rather than rewritten. Adapters should emit shorter finalized fragments. Duplicate IDs in the current window and out-of-order fragments are rejected and diagnosed. IDs must not be reused within a source session.

On append, fragments ending earlier than `latest.endMs - 20_000` are evicted; at most the last 32 are retained. No idle sweep or lesson history is maintained. Each Cue keeps its own selected text and original source IDs even after those source fragments leave the evidence window. With replay fixtures, the IDs identify the original static input. A future live source does not cause the Engine to archive its transcript.

Candidates are the latest one, two, and three adjacent fragments, plus the span from the current Cue's first source fragment through the newest fragment, only while its complete original range remains in the window. Smaller windows yield fewer candidates. Text is preserved exactly, with one space between fragments. Candidate IDs encode the ordered source ID list.

### Decisions, concurrency, and display

`CueDecisionProvider.decide({ evidence, candidates, currentCue })` returns only `QUIET`, `NEW_CUE(candidateId)`, or `UPDATE_CURRENT(candidateId)`. Mock scripts match source ID ranges against actual candidates. Unknown inputs or unavailable script ranges return `QUIET`; scripts cannot inject display text.

Only one decision may be in flight per Engine. Additional evidence sets one dirty bit. A result captured against an older version is discarded, then one request evaluates the newest evidence. There is no per-fragment queue or retry. All snapshots sent to the provider are immutable.

Reset increments a session generation so an old result cannot match a new session's reused evidence version. If a request is pending at reset, the same Engine waits for it to settle before evaluating new evidence. Disposal disconnects the source, clears the expiry timer, and ignores late responses. A future custom provider must settle its promises; the Jev adapter has a hard five-second deadline.

- **QUIET:** the Cue state is unchanged, including object identity. Existing previous-Cue expiry continues.
- **NEW_CUE:** the current Cue becomes previous; the new Cue gets a new identity.
- **UPDATE_CURRENT:** only the current text, provenance, and update timestamp change; identity and creation time remain. Without a current Cue, it behaves as NEW_CUE.
- Previous Cue expires four seconds after moving into that position, independent of speech and subsequent updates. Another NEW_CUE starts a new four-second transition. Current Cue never expires automatically.

Pause stops future source emissions; it does not cancel a pending decision or suspend previous-Cue expiry.

## Jev integration boundary

The adapter follows the [official TypeSafe HTTP API](https://docs.typesafe.ai/api), checked on 2026-09-20:

```text
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <API_KEY>
{ model, state, questions }
```

`src/decision/jev-decision-provider.ts` is server-only and is not imported by the browser app. It defaults to `jev-latest` and supports a configured model and injected transport. A future server caller must read `TYPESAFE_API_KEY` from its environment and pass it to the constructor. Never put credentials in a `VITE_*` variable or the browser.

The request contains one `choice` question with `QUIET` and bounded NEW/UPDATE options for supplied candidates. UPDATE options are omitted when no current Cue exists. The adapter maps a validated `answers.cue.choice` to a local action/ID pair; it never accepts generated Cue text. Confidence and probabilities are schema-validated, not used as product thresholds.

Missing credentials, malformed JSON/schema, unknown options, HTTP/network failures, and the five-second deadline return QUIET. There are no retries. An optional server-side error callback provides diagnostics. The deadline includes response-body parsing and settles even if a test transport ignores abort.

**No real Jev calls have been executed.** All protocol checks use a fake transport and fake credentials. Real model quality, latency, provider account access, and browser-to-server integration remain unverified. Adding a server bridge or live provider selection is intentionally deferred until explicitly authorized.

## Verification

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

`test:e2e` builds production output and starts development/preview servers on ports 5173/4173. `npm run check` runs the complete sequence. On Linux CI, Chromium is installed with `--with-deps`.

Verified locally for this slice:

- TypeScript check and production build passed.
- 48 unit/contract tests passed: evidence bounds, exact contiguous candidates, Cue transitions, expiry, immutable snapshots, stale/coalesced requests, reset/disposal, error recovery, deterministic replay, all five subject scripts, alternate-source compatibility, and Jev fake-transport cases.
- 8 Playwright browser tests passed, including one real-time 16.8-second replay, all five subjects, pause/reset/switching, same-DOM Cue updates, keyboard input, a 390px viewport, and reduced motion.
- Production verification found no debug panel or Jev code in the JavaScript bundle, no external requests, and no browser-storage writes. Reload returned to the initial state.
- Desktop and narrow screenshots were visually inspected. Browser tests write screenshots to `artifacts/`; CI uploads them with failure traces. Generated artifacts are not committed.

CI runs the same checks on pull requests, without model secrets or calls.

## Deliberate limits

This is not closed captioning. Useful screen changes are not guaranteed for every fragment, and the learner never sees incoming transcript just because it arrived. Plain text is displayed verbatim; it may contain speech-like wording. Future formatting belongs between Cue and rendering, not inside decision logic.

There is no live speech/ASR, editable lesson corpus, durable lesson state, concept graph, scheduler, task queue, model-generated text, semantic evaluation benchmark, deployment, or backend. The next product question is whether a real decision provider chooses useful source spans across subjects. The scripted replay does not answer that question.
