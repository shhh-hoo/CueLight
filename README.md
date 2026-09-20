# CueLight

A small teaching-attention experiment. A learner sees the teaching point worth keeping in view, not a running transcript.

This first slice is a single React + TypeScript application with five text replays and two selectable providers: an explicit scripted demo and Jev through a local server endpoint. The default demo needs no microphone, API key, or model call. The scripts demonstrate product behavior; **they do not validate semantic Cue selection**.

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

The production browser bundle has the same replay and Cue Engine, without the debug panel, upstream Jev adapter, or credentials. Fonts use local system fallbacks. Scripted mode makes no external requests. There is no persistence; reloading starts over.

## Enable Jev locally

1. Copy `.env.example` to `.env.local` and set `TYPESAFE_API_KEY` to your TypeSafe API key. This file is ignored by Git. Never use a `VITE_` prefix for credentials.
2. Optionally set `JEV_MODEL`; the default is `jev-latest`.
3. Restart `npm run dev` (or `npm run preview` after building).
4. Choose **Jev** in **Decision provider**. The page checks local configuration without calling the model. **Start replay** is disabled until a server key is present; configuration readiness does not prove the key is valid.
5. Select **Start replay** to send finalized teaching evidence to Jev using your TypeSafe account. No model request happens merely from opening the app or selecting Jev. Switch back to **Scripted demo** for offline development.

Changing provider starts a fresh session. Reset and provider/lesson changes cancel pending browser requests, propagate disconnect cancellation upstream, and retain the Engine's session/version guards. Provider failures preserve the learner's existing Cue; a service error appears outside the learner surface and the development panel records fallback and latency. There is no automatic fallback to scripted decisions.

The local API is built into Vite's development and preview servers; no extra process is required. It is restricted to local same-origin HTTP requests and is not a public authenticated service. A bare static `dist/` host cannot run Jev; use `npm run preview` for the local built application. Public hosting/authentication is outside this slice.

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
| `src/decision/` | Provider contract, validation, scripted mock, same-origin HTTP client, and server-only Jev adapter. |
| `server/` | Bounded request validation and local Jev endpoints, mounted by `vite.config.ts` in dev and preview. |
| `src/cue/cue-engine.ts` | Evidence intake, a single in-flight request, one dirty bit, version/session guards, diagnostics, and previous-Cue expiry. |
| `src/cue/cue-reducer.ts` | Pure `QUIET`, `NEW_CUE`, and `UPDATE_CURRENT` transitions. |
| `src/replay/` | Timer-driven finalized input and five fixtures with separate, explicit decision scripts. |
| `src/ui/` | Clean learner surface and separately loaded development diagnostics. |
| `src/App.tsx` | Connects one source and selected provider to one Engine; owns session setup/cleanup and controls. |
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

`src/decision/jev-decision-provider.ts` is server-only and is not imported by the browser app. It defaults to `jev-latest` and supports a configured model and injected transport. Vite loads `TYPESAFE_API_KEY` and `JEV_MODEL` from the server environment or `.env.local` and passes them to the local bridge. No key is sent to the browser.

- `GET /api/jev/status` returns only `{ configured, model }`; it does not call TypeSafe.
- `POST /api/jev/decide` accepts the existing `DecisionInput` and returns `{ decision }`. The server validates bounded evidence and current Cue, rebuilds the deterministic candidates, and rejects any mismatch before contacting Jev.
- Requests are limited to 2 MB and same-origin loopback hosts. Malformed input returns 400, missing key 503, and upstream failure 502. Raw upstream errors and credentials are never reflected to the browser. No request history is stored.
- The HTTP provider has a 6.5-second browser deadline; the upstream adapter retains its five-second deadline. HTTP failures are caught by the same Engine and recorded as QUIET fallbacks, not successful semantic QUIET decisions.

The request contains one `choice` question with `QUIET` and bounded NEW/UPDATE options for supplied candidates. Following the `typesafe-ai` skill and the official [source-span selection cookbook](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook), code generates candidates and copies the selected text verbatim. Instructions refer explicitly to `evidence.fragments`, `currentCue`, and `candidates[index].text`; UPDATE criteria explain that the span replaces the whole Cue and must retain needed context. UPDATE options are omitted when no current Cue exists. The adapter maps a validated `answers.cue.choice` to a local action/ID pair; it never accepts generated Cue text. Confidence and probabilities are schema-validated, not used as product thresholds.

Missing credentials, malformed JSON/schema, unknown options, HTTP/network failures, and the five-second deadline return QUIET. There are no retries. An optional server-side error callback provides diagnostics. The deadline includes response-body parsing and settles even if a test transport ignores abort.

**No real Jev calls have been executed during development.** Protocol checks use fake transport and fake credentials; the local HTTP bridge is tested over real loopback HTTP, and browser Jev tests intercept the local decision endpoint. Real model quality, latency, and provider account access remain unverified. Configure your key to use the integration; automated tests never call a model.

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
- 72 unit/contract/HTTP integration tests passed: evidence bounds, exact contiguous candidates, Cue transitions, expiry, stale/coalesced requests, reset/disposal, deterministic replay, five subject scripts, Jev contracts, full replay through real local HTTP → fake upstream → Cue Engine, input validation, cancellation, and error redaction.
- 14 Playwright browser tests passed, including the real-time replay, all five subjects, pause/reset/switching, keyboard/narrow layout, Jev provider selection, missing configuration, HTTP-driven NEW/UPDATE, failure preserving the current Cue, and cancellation on reset/provider switch.
- Production verification found no debug panel or upstream Jev adapter/credentials in the JavaScript bundle, no external requests in scripted mode, and no browser-storage writes. The preview server's local configuration endpoint was also verified. Reload returned to the initial state.
- Desktop and narrow screenshots were visually inspected. Browser tests write screenshots to `artifacts/`; CI uploads them with failure traces. Generated artifacts are not committed.

CI runs the same checks on pull requests, without model secrets or calls.

## Deliberate limits

This is not closed captioning. Useful screen changes are not guaranteed for every fragment, and the learner never sees incoming transcript just because it arrived. Plain text is displayed verbatim; it may contain speech-like wording. Future formatting belongs between Cue and rendering, not inside decision logic.

There is no live speech/ASR, editable lesson corpus, durable lesson state, concept graph, scheduler, task queue, model-generated text, semantic evaluation benchmark, deployment, or standalone backend framework. The next product question is whether Jev chooses useful source spans across subjects. The integration tests establish connectivity behavior, not model quality.
