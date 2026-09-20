# CueLight

A small teaching-attention experiment. A learner sees the teaching point worth keeping in view, not a running transcript.

The React + TypeScript application supports microphone input through Speechmatics Realtime and five text replays. Text replay offers an explicit scripted demo or Jev through a local server endpoint; microphone mode uses Jev. Both Jev browser modes offer optional, non-blocking OpenAI text refinement, off by default. A browser-free runner also replays longer source transcripts through the same Engine. The default demo needs no microphone, API key, or model call. The scripts demonstrate product behavior; **they do not validate semantic Cue selection**.

## Run it

Use Node 24 or newer and npm. Node 24 is used in CI.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Choose Science, History, Literature, Programming, or Mathematics, then select **Start replay**. Each 16.8-second sample includes filler, a new point, a clarification, and a different point. Pause/continue preserves replay timing. Reset clears evidence, Cues, diagnostics, and replay position. Changing lessons starts a fresh session.

**Show diagnostics** opens the development-only panel. It shows incoming text, rolling evidence, candidate spans, versions, in-flight status, the last decision and whether it was applied/discarded, and Cue provenance. Microphone and Jev text-replay sessions additionally retain an in-memory diagnostic journal that you can explicitly download before resetting or switching sources. Scripted replay retains its bounded snapshot.

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

Jev always uses **structured-v3**. There is no context selector or older-context implementation. Remove old `JEV_CONTEXT_VERSION` settings from local configuration: an unset/empty value or `structured-v3` is accepted; any other value stops startup or replay with an explicit error.

## Use the microphone

1. In this checkout's ignored `.env.local`, set both `TYPESAFE_API_KEY` and `SPEECHMATICS_API_KEY`. Keep both server-only, without a `VITE_` prefix. Do not overwrite an existing configuration file. `JEV_MODEL=jev-latest` is optional.
2. Run `npm ci`, then `npm run dev`. For the built local app, run `npm run build` and `npm run preview`. A static file host cannot mint credentials or serve Jev decisions.
3. Open Vite's loopback URL in a browser supporting microphone capture, AudioContext, AudioWorklet and module Workers. Select **Microphone** in **Input source**. Configuration checks do not call either paid provider and do not validate the keys.
4. Click **Start microphone**, allow microphone access, and wait for **Microphone live · you can speak now**. Audio captured while connecting is not sent. Speechmatics receives audio directly from the browser; finalized text goes to the existing Jev V3 decision pipeline. Starting uses your Speechmatics and TypeSafe accounts.
5. Click **Stop microphone** to release the microphone and finish pending results. Wait for **Session stopped**. Reset, changing source, or leaving the page cancels immediately instead of draining. Reconnect and **Start new session** start fresh evidence, Cue state and audio timestamps; they do not resume the old session.

Only Speechmatics `AddTranscript` events enter the Engine. Partials are disabled and ignored; no silence/EndOfUtterance trigger, semantic splitting or transcription rewriting is added. Natural Final boundaries are retained. Seconds become source milliseconds; session UUIDs and receive sequence numbers identify fragments. Identical source times plus identical text identify duplicate deliveries; the same text spoken at later times remains new evidence. Empty Finals are skipped; invalid, out-of-order or over-4096-character Finals are visibly diagnosed without truncation.

The pinned official SDKs are `@speechmatics/browser-audio-input@2.0.4` (PCMRecorder and its bundled AudioWorklet) and `@speechmatics/real-time-client@8.5.1`. Audio is mono `pcm_f32le` at the actual AudioContext sample rate. A per-session Worker owns the realtime SDK connection, providing a hard cancellation boundary because this SDK version has no public force-close method. Audio sending does not await Jev; Final intake retains the Engine's existing bounded coalescing behavior.

The fixed initial transcription configuration is `language: cmn_en`, `model: enhanced`, `max_delay: 2`, `max_delay_mode: flexible`, and `enable_partials: false`, using `wss://global.rt.speechmatics.com/v2`. This favors readable Mandarin/English transcription with moderate delay. Flexible formatting can wait longer for entities such as numbers; two seconds is not a speech-to-Cue guarantee. See the official [languages](https://docs.speechmatics.com/speech-to-text/languages), [models](https://docs.speechmatics.com/speech-to-text/models), [audio input](https://docs.speechmatics.com/speech-to-text/realtime/input), and [latency documentation](https://docs.speechmatics.com/speech-to-text/realtime/output), checked on 2026-09-20.

The local `GET /api/speechmatics/status` exposes only readiness. `POST /api/speechmatics/token` requires a loopback Host, an explicit matching Origin, JSON content type and an empty object, with a 1 KB body limit. It mints a 60-second realtime JWT using the server key, with a five-second deadline, no CORS access and no caching. Provider errors are not reflected. JWTs stay in session memory and are excluded from diagnostic records and browser storage. See [official temporary-key authentication](https://docs.speechmatics.com/get-started/authentication).

Normal stop waits for acknowledgements of all delivered audio blocks before the SDK sends EndOfStream, then accepts trailing Finals until EndOfTranscript. The ASR drain is bounded to ten seconds, followed by up to fourteen seconds for the current and coalesced Jev decisions. A timeout reports an incomplete session and retains the existing Cue. Source failures and Jev failures appear outside the learner surface; neither is presented as a successful semantic QUIET. See the [realtime protocol](https://docs.speechmatics.com/api-ref/realtime-transcription-websocket).

In development, **Show diagnostics → Export session diagnostics** downloads JSON containing Final originals/times, accepted fragments, request candidates, Jev actions and Cue application outcomes. Its top-level `fragments` work with the existing transcript replay runner. No database, automatic upload, raw audio recording or browser-storage persistence is added. Reset/source changes discard the in-memory journal, so export first if needed.

Diagnostic `atMonoMs` values use main-thread `performance.now()`; Final receipt means delivery of the SDK event to the source adapter. Audio source times remain a separate timeline. No audio-to-local-clock mapping, audio-end-to-Final latency, browser paint measurement, or inference that a Final ends a complete teaching point is claimed. Diagnostic logging failures do not change decisions and mark the export `recordingFailed`.

**Validation status:** the microphone integration is implemented, but a real Speechmatics session and the user's actual teaching experience have not been verified. Development-page loading, missing-configuration controls and loading the official AudioWorklet in a real browser were checked. Further testing was deferred at the user's request; no new simulated microphone/Speechmatics tests are included. Natural Final granularity, candidate coverage, missed/jumping Cues, corrections and perceived delay remain product observations for real use.

## Browser-free transcript replay

This runner remains Jev-only. Enabling OpenAI in the browser or setting `OPENAI_API_KEY` does not add refinement calls to this CLI.

```sh
# Offline plumbing check; never calls a model.
npm run replay -- --input /path/to/transcript-map.json --to 65000 --out artifacts/offline-check

# Optional live use with an existing TypeSafe configuration; incurs provider usage.
npm run replay -- --input /path/to/transcript-map.json --live --env-dir /path/to/existing/config --to 65000 --out artifacts/new-run
```

Supply a local JSON source with `--input`; the runner does not depend on evaluation materials being present in the repository. Its `fragments` array contains `{ id, text, startMs, endMs }` records. Captions become available only at their original end times; user/assistant annotations and future text are excluded from requests. The runner uses the production Cue Engine, candidates and V3 provider. It writes Markdown, JSON and JSONL with source provenance, actual requests/decisions, context/model/code identity, token usage when returned, and timing. Existing output names cannot be overwritten. Generated outputs belong in the ignored `artifacts/` directory.

`--from` and `--to` use source milliseconds; without `--to`, replay continues through the final input fragment. The default `--mode semantic` waits for each decision; `--mode paced` follows original caption end times at 1×. `--prefix-run /path/to/run.json` (also `.json.gz`) reconstructs prior Cue state from recorded decisions strictly before the range, without model calls during that prefix. It requires the same source and semantic mode; wall-clock timestamps are recreated. New decisions always use V3. The old `--context` argument is no longer accepted.

Provider request duration and source-ready-to-Cue-state publication are measured separately. Publication is an Engine-state proxy: browser paint, speech completion, ASR finalization, Speechmatics latency, refinement latency and perceived reading latency are not measured. Fast semantic replay does not establish real-time arrival behavior. The summary counts `failures` independently of decision outcomes. A completed run with any failure or fallback exits nonzero after writing its report, even if the failed decision was discarded; also inspect `interrupted` and `accepted`. Three consecutive failures stop the run; there are no automatic retries.

**Product evaluation is unfinished.** Source materials, user/assistant annotations, segment definitions, reports, run outputs and follow-up notes are maintained as local working material outside the PR. Earlier runs remain available in the handoff archive and [checkpoint b793fec](https://github.com/shhh-hoo/CueLight/tree/b793fec6972c290bc28a5471144be6c7f7783f68/evaluation). Local copies under `evaluation/` are ignored. The replay tool and its deterministic tests remain versioned. No new paid evaluation was run to adopt V3.

## Runtime and ownership

```text
ReplayEvidenceSource / SpeechmaticsEvidenceSource.subscribe(finalFragment)
  → CueEngine.accept(fragment)
  → appendEvidence
  → buildCandidates
  → CueDecisionProvider.decide(snapshot)
  → validate decision + session/current Cue + bounded append-only freshness
  → applyDecision
  → current Cue / previous Cue
  → CueSurface
```

| Module | Responsibility |
| --- | --- |
| `src/evidence/evidence-buffer.ts` | Immutable snapshots of up to 20 seconds / 32 finalized fragments; version increments on accepted input. |
| `src/candidates/candidate-builder.ts` | Up to four deduplicated, contiguous source spans. No paraphrasing, summarization, NLP, or ontology. |
| `src/decision/` | Provider contract, validation, scripted mock, same-origin HTTP client, and server-only Jev adapter. |
| `server/` | Bounded request validation, local Jev endpoints and Speechmatics token minting, mounted by `vite.config.ts` in dev and preview. |
| `src/speechmatics/` | Official browser audio/SDK connection, natural Final adapter, source lifecycle and development session diagnostics. |
| `src/refinement/` | Optional same-revision display refinement; separate presentation state, bounded scheduling and local HTTP client. |
| `src/cue/cue-engine.ts` | Evidence intake, a single in-flight request, one dirty bit, version/session guards, diagnostics, and previous-Cue expiry. |
| `src/cue/cue-reducer.ts` | Pure `QUIET`, `NEW_CUE`, and `UPDATE_CURRENT` transitions. |
| `src/replay/` | Timer-driven finalized input and five fixtures with separate, explicit decision scripts. |
| `src/ui/` | Clean learner surface and separately loaded development diagnostics. |
| `src/App.tsx` | Connects one source and selected provider to one Engine; owns session setup/cleanup and controls. |
| `src/clock.ts` | Injectable clock/timer functions for replay and display timing. |

### Evidence and candidates

Source adapters must deliver unique finalized fragment IDs in chronological `endMs` order with valid nonnegative timestamps and nonempty text. A fragment is limited to 4,096 characters to keep the in-memory bound meaningful; oversized text is rejected and diagnosed rather than rewritten or split. Duplicate IDs in the current window and out-of-order fragments are rejected and diagnosed. IDs must not be reused within a source session.

On append, fragments ending earlier than `latest.endMs - 20_000` are evicted; at most the last 32 are retained. No idle sweep or lesson history is maintained by the Engine. Each Cue keeps its own selected text and original source IDs even after those source fragments leave the evidence window. With replay fixtures, the IDs identify the original static input. Microphone development diagnostics separately retain session records in memory for explicit export.

Candidates are the latest one, two, and three adjacent fragments, plus the span from the current Cue's first source fragment through the newest fragment, only while its complete original range remains in the window. Smaller windows yield fewer candidates. Text is preserved exactly, with one space between fragments. Candidate IDs encode the ordered source ID list.

### Decisions, concurrency, and display

`CueDecisionProvider.decide({ evidence, candidates, currentCue })` returns only `QUIET`, `NEW_CUE(candidateId)`, or `UPDATE_CURRENT(candidateId)`. Mock scripts match source ID ranges against actual candidates. Unknown inputs or unavailable script ranges return `QUIET`; scripts cannot inject display text.

Only one decision may be in flight per Engine. Additional evidence sets one dirty bit. A result can apply after new evidence arrives if the session and current Cue still match, request age and source-time advancement are each at most five seconds, and all selected source fragments remain in the evidence window. Rejections record a reason. Candidates are rebuilt after an accepted mutation, then one coalesced request evaluates the latest evidence. There is no per-fragment queue or retry. All snapshots sent to the provider are immutable.

These temporal/source bounds allow progress; they do not recognize semantic freshness. Newer speech can correct or invalidate a statement, or change topic, inside the five-second interval. A temporarily outdated Cue can therefore appear before the follow-up decision. Semantic freshness remains an open product requirement.

Reset increments a session generation so an old result cannot match a new session's reused evidence version. If a request is pending at reset, the same Engine waits for it to settle before evaluating new evidence. Disposal disconnects the source, clears the expiry timer, and ignores late responses. A future custom provider must settle its promises; the Jev adapter has a hard five-second deadline.

- **QUIET:** the Cue state is unchanged, including object identity. Existing previous-Cue expiry continues.
- **NEW_CUE:** the current Cue becomes previous; the new Cue gets a new identity and `sourceRevision: 1`.
- **UPDATE_CURRENT:** the current source text, provenance and update timestamp change, and `sourceRevision` increments; identity and creation time remain. Without a current Cue, it behaves as NEW_CUE.
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

The V3 request contains one `choice` question with `QUIET` and bounded NEW/UPDATE options for supplied candidates. Following the `typesafe-ai` skill and the official [source-span selection cookbook](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook), code generates candidates and copies the selected text verbatim. State separates latest speech, background, current Cue provenance and candidate source overlap. Instructions and criteria use [backticked field paths](https://docs.typesafe.ai/primitives#reference-specific-fields), such as `latestInput.text`, `backgroundEvidence`, `currentCue.text` and `candidates[0].text`. With no current Cue, nested current-Cue references and UPDATE options are omitted. UPDATE replaces the whole Cue and must retain needed context. The adapter maps a validated `answers.cue.choice` to a local action/ID pair; it never accepts generated Cue text. Confidence and probabilities are schema-validated, not used as product thresholds.

Missing credentials, malformed JSON/schema, unknown options, HTTP/network failures, and the five-second deadline return QUIET. There are no retries. An optional server-side error callback provides diagnostics. The deadline includes response-body parsing and settles even if a test transport ignores abort.

**Historical live evaluations made 940 Jev decisions with 3 fallbacks.** Their mixed selection results and provider/publication timings are recorded in the unfinished local evaluation notes. They do not establish V3 semantic quality. Automated protocol checks use fake transport and credentials; the local HTTP bridge is tested over real loopback HTTP, and browser Jev tests intercept the local decision endpoint. Automated tests never call a model.

## Optional OpenAI text refinement

This implements the non-blocking refinement contract in the [CueLight design document](https://docs.google.com/document/d/1rTZiWCVA_7uPSBgMYyFycpPqJ8313Xu7knKF3ZswNcs/edit). Jev decides QUIET / NEW / UPDATE and publishes its selected source text immediately. OpenAI can subsequently simplify the wording of that exact Cue revision. It does not select teaching content or feed generated text back into evidence, candidates or Jev.

1. Set `OPENAI_API_KEY` in this checkout's ignored `.env.local`, alongside `TYPESAFE_API_KEY` (and `SPEECHMATICS_API_KEY` for microphone input). Never prefix credentials with `VITE_`. Preserve existing settings and restart the local dev/preview server.
2. Select microphone mode or **Jev** text replay. Enable **Text refinement · preserve meaning, simplify wording** in the teacher controls. It is off by default in every new session; missing OpenAI configuration does not block teaching. Enabling with an existing Cue may request refinement immediately; otherwise the next accepted source Cue triggers it. Configuration checks alone do not call a model.
3. Start the microphone or text replay normally. The source Cue appears first. A usable current-revision result replaces its display wording once, without streaming words, creating a new Cue, or restarting the previous-Cue timer. Turning refinement off cancels pending work and keeps wording already displayed.
4. In development, export the session journal from **Show diagnostics** before resetting. It records source/display text, source revisions, request context, the configured model, monotonic request/result times and applied/unchanged/stale/cancelled/failure outcomes. Source Cue-state and display-state updates are separate from browser paint.

`Cue.text` remains the source text. `sourceRevision` advances with accepted Jev mutations. Separate display state holds `displayText`; applying refinement never changes the Engine's source Cue object, identity, timestamps or provenance. Results apply only when `(sessionId, cueId, sourceRevision)` still matches the current Cue. A later Jev UPDATE immediately displays its new source wording and invalidates the older refinement. Ordinary evidence arrival alone is not invalidation. When a Cue becomes previous, its last displayed wording is frozen; late results cannot edit the previous slot.

The controller allows one request in flight and one latest pending revision. Intermediate pending revisions may be skipped. Each attempt has a three-second browser deadline; queue waiting is separate. No automatic retry is added. Reset, source/provider changes and page exit cancel immediately. Normal microphone stop finishes the existing ASR/Jev drain without waiting for OpenAI, then cancels remaining refinement. Text replay similarly finishes its Jev decisions before closing optional refinement. A new session starts with refinement off.

The service uses the ordinary [Responses API](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create), with `store: false`, `stream: false`, `background: false`, a 1,024-output-token cap and strict `{ displayText }` structured output. The initial model is fixed to [`gpt-4.1-mini-2025-04-14`](https://developers.openai.com/api/docs/models/gpt-4.1-mini), a documented model with structured output support and no reasoning step. It is an initial choice, not an experimentally established optimum. The official interface was checked on 2026-09-21. `store: false` disables response storage for retrieval; it is not a claim of zero provider retention.

`GET /api/openai/status` exposes only configuration readiness and model. `POST /api/openai/refine` is a same-origin loopback JSON endpoint in the existing Vite dev/preview server, with explicit Origin checks, a 256 KB body limit and a three-second deadline covering body reading and the upstream response. The source span is reconstructed from validated fragments. Source text plus at most two preceding context fragments is capped at 16,000 characters; larger inputs are visibly skipped without truncation. Context comes from the original Jev request snapshot, never later speech. The key and upstream errors are never returned to the browser or diagnostic journal; browser disconnect aborts the upstream fetch. A static host cannot provide these local endpoints.

The refinement prompt requests one faithful paragraph in the original language(s), removing verbal filler and redundant wording while preserving all teaching points, numbers, units, negation, uncertainty and conditions. It forbids answering questions, importing another teaching point, translating, guessing formulas or repairing uncertain ASR. Returning the original text unchanged is valid. HTTP errors, refusals, incomplete output, invalid/empty results and timeouts retain the visible Cue and are distinguished in teacher diagnostics. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) constrains format, not factual or semantic faithfulness; code does not prove that a rewrite preserves meaning.

Type checking and the production build passed for this delivery. No new simulated test cases or paid model calls were added; the unit/browser suites were not run. Existing text fixture objects were updated for the source revision field. Runtime, rewrite quality and reading disruption have not been verified; further testing remains deferred at the user's request.

## Verification

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

`test:e2e` builds production output and starts development/preview servers on ports 5173/4173. `npm run check` runs the complete sequence. On Linux CI, Chromium is installed with `--with-deps`.

The required checks cover:

- TypeScript and the production build.
- Unit/contract/HTTP integration tests: evidence bounds, exact contiguous candidates, Cue transitions, expiry, bounded/coalesced requests, reset/disposal, deterministic replay, V3 field references and action mapping, configuration rejection, full replay through real local HTTP → fake upstream → Cue Engine, input validation, cancellation, and error redaction.
- Playwright browser tests: real-time replay, all five subjects, pause/reset/switching, keyboard/narrow layout, Jev selection, missing configuration, HTTP-driven NEW/UPDATE, failure preserving the current Cue, and cancellation on reset/provider switch.
- Production bundle isolation, no external requests in scripted mode, no browser-storage writes, preview-server configuration and reload behavior.
- Browser screenshots and failure traces are written to ignored output directories and uploaded by CI; they are not committed.

CI runs the same checks on pull requests, without model secrets or calls.

## Deliberate limits

This is not closed captioning. Useful screen changes are not guaranteed for every fragment, and the learner never sees incoming transcript just because it arrived. Selected source text is displayed verbatim first; optional OpenAI refinement may subsequently change its display wording. Refinement belongs between the authoritative Cue and rendering, not inside decision logic.

There is no semantic speech segmentation, editable lesson corpus, durable lesson state, concept graph, background job infrastructure, semantic evaluation benchmark, deployment, or standalone backend framework. Generated display text is limited to optional same-revision refinement. The next product questions are whether natural Speechmatics Finals and existing candidates let Jev choose useful content, and whether faithful refinement improves reading enough to justify a second text change. Existing engineering checks do not establish real ASR performance, refinement quality or classroom usefulness.
