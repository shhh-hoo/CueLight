# CueLight

CueLight keeps useful teaching references visible as the lesson moves on, without making the teacher stop to write, search or switch materials. A Cue is a temporary teaching reference: the question is **“what should remain visible now?”**

The [CueLight design document](https://docs.google.com/document/d/1rTZiWCVA_7uPSBgMYyFycpPqJ8313Xu7knKF3ZswNcs/edit) is the source of product direction. This README separates that direction from the runnable implementation below; alignment reviewed on 2026-09-21.

## Product direction

CueLight is persistence-first. It serves the middle ground: a definition, formula, standard wording, keyword, distinction, causal relation, example or compact visual that students would benefit from continuing to see, but that the teacher would otherwise skip writing or searching for. When building a representation is itself part of teaching—worked calculations, mechanisms, diagrams or spatial reasoning—use the whiteboard or deliberate teaching material. When nothing is worth keeping visible, stay QUIET.

The learner sees only the current Cue and, where useful, a brief previous Cue. Transcript evidence belongs on the **teacher console**, which is a planned product surface with low-attention controls:

- **Click a Final fragment** to request a Cue. The system supplies nearby context, the current Cue and relevant library candidates; the teacher does not compose a prompt or select multiple fragments in V1.
- **Dismiss** an unwanted Cue without letting stale work restore it.
- **Pin** a Cue to prevent automatic replacement until released.
- **Save** a useful Cue to the teacher's library without changing the learner-facing Cue.

AUTO remains the default. Teacher fragment-click is a second trigger into the same pipeline, not a permanent manual mode. AUTO may choose QUIET, NEW_CUE or UPDATE_CURRENT. A teacher click expresses display intent and must not silently become QUIET; the decision instead selects content and NEW versus UPDATE. Relevant automatic updates may extend a teacher-triggered Cue while preserving its intent; a new teaching focus may produce a new Cue unless it is pinned.

The intended flow is:

```text
Live audio → Speechmatics Final evidence → rolling teaching context
  → AUTO Jev decision or teacher fragment-click
  → unified Cue pipeline, preferring a strongly matching trusted library asset
  → immediate learner-facing Cue
  → optional asynchronous OpenAI refinement
  → commit only while the same Cue revision is current
```

**Cue Library** is the teacher's reusable teaching repertoire: text, formulas, standard wording, relations, examples, diagrams, graphs, mechanisms and other compact references. Library preferred, generation available: a library miss does not automatically mean QUIET. A useful newly created Cue can later be saved. Start with a small teacher-owned collection, import and lightweight Save/Edit/Delete; validate retrieval and reuse before adding a heavy CMS, mandatory hand-tagging or a vector-database dependency.

Speechmatics Finals are stable ASR evidence, not guaranteed semantic teaching units or guaranteed correct text. Reason across nearby Finals. Partials may support transient teacher awareness, but must never become authoritative or clickable evidence or learner content. Keep source wording, recognition times and session identity; track arrival time separately. Do not add an independent semantic transcript composer or treat EndOfUtterance as proof that an idea is complete.

Teacher actions and accepted Cue mutations must invalidate older automatic/refinement work through session, Cue and revision guards. Ordinary evidence arrivals must allow in-flight AUTO decisions to make progress. OpenAI must never delay the first Cue or introduce an unestablished teaching point, and may change display content only for the exact current revision. The previous-Cue duration is a UI variable to validate.

## Implementation status

This checkout includes the Speechmatics Voice SDK integration branch. Its current implementation is narrower than the design direction:

| Area | Available in this checkout | Planned or still to validate |
| --- | --- | --- |
| Cue selection | Scripted replay and automatic Jev QUIET / NEW_CUE / UPDATE_CURRENT over source-span candidates. | Teacher fragment-click into the same pipeline; preservation of teacher intent. |
| Teacher surface | Source/session controls and a development-only evidence/diagnostic panel. | Product transcript console, clickable Finals, Dismiss, Pin and Save. |
| Library and representation | Verbatim source text followed by optional text refinement. | Trusted Cue assets, retrieval/reuse, capture/import and richer representations. |
| Audio evidence | Python Voice SDK gateway forwards finalized `ADD_SEGMENT` events. | Validate this provider-native boundary against the design's Final-evidence contract with representative teaching audio. |
| Revision safety | Session/freshness guards for automatic decisions and exact-revision OpenAI refinement. | Teacher-action authority and guards once those controls exist. |
| Learner display | Current Cue, plus previous Cue for four seconds; current Cue does not expire. | Classroom value, distraction and useful persistence duration. |

The React + TypeScript application supports microphone input through the Speechmatics Voice SDK and five text replays. Text replay offers an explicit scripted demo or Jev through a local server endpoint; microphone mode uses Jev. Both Jev browser modes offer optional, non-blocking OpenAI text refinement, off by default. A browser-free runner also replays longer source transcripts through the same Engine. The default demo needs no microphone, API key, or model call. The scripts demonstrate product behavior; **they do not validate semantic Cue selection or classroom usefulness**. The following runtime sections describe this implementation, not completion of the planned controls or library.

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

The gateway selects the official Voice SDK `CAPTIONS` or `SCRIBE` preset using `SPEECHMATICS_VOICE_PRESET` (default `captions`). It preserves each preset's own timing/segmentation settings and overlays `language="cmn_en"`, the actual session sample rate, and `pcm_f32le`. Both use the enhanced operating point. Only finalized `ADD_SEGMENT` evidence is consumed, including when the selected preset also emits partials. The SDK uses its default EU endpoint (`eu2.rt.speechmatics.com`), or its existing server-only `SPEECHMATICS_RT_URL` override. Language, encoding, mono audio and sample-rate compatibility remain code contracts.

Only **`AgentServerMessageType.ADD_SEGMENT`** is forwarded as evidence. `ADD_PARTIAL_SEGMENT` and legacy word transcripts have no application handlers. The SDK may consume these internally. A multi-segment event is ordered on the source timeline, accepted atomically, and schedules at most one decision cycle. Existing one-in-flight/latest-pending coalescing remains. Candidates are the newest whole segment, contiguous recent whole segments, or the existing current-Cue expansion; structured-v3 is unchanged. Text is copied verbatim, including whitespace, with source times, session ID, sequence, event cycle, speaker/language where supplied, and browser receive time. Empty segments are skipped; invalid or over-4096-character evidence is reported without truncation.

### Stop, cancellation and SDK compatibility

The installed SDK's `finalize()` is synchronous and schedules a queue flush; it does not wait for pending provider audio. Its `disconnect()` marks intake as closing before teardown, so calling it immediately can lose trailing recognition. CueLight therefore calls the SDK's public inherited `force_end_of_utterance()` after the final audio frame, waits for the provider's **forced** EOU response, waits for the SDK queue, calls `finalize()`, then waits for that flush to complete. The gateway sends `drained` after all finalized events; the browser drains Jev (up to 14 seconds) and replies `finish`; only then does the gateway call `disconnect()` and send `stopped`. ASR drain is limited to 10 seconds. A missing forced EOU/queue completion is an explicit incomplete-session error.

`DrainingVoiceClient` contains a small, documented compatibility adapter for the SDK's private FIFO `_stt_message_queue` because 0.2.8 has no public awaitable finalization barrier. It also cancels `_stt_queue_task` on failed startup, which the installed version's early-returning disconnect does not clean up. An installed-SDK regression test exercises the real queue and trailing/empty finalization. Reverify these two private boundaries before changing either pinned SDK version. The gateway does not consume underlying transcript events or make semantic decisions.

Socket closure cancels connection/drain work and closes the provider. Late callbacks lose authority before cleanup. Every browser control and gateway event is tied to one session ID; the browser adapter rejects foreign IDs. Existing Jev/refinement generation and revision guards remain. A slow or failed OpenAI request never delays a raw Cue, future audio, Jev, or Stop.

### Diagnostics and validation

In development, **Show diagnostics → Export session diagnostics** downloads schema-v3 JSON with actual gateway configuration, complete segment originals/times, session/speaker/sequence/cycle metadata, candidates, request IDs, Jev returns, Cue transitions and optional refinement. `segmentDecisions` explicitly links each segment to its candidate IDs, triggering request(s), eventual decisions and application outcomes; coalesced cycles can have no directly triggered request. The top-level `fragments` remain compatible with the transcript replay runner. Audio is never recorded, logged or persisted by the app or gateway; diagnostics remain in memory unless explicitly exported.

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

Candidates are the latest one, two, and three adjacent fragments, plus the span from the current Cue's first source fragment through the newest fragment, only while its complete original range remains in the window. Smaller windows yield fewer candidates. Text is preserved exactly, with one space between fragments. Candidate IDs encode the ordered source ID list.

### Decisions, concurrency, and display

`CueDecisionProvider.decide({ evidence, candidates, currentCue })` returns only `QUIET`, `NEW_CUE(candidateId)`, or `UPDATE_CURRENT(candidateId)`. Mock scripts match source ID ranges against actual candidates. Unknown inputs or unavailable script ranges return `QUIET`; scripts cannot inject display text.

Only one decision may be in flight per Engine. Additional evidence sets one dirty bit. A result can apply after new evidence arrives if the session and current Cue still match, request age and source-time advancement are each at most five seconds, and all selected source fragments remain in the evidence window. Rejections record a reason. Candidates are rebuilt after an accepted mutation, then one coalesced request evaluates the latest evidence. There is no per-fragment queue or retry. All snapshots sent to the provider are immutable.

These temporal/source bounds allow progress; they do not recognize semantic freshness. Newer speech can correct or invalidate a statement, or change topic, inside the five-second interval. A temporarily outdated Cue can therefore appear before the follow-up decision. Semantic freshness remains an open product requirement.

Reset increments a session generation so an old result cannot match a new session's reused evidence version. If a request is pending at reset, the same Engine waits for it to settle before evaluating new evidence. Disposal disconnects the source, clears the expiry timer, and ignores late responses. A future custom provider must settle its promises; the Jev adapter has a hard five-second deadline.

- **QUIET:** the Cue state is unchanged, including object identity. Existing previous-Cue expiry continues.
- **NEW_CUE:** the current Cue becomes previous; the new Cue gets a new identity and `sourceRevision: 1`.
- **UPDATE_CURRENT:** the current source text, provenance and update timestamp change, and `sourceRevision` increments; identity and creation time remain. Without a current Cue, it behaves as NEW_CUE.
- Previous Cue currently expires four seconds after moving into that position, independent of speech and subsequent updates. Another NEW_CUE starts a new four-second transition. Current Cue never expires automatically. This is a baseline UI behavior to validate, not a fixed learning rule.

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

Missing credentials, malformed JSON/schema, unknown options, HTTP/network failures, and the configured deadline (default five seconds) return QUIET. There are no retries. An optional server-side error callback provides diagnostics. The deadline includes response-body parsing and settles even if a test transport ignores abort.

**Historical live evaluations made 940 Jev decisions with 3 fallbacks.** Their mixed selection results and provider/publication timings are recorded in the unfinished local evaluation notes. They do not establish V3 semantic quality. Automated protocol checks use fake transport and credentials; the local HTTP bridge is tested over real loopback HTTP, and browser Jev tests intercept the local decision endpoint. Automated tests never call a model.

## Optional OpenAI text refinement

This implements the text-only, automatic-path portion of the non-blocking refinement contract in the [CueLight design document](https://docs.google.com/document/d/1rTZiWCVA_7uPSBgMYyFycpPqJ8313Xu7knKF3ZswNcs/edit). Jev decides QUIET / NEW / UPDATE and publishes its selected source text immediately. OpenAI can subsequently simplify the wording of that exact Cue revision. It does not select teaching content or feed generated text back into evidence, candidates or Jev. Library presentation and teacher-action invalidation remain future work.

1. Set `OPENAI_API_KEY` in this checkout's ignored `.env.local`, alongside `TYPESAFE_API_KEY` (and `SPEECHMATICS_API_KEY` for microphone input). Never prefix credentials with `VITE_`. Preserve existing settings and restart the local dev/preview server.
2. Select microphone mode or **Jev** text replay. Enable **Text refinement · preserve meaning, simplify wording** in the teacher controls. It is off by default in every new session; missing OpenAI configuration does not block teaching. Enabling with an existing Cue may request refinement immediately; otherwise the next accepted source Cue triggers it. Configuration checks alone do not call a model.
3. Start the microphone or text replay normally. The source Cue appears first. A usable current-revision result replaces its display wording once, without streaming words, creating a new Cue, or restarting the previous-Cue timer. Turning refinement off cancels pending work and keeps wording already displayed.
4. In development, export the session journal from **Show diagnostics** before resetting. It records source/display text, source revisions, request context, the configured model, monotonic request/result times and applied/unchanged/stale/cancelled/failure outcomes. Source Cue-state and display-state updates are separate from browser paint.

`Cue.text` remains the source text. `sourceRevision` advances with accepted Jev mutations. Separate display state holds `displayText`; applying refinement never changes the Engine's source Cue object, identity, timestamps or provenance. Results apply only when `(sessionId, cueId, sourceRevision)` still matches the current Cue. A later Jev UPDATE immediately displays its new source wording and invalidates the older refinement. Ordinary evidence arrival alone is not invalidation. When a Cue becomes previous, its last displayed wording is frozen; late results cannot edit the previous slot.

The controller allows one request in flight and one latest pending revision. Intermediate pending revisions may be skipped. Each attempt has one server-owned deadline (`OPENAI_REFINEMENT_TIMEOUT_MS`, default 6,000 ms); queue waiting is separate. The browser retains reset/stop cancellation but does not race the server with another deadline. No automatic retry is added. Reset, source/provider changes and page exit cancel immediately. Normal microphone stop finishes the existing ASR/Jev drain without waiting for OpenAI, then cancels remaining refinement. Text replay similarly finishes its Jev decisions before closing optional refinement. A new session uses `OPENAI_REFINEMENT_ENABLED_DEFAULT` (false by default); missing OpenAI credentials always leave refinement unavailable.

The service uses the ordinary [Responses API](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create), with `store: false`, `stream: false`, `background: false`, a 1,024-output-token cap and strict `{ displayText }` structured output. The configurable model defaults to [`gpt-4.1-mini-2025-04-14`](https://developers.openai.com/api/docs/models/gpt-4.1-mini), a documented model with structured output support and no reasoning step. It is an initial choice, not an experimentally established optimum. The official interface was checked on 2026-09-21. `store: false` disables response storage for retrieval; it is not a claim of zero provider retention.

`GET /api/openai/status` exposes only readiness, model, timeout, character limit, and default-enabled state. `POST /api/openai/refine` is a same-origin loopback JSON endpoint in the existing Vite dev/preview server, with explicit Origin checks, a 256 KB body limit and the configured server deadline covering body reading and the upstream response. The source span is reconstructed from validated fragments. Source text plus at most two preceding context fragments is capped at `OPENAI_REFINEMENT_MAX_INPUT_CHARS` (default 16,000 characters); larger inputs are visibly skipped without truncation. Context comes from the original Jev request snapshot, never later speech. The key and upstream errors are never returned to the browser or diagnostic journal; browser disconnect aborts the upstream fetch. A static host cannot provide these local endpoints.

The refinement prompt requests one faithful paragraph in the original language(s), removing verbal filler and redundant wording while preserving all teaching points, numbers, units, negation, uncertainty and conditions. It forbids answering questions, importing another teaching point, translating, guessing formulas or repairing uncertain ASR. Returning the original text unchanged is valid. HTTP errors, refusals, incomplete output, invalid/empty results and timeouts retain the visible Cue and are distinguished in teacher diagnostics. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) constrains format, not factual or semantic faithfulness; code does not prove that a rewrite preserves meaning.

After the Reset E2E correction, the existing full check passed locally: type checking, production build, 82 unit tests and 14 browser tests. No new simulated test cases or paid model calls were added. Existing text fixture objects were updated for the source revision field; the existing Reset case reopens diagnostics before checking the cleared evidence version. Real Speechmatics/OpenAI operation, rewrite quality and reading disruption remain unverified and are left for the user's local trial.

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

## Next delivery and product evaluation

The first product question is whether teaching contains enough moments where a reference is worth keeping visible but not worth interrupting the lesson to write or search for. Correct summaries and fast model responses alone cannot answer that question.

Follow the design document's delivery order:

1. Exercise the live Speechmatics path with a configured key and representative teaching audio. Verify stable evidence granularity, stop/drain behavior, session isolation and the teacher transcript surface. The Voice SDK preset comparison remains pending.
2. Add teacher steering to the same Cue pipeline: clickable finalized evidence with automatic surrounding context, plus Dismiss, Pin and Save. Teacher intent must outrank stale automatic and refinement results while AUTO continues listening.
3. Seed a small library of the teacher's recurring references. Prefer a trusted asset when it strongly fits, with evidence-based Cue creation available when it does not.
4. Use 3–5 short real teaching sessions, preferably revision or 1:1 teaching. Teacher-triggered or manually prepared trusted Cues can isolate product value from imperfect AUTO selection. Observe skipped writing/searching, student reference back to Cues, teacher interruptions, distracting display changes and whether the teacher voluntarily wants to use CueLight again.
5. Use that evidence to prioritize automatic selection/retrieval, library capture, richer rendering and later whiteboard/context integration.

If trusted, well-timed Cues add little value, reconsider the use case or presentation. If teacher-triggered Cues help but AUTO misses them, improve selection/context. If only saved assets help, prioritize retrieval. If students mainly use material after class, reconsider realtime persistence as the product center.

Evaluate AUTO separately using timestamped replay with no future evidence: useful-Cue coverage, unwanted Cues, NEW versus UPDATE errors, focus drift and display changes per minute. For teacher triggers, measure click-to-first-Cue latency and recovery of the intended point from one Final plus nearby context. For the library, measure appropriate reuse, faithful adaptation and whether saved assets are actually reused. Classify failures as ASR/evidence, context, decision, retrieval, generation or commit freshness.

Measure speech end → Final evidence → Jev decision → first visible Cue, with optional refinement measured separately. Include terminology, numbers, negation, self-correction, bilingual speech, silence, topic changes, reconnect and stop/drain. Preserve session isolation, source provenance, AUTO progress during continuous evidence, teacher-action authority, Pin/Dismiss behavior and exact-revision refinement as engineering contracts as those paths are implemented. Classroom trials, replay and concurrency checks provide different evidence; none alone establishes learning effectiveness or market demand.

## Deliberate limits

This is not closed captioning. Useful screen changes are not guaranteed for every fragment, and the learner never sees incoming transcript just because it arrived. Selected source text is displayed verbatim first; optional OpenAI refinement may subsequently change its display wording. Refinement belongs between the authoritative Cue and rendering, not inside decision logic.

The Voice SDK supplies the current provider-native segment boundary; CueLight has no custom semantic transcript composer. Finalized segments are evidence, not guaranteed teaching units. There is currently no Cue Library, durable lesson state, concept graph, background job infrastructure, semantic evaluation benchmark or public deployment. Newly generated display wording is limited to optional same-revision text refinement; planned library and representation work must not be mistaken for shipped behavior.

The initial product does not replace deliberate whiteboard construction, worked calculations or teaching where building the representation matters. It is not a student transcript, general note-taking or slide-authoring product, and teachers should not have to pre-build every Cue. Speaker diarization, custom semantic transcript reconstruction, automatic speech-to-formula parsing, a heavy library CMS and whiteboard reading remain later work unless classroom evidence makes them necessary. Existing engineering checks do not establish real ASR performance, refinement quality or classroom usefulness.
