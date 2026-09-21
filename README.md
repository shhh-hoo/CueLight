# CueLight

A small teaching-attention experiment. A learner sees the teaching point worth keeping in view, not a running transcript.

The React + TypeScript application supports microphone input through the Speechmatics Voice SDK and five text replays. Text replay offers an explicit scripted demo or Jev through a local server endpoint; microphone mode uses Jev. Both Jev browser modes offer optional, non-blocking OpenAI presentation, off by default. A browser-free runner also replays longer source transcripts through the same Engine. The default demo needs no microphone, API key, or model call. The scripts demonstrate product behavior; **they do not validate semantic Cue selection**.

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

Jev first uses recent source evidence to infer what is being taught now, then compares it with `currentCue`, the reference still displayed to the learner. That reference may be stale. A different useful teaching point can become NEW_CUE even when unrelated to the displayed Cue; a material clarification, correction, completion or answer to the same point can UPDATE_CURRENT. Filler, administration, repetition without added understanding, or no useful complete selectable span yields QUIET. Selection remains verbatim and grounded, with no Cue frequency target. Server validation preserves optional speaker identity (nonblank string, at most 128 characters) and language (at most 64), rejecting control characters and invalid values. Speaker identity can indicate turn changes, not teacher/student authority.

Jev always uses **structured-v3**. There is no context selector or older-context implementation. Remove old `JEV_CONTEXT_VERSION` settings from local configuration: an unset/empty value or `structured-v3` is accepted; any other value stops startup or replay with an explicit error.

### Runtime experiments

Edit `.env.local` to tune a trial; `.env.example` is the canonical list with defaults and allowed values. Never put credentials under `VITE_`. For the next trial, keep Jev at `jev-latest` / 5,000 ms and refinement at its documented model / 6,000 ms / 16,000 characters / default off, and set:

```env
SPEECHMATICS_VOICE_PRESET=scribe
OPENAI_REFINEMENT_TIMEOUT_MS=6000
```

Restart the Python Voice gateway after gateway edits. Restart Vite dev/preview (or the replay process) after Node settings change, then start a new session. Existing process environment values take precedence over `.env.local`. Invalid tuning values fail during initialization with the variable name. No secrets are returned by status endpoints. Diagnostics record the gateway's session configuration and provider response configuration; per-response events preserve changes, and unobserved configuration is null rather than an invented default. The teacher can enable refinement during the trial.

Provider timeouts are experimental controls; unchanged Cue freshness and stop/drain guards can still discard late Jev results or end a draining session. Network loss is cancelled through the existing session/reset controls.

## Use the microphone

Microphone mode now requires **Python 3.11+** as well as **Node 24+**. The browser uses the existing Speechmatics PCM recorder; a small Python gateway supplies finalized Voice SDK segments. Jev still chooses QUIET / NEW_CUE / UPDATE_CURRENT. Learners do not see a live transcript.

1. Set `TYPESAFE_API_KEY` and `SPEECHMATICS_API_KEY` in this checkout's ignored `.env.local`. Preserve existing values; never prefix credentials with `VITE_`. Both services load this file; environment variables take precedence in the gateway.
2. Install once from the repository root:

   ```sh
   npm ci
   python3 -m venv .venv
   .venv/bin/python -m pip install -r voice_gateway/requirements.txt
   ```

3. Start two terminals from the repository root:

   ```sh
   npm run voice   # Python gateway, 127.0.0.1:8765
   npm run dev     # browser app, normally 127.0.0.1:5173
   ```

   For the local production build, use `npm run build` then `npm run preview`, with the gateway still running. Vite proxies `/api/voice/status` and `/api/voice/session` (WebSocket) to port 8765; no frontend environment setting is needed. The gateway accepts loopback Host and matching Origin only. It is a local service, not public deployment infrastructure; a static `dist/` host alone cannot run Voice, Jev, or refinement. On Windows, use `.venv\Scripts\python voice_gateway/gateway.py` in place of `npm run voice`.

4. Select **Microphone**, click **Start microphone**, allow access, and wait for **Microphone live · you can speak now**. Configuration checks do not call paid providers or validate keys. Starting uses Speechmatics and TypeSafe. The browser needs AudioContext, AudioWorklet, microphone permission and WebSocket support; audio captured while connecting is discarded.
5. **Stop microphone** stops capture, finalizes outstanding audio/segments, drains Jev, then disconnects the SDK. Wait for **Session stopped**. Reset, source change and page exit cancel immediately. Reconnect / **Start new session** creates a new ID, source clock, evidence and Cue state.

### Runtime and SDK configuration

```text
Browser microphone → PCMRecorder / AudioWorklet → same-origin WebSocket
→ Python Voice gateway → Speechmatics VoiceAgentClient
→ ADD_SEGMENT → ordered EvidenceFragments (one batch per event)
→ existing candidate builder → Jev structured-v3 → raw Cue
→ optional OpenAI refinement, asynchronously
```

Pinned packages: `@speechmatics/browser-audio-input@2.0.4`, `speechmatics-voice==0.2.8`, and its underlying `speechmatics-rt==1.1.1`. The Python SDK is not a browser package. Audio is mono **pcm_f32le at 16,000 Hz**, using `AudioContext({ sampleRate: 16000 })` for browser resampling. Voice 0.2.8 validates sample rates as 8 or 16 kHz, so the former native-device-rate configuration cannot be reused unchanged.

The gateway selects the official Voice SDK `CAPTIONS` or `SCRIBE` preset using `SPEECHMATICS_VOICE_PRESET` (default `scribe`). It preserves each preset's own timing/segmentation settings and overlays `language="cmn_en"`, the actual session sample rate, and `pcm_f32le`. Both use the enhanced operating point. Only finalized `ADD_SEGMENT` evidence is consumed, including when the selected preset also emits partials. The SDK uses its default EU endpoint (`eu2.rt.speechmatics.com`), or its existing server-only `SPEECHMATICS_RT_URL` override. Language, encoding, mono audio and sample-rate compatibility remain code contracts.

Only **`AgentServerMessageType.ADD_SEGMENT`** is forwarded as evidence. `ADD_PARTIAL_SEGMENT` and legacy word transcripts have no application handlers. The SDK may consume these internally. A multi-segment event is ordered on the source timeline, accepted atomically, and schedules at most one decision cycle. Existing one-in-flight/latest-pending coalescing remains. Candidates are the newest whole segment, contiguous recent whole segments, or the existing current-Cue expansion; Jev compares recent teaching evidence against the persistent displayed Cue. Text is copied verbatim, including whitespace, with source times, session ID, sequence, event cycle, speaker/language where supplied, and browser receive time. Empty segments are skipped; invalid or over-4096-character evidence is reported without truncation.

### Stop, cancellation and SDK compatibility

The installed SDK's `finalize()` is synchronous and schedules a queue flush; it does not wait for pending provider audio. Its `disconnect()` marks intake as closing before teardown, so calling it immediately can lose trailing recognition. CueLight therefore calls the SDK's public inherited `force_end_of_utterance()` after the final audio frame, waits for the provider's **forced** EOU response, waits for the SDK queue, calls `finalize()`, then waits for that flush to complete. The gateway sends `drained` after all finalized events; the browser drains Jev (up to 14 seconds) and replies `finish`; only then does the gateway call `disconnect()` and send `stopped`. ASR drain is limited to 10 seconds. A missing forced EOU/queue completion is an explicit incomplete-session error.

`DrainingVoiceClient` contains a small, documented compatibility adapter for the SDK's private FIFO `_stt_message_queue` because 0.2.8 has no public awaitable finalization barrier. It also cancels `_stt_queue_task` on failed startup, which the installed version's early-returning disconnect does not clean up. An installed-SDK regression test exercises the real queue and trailing/empty finalization. Reverify these two private boundaries before changing either pinned SDK version. The gateway does not consume underlying transcript events or make semantic decisions.

Socket closure cancels connection/drain work and closes the provider. Late callbacks lose authority before cleanup. Every browser control and gateway event is tied to one session ID; the browser adapter rejects foreign IDs. Existing Jev/refinement generation and revision guards remain. A slow or failed OpenAI request never delays a raw Cue, future audio, Jev, or Stop.

### Diagnostics and validation

In development, **Show diagnostics → Export session diagnostics** downloads schema-v3 JSON with actual gateway configuration, complete segment originals/times, session/speaker/sequence/cycle metadata, candidates, request IDs, Jev returns (normalized decision plus validated option key, confidence and per-option probabilities), Cue transitions and optional refinement. `segmentDecisions` explicitly links each segment to its candidate IDs, triggering request(s), eventual decisions and application outcomes; coalesced cycles can have no directly triggered request. The top-level `fragments` remain compatible with the transcript replay runner. Audio is never recorded, logged or persisted by the app or gateway; diagnostics remain in memory unless explicitly exported.

Local `atMonoMs`/`receivedAtMonoMs` values use browser `performance.now()`; source timestamps are seconds from Voice converted to milliseconds. No audio-to-browser-clock mapping or measured speech-to-screen latency is claimed.

**Preset comparison needs the user's next real microphone trial.** Automated tests cover the actual browser recorder with synthetic input, the gateway protocol with a stub provider, and the installed SDK's queue with synthetic provider events. They do not establish natural segment granularity or Cue quality. For the next real trial, set `SPEECHMATICS_VOICE_PRESET=scribe` and compare exported sessions. No preset comparison framework is included.

Run gateway checks with `npm run test:voice`; run frontend checks with `npm run check`. Browser tests refuse an existing server to avoid testing the wrong checkout. If port 5173 is occupied, use `CUELIGHT_TEST_DEV_PORT=5189 npm run test:e2e`.

For the real test, speak continuously for 1–2 minutes, Stop during/just after the last sentence, wait for **Session stopped**, and export diagnostics. Check finalized segment count, mean words/segment, percentage of single-word segments, Jev request count, representative segments/Cues, and the final sentence. Compare qualitatively with the prior 145-second baseline (306 fragments, 1.40 words/fragment, 65.4% single-word, 271 Jev requests). Each `jev-request` should correspond to a new finalized cycle; partials must create no requests. Also Reset and start a second session to confirm isolation.

First-party references checked alongside installed source: [Voice SDK README and events](https://github.com/speechmatics/speechmatics-python-sdk/tree/main/sdk/voice), [SDK presets](https://github.com/speechmatics/speechmatics-python-sdk/blob/main/sdk/voice/speechmatics/voice/_presets.py), [language packs](https://docs.speechmatics.com/speech-to-text/languages), and [forced EOU protocol](https://docs.speechmatics.com/api-ref/realtime-transcription-websocket). `scribe` uses sentence emission with a longer fixed silence trigger and different latency defaults; it is selectable through configuration; automated tests do not benchmark its teaching quality.

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
| `server/` | Bounded request validation, local Jev and OpenAI refinement endpoints, mounted by `vite.config.ts` in dev and preview. |
| `voice_gateway/` | Local Python Voice SDK service and focused lifecycle/protocol checks. |
| `src/speechmatics/` | Browser PCM capture, Voice gateway connection, finalized segment adapter, source lifecycle and development diagnostics. |
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

Candidates are the latest one, two, and three adjacent fragments, plus the span from the current Cue's first source fragment through the newest fragment, only while its complete original range remains in the window. Smaller windows yield fewer candidates. Text is preserved exactly, with one space between fragments. Candidate IDs encode the ordered source ID list. The current-Cue continuation has `updateOnly: true`: it is offered only as UPDATE_CURRENT, including when it duplicates a recent span. Other recent spans may be NEW_CUE or, with a current Cue, UPDATE_CURRENT. The server reconstructs this eligibility from evidence and Cue provenance; browser flags cannot override it.

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

`src/decision/jev-decision-provider.ts` is server-only and is not imported by the browser app. It defaults to `jev-latest` with a 5,000 ms server deadline and supports a configured model/timeout and injected transport. Vite loads `TYPESAFE_API_KEY`, `JEV_MODEL`, and `JEV_TIMEOUT_MS` from the server environment or `.env.local` and passes them to the local bridge. No key is sent to the browser.

- `GET /api/jev/status` returns only `{ configured, model, timeoutMs, contextVersion }`; it does not call TypeSafe.
- `POST /api/jev/decide` accepts the existing `DecisionInput` and returns `{ decision, configuration }`. The server validates bounded evidence and current Cue, rebuilds the deterministic candidates, and rejects any mismatch before contacting Jev.
- Requests are limited to 2 MB and same-origin loopback hosts. Malformed input returns 400, missing key 503, and upstream failure 502. Raw upstream errors and credentials are never reflected to the browser. No request history is stored.
- The HTTP provider has a 6.5-second browser deadline; the upstream adapter retains its five-second deadline. HTTP failures are caught by the same Engine and recorded as QUIET fallbacks, not successful semantic QUIET decisions.

The V3 request contains one `choice` question with `QUIET` and bounded NEW/UPDATE options for supplied candidates. Following the `typesafe-ai` skill and the official [source-span selection cookbook](https://docs.typesafe.ai/cookbooks/pre_parsed_value_extraction_cookbook), code generates candidates and copies the selected text verbatim. State separates latest speech, background, current Cue provenance and candidate source overlap. Instructions and criteria use [backticked field paths](https://docs.typesafe.ai/primitives#reference-specific-fields), such as `latestInput.text`, `backgroundEvidence`, `currentCue.text` and `candidates[0].text`. With no current Cue, nested current-Cue references and UPDATE options are omitted. UPDATE replaces the whole Cue and must retain needed context. The adapter maps a validated `answers.cue.choice` to a local action/ID pair; it never accepts generated Cue text. Confidence and probabilities are schema-validated, not used as product thresholds.

Missing credentials, malformed JSON/schema, unknown options, HTTP/network failures, and the configured deadline (default five seconds) return QUIET. There are no retries. An optional server-side error callback provides diagnostics. Successful provider responses pass only validated choice/confidence/probabilities through HTTP into the session journal; the Engine and reducer still receive only the normalized CueDecision. No probabilities are fabricated for fallbacks or no-candidate requests. The deadline includes response-body parsing and settles even if a test transport ignores abort.

**Historical live evaluations made 940 Jev decisions with 3 fallbacks.** Their mixed selection results and provider/publication timings are recorded in the unfinished local evaluation notes. They do not establish V3 semantic quality. Automated protocol checks use fake transport and credentials; the local HTTP bridge is tested over real loopback HTTP, and browser Jev tests intercept the local decision endpoint. Automated tests never call a model.

## Optional OpenAI Presentation V1

Jev selects the teaching content and publishes its exact source Cue immediately. OpenAI may asynchronously improve how that same revision is written and structured. Presentation is display-only: generated content never enters evidence, candidates, Jev input, or source Cue state.

1. Set `OPENAI_API_KEY` in this checkout's ignored `.env.local`, alongside `TYPESAFE_API_KEY` (and `SPEECHMATICS_API_KEY` for microphone input). Never prefix credentials with `VITE_`. Restart the local dev/preview server after configuration changes.
2. Select microphone mode or **Jev** text replay. Enable **Text refinement · preserve meaning, clarify structure**. Enhancement defaults to off; missing configuration does not block teaching. Status checks do not call a model. Enabling with an existing Cue starts one fresh attempt.
3. The source appears first. A validated current-revision presentation replaces it atomically inside the same Cue article. Turning enhancement off aborts active work, clears pending/completed work, and immediately restores the exact source for current and previous Cues. Re-enabling compiles the current revision once, without a cache.
4. In development, **Show diagnostics → Export session diagnostics** records source and display state separately, requested targets, result kind, outcomes, and monotonic request/result times. The journal remains schema v3 with style `presentation-v1`; timings do not measure browser paint. Keep real session exports and model reports private.

`Cue.text`, source revision, identity, timestamps and provenance remain authoritative. Separate display state holds a `presentation`. A later Jev UPDATE immediately displays its new source, invalidates and aborts obsolete compilation. Cancellation retains the active slot until its `finally`; one latest pending revision starts after release. Final session/Cue/revision and epoch checks remain authoritative if a transport ignores cancellation. Old successes and failures are history only and cannot overwrite current status. When a Cue becomes previous, late output cannot revise it; the existing expiry remains unchanged.

Pause leaves a valid compilation running. Stop drains Speechmatics/Jev without waiting for OpenAI, then cancels presentation work. Reset, source/provider changes and disposal invalidate old work. The server deadline remains 6,000 ms by default. There are no retries, repair calls, tools, model switching, or additional schedulers.

### Presentation contract

The shared JSON Schema, types and runtime parser live in `src/refinement/presentation.ts`. Strict Structured Outputs use an object root with a union under `result`, required fields, explicit nullable labels, and `additionalProperties: false` on every object:

- `{ result: { kind: "source" } }` keeps the exact current source, without presentation limits or truncation.
- `{ result: { kind: "presentation", blocks: [...] } }` contains one to three `text`, `list`, or `chain` blocks. Lists contain `{ label: string | null, text: string }` items. Chains contain text nodes and explicit `sequence`, `causes`, `becomes`, or `moves_to` links, with nullable labels.

Limits are five list items, two to four chain nodes and exactly one link between each pair, 280 Unicode code points per text/node, 80 per label, and 1,200 total visible generated code points. Invalid, empty, additional-field, or oversized output is rejected whole; never truncated. Text and lists use semantic HTML. Chains expose each relation in visible/accessibility text, distinguish sequence from causality, and become vertical on narrow screens. Long content flows normally without clipping or line clamps.

There are no titles, tables, generated HTML/CSS/SVG/Markdown, LaTeX, persistent node keys, per-atom provenance, previous-presentation memory, or layout preflight.

Before calling OpenAI, the host recovers selected source fragments from the original Jev decision snapshot, checks their IDs/order, and requires their texts joined with single spaces to equal `Cue.text`. Missing or mismatched evidence records `incomplete-source` with zero model calls. It never substitutes a newer evidence window. The endpoint verifies the source span again. Only `sourceText` and at most two earlier `referenceContext` texts reach the model; all lifecycle metadata stays host-owned. Reference context may resolve an explicit reference, but cannot add a teaching point.

The prompt preserves language (including mixed Chinese/English), conditions, qualifications, uncertainty, negation, quantities, example/question status and explicitly stated relationships. It permits conservative cleanup, parallel facts and explicit relations; it forbids outside knowledge, answering questions, correcting the teacher, translation, inferred formulas, context leakage, or stronger causality. Each revision compiles independently and may return `source` when restructuring would not help.

### Model and evaluation

The initial baseline is [`gpt-5.6-luna`](https://developers.openai.com/api/docs/models/gpt-5.6-luna) with `reasoning: { effort: "none" }`, Responses API, `store: false`, `stream: false`, `background: false`, and `max_output_tokens: 2048`. `OPENAI_REFINEMENT_MODEL` remains server-side configurable; a small exact-model profile prevents legacy overrides receiving unsupported reasoning parameters. `store: false` disables response retrieval storage, not all provider retention.

`GET /api/openai/status` exposes readiness and allowlisted configuration. `POST /api/openai/refine` retains same-origin loopback and Origin checks, a 256 KB body limit, browser-disconnect cancellation, and the existing configurable source-plus-context input ceiling (16,000 characters by default). Keys and raw upstream errors are never returned. A static host cannot provide these endpoints.

Deterministic unit/HTTP/browser checks cover grammar and Unicode budgets, exact source recovery, lifecycle freshness, semantic isolation, and both desktop/mobile rendering with authored outputs. Run `npm run check` and `npm run test:voice`. These checks establish engineering behavior; [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) cannot prove semantic faithfulness. After replay inspection, a private 8–10-call Luna smoke review needs explicit approval before any paid call; it is not a broad benchmark prerequisite.

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

The Voice SDK supplies speech segmentation. There is no custom semantic segmenter, editable lesson corpus, durable lesson state, concept graph, background job infrastructure, semantic evaluation benchmark, or public deployment. Generated display text is limited to optional same-revision refinement. The next product questions are whether finalized Voice SDK segments and existing candidates let Jev choose useful content, and whether faithful refinement improves reading enough to justify a second text change. Existing engineering checks do not establish real ASR performance, refinement quality or classroom usefulness.
