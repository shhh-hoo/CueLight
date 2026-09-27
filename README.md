# CueLight

CueLight is a teacher workspace for reviewing what was actually taught, how ideas developed, and where each interpretation came from. **The teacher workbench** opens on the real current/previous CueSurface. Teachers can speak, browse Lesson Flow, check a source, and edit independent notes in any order. TRACE V0 supplies the full history and portable archives. It describes accepted interpretations; it does not score or diagnose teaching.

ENRICH (Cue-level additions and references) and REWORK (optional whole-lesson organization suggestions) remain future capabilities. They are independent layers, not a required rehearsal loop. Student LIVE, projection, Pin/Dismiss and dual-surface synchronization are outside the current delivery.

Canonical authority, in order:

1. [Alive Cue Product Design](https://docs.google.com/document/d/1rTZiWCVA_7uPSBgMYyFycpPqJ8313Xu7knKF3ZswNcs/edit) — product invariants and V1 decisions.
2. [Teacher Workspace & Derived Artifacts](https://docs.google.com/document/d/1uawcuRFIhf7fX6Z4E8KeiwMYF-MCicx7Qm6JNcvUkRU/edit) — TRACE interactions and separation of derived work.
3. [Alive Cue V1 Runtime Architecture](https://docs.google.com/document/d/1btwXR3h6AewQBXB4gEaeR-Co7rvH5vQbXHZ2NbRwZtE/edit) — implementation contract.
4. [Learning Ecosystem](https://docs.google.com/document/d/1bCX5fbyXQ7hG8AG2wvC2adFkLdcWwem2B4NV2dz5wzo/edit) — shared Asset / Domain Pack boundaries.

## Implementation status

Alive Cue **Slices I–II** establish immutable evidence, stable Cue identities and revisions, lifecycle/relations/adoption/deferred records, a single acceptance writer, deterministic replay, and a derived Semantic Working Set. See [foundation implementation notes](docs/alive-cue-foundation.md) for exact boundaries, storage, migration, and test mapping.

**Slice III** adds `alive-jev-v1`: bounded source-grounded WAIT / NO_CHANGE / CREATE / REVISE / RECALL / WITHDRAW / RELATION_INTENT proposals over persistent Cues, plus optional relation follow-up. See [Slice III notes and validation](docs/alive-cue-jev-proposals.md). TRACE now reads the full accepted lesson, independently of compatibility current/previous slots. Speechmatics segmentation and optional source-bound text/list/chain Presentation V1 remain unchanged. Domain Pack retrieval, general background artifacts and semantic repair remain later work. No semantic or classroom quality is claimed by deterministic tests. See [teacher workbench layout](docs/teacher-workbench-layout.md) for the current view/state contract and verification.

**TRACE V0** adds a process list, all-Cue index, versioned detail, exact original-source navigation, teacher notes / mismatch marks, explicit processing states and portable file export/import in development and production. See [TRACE V0 implementation and verification](docs/teacher-trace-v0.md).

The accepted journal and separate workbench metadata use **tab-scoped sessionStorage**. This is **not automatic recovery after closing a tab** ([#17](https://github.com/shhh-hoo/CueLight/issues/17)). Before leaving, export a **TRACE JSON file**; opening it validates and replays `alive-cue-v1` without models or microphone access. The version-1 wrapper adds notes, observed recording state/issues and already successful presentations. Markdown is also available for reading, but cannot reconstruct the full history. No raw audio, credentials or runtime provider configuration is added to the export; model/judgment metadata already present in accepted history is preserved.

Stop preserves readable history. Reset/new session/source changes warn before abandoning unexported records or notes. Import opens a separate read-only view; a running capture remains active and can be returned to. Invalid files do not replace the active session. Local delete cancels related work and deletes only the selected session's local record/metadata, not downloaded files. Storage/export errors remain visible.

The React + TypeScript application supports microphone input and five text replays. **离线编写示例** (scripted demo) needs no microphone, API key or model call; authored examples demonstrate mechanisms, not classroom semantic quality.

## Run it

Use Node 24 or newer and npm. Node 24 is used in CI.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite for the teacher Display. **Lesson Flow** replaces the main area; **Current Cue / Just before** opens a pinned Cue/version in the contextual sheet, whose Reference, Note and Evidence tabs show one task at a time. Capture and view changes are independent. Use **记录与导出** for files and deletion.

For offline development, open **`/dev`**, choose Science, History, Literature, Programming, or Mathematics, then select **Start replay**. Each 16.8-second sample includes filler, a new point, a clarification, and a different point. Pause/continue preserves replay timing. Open Lesson Flow and click a Cue to view its versions, then a source link to highlight the exact original range. Open **Note** for **教师备注** or **梳理不符**, then **记录与导出 → 导出 TRACE 文件**, and use **打开 TRACE 文件** in a new page to recover the same TRACE read-only. Reset and switching start fresh sessions after the leave guard; previous tab journals are not automatically reopened.

**Show diagnostics** on `/dev` opens the development-build-only panel. It shows incoming text, rolling evidence, candidate spans, versions, in-flight status, the last decision and whether it was applied/discarded, and Cue provenance. Microphone and Jev text-replay sessions additionally retain full semantic inspection traces (including coverage, exact request, choice, proposal, acceptance and compatibility foreground) an in-memory diagnostic journal that you can explicitly download before resetting or switching sources. Scripted replay retains its bounded snapshot.

```sh
npm run build
npm run preview
```

The production browser bundle has the same teacher Display, Flow and archive support. Offline replay/provider selectors are confined to the explicit `/dev` test route; the debug panel, upstream Jev adapter and credentials are absent from production. Fonts use local system fallbacks. Scripted mode makes no external requests. The tab-scoped lesson journal remains recoverable; the UI starts a new capture on reload.

## Enable Jev locally

1. Copy `.env.example` to `.env.local` and set `TYPESAFE_API_KEY` to your TypeSafe API key. This file is ignored by Git. Never use a `VITE_` prefix for credentials.
2. Optionally set `JEV_MODEL`; the default is `jev-latest`.
3. Restart `npm run dev` (or `npm run preview` after building).
4. On `/dev`, choose **Jev** in **Decision provider**. The page checks local configuration without calling the model. **Start replay** is disabled until a server key is present; configuration readiness does not prove the key is valid.
5. Select **Start replay** to send finalized teaching evidence to Jev using your TypeSafe account. No model request happens merely from opening the app or selecting Jev. Switch back to **离线编写示例** for offline development.

Changing provider starts a fresh session. Reset and provider/lesson changes cancel pending browser requests, propagate disconnect cancellation upstream, and retain the Engine's session/version guards. Provider failures preserve existing Cue history; a service error appears outside original-source content and the development panel records the distinct failure category and latency. There is no automatic fallback to scripted decisions.

The local API is built into Vite's development and preview servers; no extra process is required. It is restricted to local same-origin HTTP requests and is not a public authenticated service. A bare static `dist/` host cannot run Jev; use `npm run preview` for the local built application. Public hosting/authentication is outside this slice.

Jev selects a grounded operation over a bounded Semantic Working Set, including non-current Cues and exact part targets. The Host compiles its choice into the shared SemanticProposal and the single acceptance writer checks sources, authority, dependencies, identity and accounting. WAIT leaves evidence unresolved; NO_CHANGE accounts actual understanding; provider failures do neither. Configured teacher captures authorize speech without requiring diarization; speaker labels alone never grant teacher authority.

The product uses **alive-jev-v1** through `/api/jev/inspect`. Remove old `JEV_CONTEXT_VERSION` settings or use `alive-jev-v1`. The structured-v3 provider and `/api/jev/decide` remain quarantined for historical replay tooling; neither runs in the live product. The offline scripted demo retains its legacy display vocabulary through the same acceptance writer.

### Runtime experiments

Edit `.env.local` to tune a trial; `.env.example` is the canonical list with defaults and allowed values. Never put credentials under `VITE_`. For the next trial, keep Jev at `jev-latest` / 5,000 ms and refinement at its documented model / 6,000 ms / 16,000 characters / default off, and set:

```env
SPEECHMATICS_VOICE_PRESET=scribe
OPENAI_REFINEMENT_TIMEOUT_MS=6000
```

Restart the Python Voice gateway after gateway edits. Restart Vite dev/preview (or the replay process) after Node settings change, then start a new session. Existing process environment values take precedence over `.env.local`. Invalid tuning values fail during initialization with the variable name. No secrets are returned by status endpoints. Diagnostics record the gateway's session configuration and provider response configuration; per-response events preserve changes, and unobserved configuration is null rather than an invented default. The teacher can enable refinement during the trial.

Provider timeouts are experimental controls; unchanged Cue freshness and stop/drain guards can still discard late Jev results or end a draining session. Network loss is cancelled through the existing session/reset controls.

## Use the microphone

Microphone mode now requires **Python 3.11+** as well as **Node 24+**. The browser uses the existing Speechmatics PCM recorder; a small Python gateway supplies finalized Voice SDK segments. Jev proposes Alive Cue semantic changes; the Host explicitly configures this microphone capture as teacher-authorized. The teacher can inspect every captured Final and its processing range in TRACE.

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

4. Open the normal `/` entry, check **采集设置** if needed, click **Start microphone**, allow access, and wait for **Microphone live · you can speak now**. Configuration checks do not call paid providers or validate keys. Starting uses Speechmatics and TypeSafe. The browser needs AudioContext, AudioWorklet, microphone permission and WebSocket support; audio captured while connecting is discarded.
5. **Stop microphone** stops capture, finalizes outstanding audio/segments, drains Jev, then disconnects the SDK. Wait for **Session stopped**; history and notes remain readable/exportable. Reset, source change and page exit cancel related work, with a leave warning for unexported content. Reconnect / **Start new session** creates a new ID, source clock, evidence and Cue state.

### Runtime and SDK configuration

```text
Browser microphone → PCMRecorder / AudioWorklet → same-origin WebSocket
→ Python Voice gateway → Speechmatics VoiceAgentClient
→ ADD_SEGMENT → ordered EvidenceFragments (one batch per event)
→ bounded Semantic Working Set → Jev alive-jev-v1 → SemanticProposal → acceptance → source Cue
→ optional OpenAI refinement, asynchronously
```

Pinned packages: `@speechmatics/browser-audio-input@2.0.4`, `speechmatics-voice==0.2.8`, and its underlying `speechmatics-rt==1.1.1`. The Python SDK is not a browser package. Audio is mono **pcm_f32le at 16,000 Hz**, using `AudioContext({ sampleRate: 16000 })` for browser resampling. Voice 0.2.8 validates sample rates as 8 or 16 kHz, so the former native-device-rate configuration cannot be reused unchanged.

The gateway selects the official Voice SDK `CAPTIONS` or `SCRIBE` preset using `SPEECHMATICS_VOICE_PRESET` (default `scribe`). It preserves each preset's own timing/segmentation settings and overlays `language="cmn_en"`, the actual session sample rate, and `pcm_f32le`. Both use the enhanced operating point. Only finalized `ADD_SEGMENT` evidence is consumed, including when the selected preset also emits partials. The SDK uses its default EU endpoint (`eu2.rt.speechmatics.com`), or its existing server-only `SPEECHMATICS_RT_URL` override. Language, encoding, mono audio and sample-rate compatibility remain code contracts.

Only **`AgentServerMessageType.ADD_SEGMENT`** is forwarded as evidence. `ADD_PARTIAL_SEGMENT` and legacy word transcripts have no application handlers. The SDK may consume these internally. A multi-segment event is ordered on the source timeline and accepted atomically. One primary inspection runs at a time; later input coalesces while it is busy. Legal punctuation subranges, the full remaining range, and an optional open-tail continuation are source candidates, not forced semantic boundaries. Accepted accounting can trigger another bounded step over the unaccounted remainder of the same Final. Optional relation requests do not block primary acceptance. Text is copied verbatim, including whitespace, with source times, session ID, sequence, event cycle, speaker/language where supplied, and browser receive time. Empty segments are skipped; invalid or over-4096-character evidence is reported without truncation.

### Stop, cancellation and SDK compatibility

The installed SDK's `finalize()` is synchronous and schedules a queue flush; it does not wait for pending provider audio. Its `disconnect()` marks intake as closing before teardown, so calling it immediately can lose trailing recognition. CueLight therefore calls the SDK's public inherited `force_end_of_utterance()` after the final audio frame, waits for the provider's **forced** EOU response, waits for the SDK queue, calls `finalize()`, then waits for that flush to complete. The gateway sends `drained` after all finalized events; the browser drains Jev (up to 14 seconds) and replies `finish`; only then does the gateway call `disconnect()` and send `stopped`. ASR drain is limited to 10 seconds. A missing forced EOU/queue completion is an explicit incomplete-session error.

`DrainingVoiceClient` contains a small, documented compatibility adapter for the SDK's private FIFO `_stt_message_queue` because 0.2.8 has no public awaitable finalization barrier. It also cancels `_stt_queue_task` on failed startup, which the installed version's early-returning disconnect does not clean up. An installed-SDK regression test exercises the real queue and trailing/empty finalization. Reverify these two private boundaries before changing either pinned SDK version. The gateway does not consume underlying transcript events or make semantic decisions.

Socket closure cancels connection/drain work and closes the provider. Late callbacks lose authority before cleanup. Every browser control and gateway event is tied to one session ID; the browser adapter rejects foreign IDs. Existing Jev/refinement generation and revision guards remain. A slow or failed OpenAI request never delays a raw Cue, future audio, Jev, or Stop.

### Diagnostics and validation

In development, **Show diagnostics → Export session diagnostics** downloads schema-v4 JSON with actual gateway configuration, complete segment originals/times, session/speaker/sequence/cycle metadata, candidates, request IDs, Jev returns (normalized decision plus validated option key, confidence and per-option probabilities), Cue transitions and optional refinement. `segmentDecisions` explicitly links each segment to its candidate IDs, triggering request(s), eventual decisions and application outcomes; coalesced cycles can have no directly triggered request. The top-level `fragments` remain compatible with the transcript replay runner. Audio is never recorded, logged or persisted by the app or gateway; diagnostics remain in memory unless explicitly exported.

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
  → persist immutable evidence in LessonStore
  → bounded evidence/Working Set projections
  → capture grounded operation candidates over persistent Cue IDs/parts
  → SemanticProvider.inspect(captured Working Set)
  → compile SemanticProposal + exact source/role/revision dependencies
  → single acceptance writer validates/persists AcceptedEvent
  → full LessonHistory / LessonState
  → Teacher TRACE projection + independent notes / file export
  (current/previous slots feed the teacher Display and existing refinement scheduling; browsing is independent)
```

| Module | Responsibility |
| --- | --- |
| `src/evidence/evidence-buffer.ts` | Immutable snapshots of up to 20 seconds / 32 finalized fragments; version increments on accepted input. |
| `src/candidates/candidate-builder.ts` | Legacy scripted/v3 source-span compatibility only. |
| `src/decision/` | Provider contract, validation, scripted mock, same-origin HTTP client, and server-only Jev adapter. |
| `server/` | Bounded request validation, local Jev and OpenAI refinement endpoints, mounted by `vite.config.ts` in dev and preview. |
| `voice_gateway/` | Local Python Voice SDK service and focused lifecycle/protocol checks. |
| `src/speechmatics/` | Browser PCM capture, Voice gateway connection, finalized segment adapter, source lifecycle and development diagnostics. |
| `src/refinement/` | Optional same-revision display refinement; separate presentation state, bounded scheduling and local HTTP client. |
| `src/cue/cue-engine.ts` | Evidence intake, bounded primary inspection loop, one active/one pending optional relation inspection, version/session guards, diagnostics, and display expiry. |
| `src/alive/` | Shared domain types, pure acceptance reducer, journal/replay, exact source ranges, accounting, projections and transitional adapter. |
| `src/replay/` | Timer-driven finalized input and five fixtures with separate, explicit decision scripts. |
| `src/trace/` | Full-history projection, untrusted file validation/replay, portable archive/Markdown and independent workbench metadata. |
| `src/ui/` | Teacher TRACE, source/version navigation, import/export and separately loaded development diagnostics. |
| `src/App.tsx` | Connects one source and selected provider to one Engine; owns session setup/cleanup and controls. |
| `src/clock.ts` | Injectable clock/timer functions for replay and display timing. |

### Evidence and candidates

Source adapters must deliver unique finalized fragment IDs in chronological `endMs` order with valid nonnegative timestamps and nonempty text. A fragment is limited to 4,096 characters to keep the in-memory bound meaningful; oversized text is rejected and diagnosed rather than rewritten or split. Exact retransmissions are idempotent; reused IDs with changed payloads and out-of-order fragments are rejected and diagnosed. IDs must not be reused within a source session.

The legacy request projection retains at most 20 seconds / 32 finalized fragments. The authoritative lesson retains every recorded source and Cue independently of this projection. `SemanticWorkingSet` supports exact-ID/text lookup of older lesson Cues, explicit recall, open and settled objects, source/role/relation context and omission metadata. It supplies the Slice III interpreter; only current revisions are transported, with complete necessary parts. Diagnostics are not recovery authority.

The new source layer exposes exact legal punctuation subranges, the whole pending range, and bounded open-tail continuations. They are candidate addresses, not forced semantic units. The primary Choice selects one grounded operation; independent source-stance questions preserve pedagogical role. Server code rebuilds options from validated context. Candidate omissions are explicit; no topic classifier, transcript rewrite or external retrieval is added.

### Decisions, concurrency, and display

`SemanticProvider.inspect(capturedInspection)` returns typed judgments that compile into WAIT / NO_CHANGE / CREATE / REVISE / RECALL / WITHDRAW / RELATION_INTENT proposals. The compiler binds every provider-visible Cue/relation/role revision and all supplied source processing revisions. RELATION_INTENT selects one starting Cue for a relation-only statement without modifying or recalling it. An optional separate relation inspection chooses its target and kind; other primary operations require explicit new relationship evidence to trigger it.

One primary request is active at a time. Accepted processing must advance before another step over the same Final; WAIT and failed snapshots remain suspended across bursts until their own processing or matching authority changes. Fresh evidence may use a suspended tail as continuation context without retrying it alone. New input coalesces, and required stale dependencies cause rejection and at most one fresh recapture per source lineage. The semantic path does not use display equality or the old five-second evidence-window cutoff as semantic freshness. Relation work cannot block primary publication or change foreground. One active plus one latest-useful pending relation is retained; superseded or invalidated work is explicitly diagnosed.

CREATE and RECALL still select compatibility foreground for existing refinement scheduling. These slots drive the main teacher Display. TRACE browsing is independent local UI state, and all Cues survive slot expiry in Lesson Flow. Browsing an old Cue does not submit RECALL or call a model. Pause stops source emissions but not pending work. Reset/disposal invalidates late results by session generation and epoch.

The scripted demo and historical replay CLI retain the explicitly labelled legacy adapter. They use the same LessonStore writer, but their NEW/UPDATE/QUIET vocabulary is not the live Jev contract. Historical v3 results must not be treated as Alive Cue evaluations.

## Jev integration boundary

The adapter follows the [official TypeSafe HTTP API](https://docs.typesafe.ai/api), checked on 2026-09-22. No SDK is installed; server-only transport posts `{ model, state, questions }` to `/v1/systemone`. Credentials never enter the browser.

- `GET /api/jev/status` reports configuration without calling TypeSafe.
- `POST /api/jev/inspect` accepts a bounded capture and returns validated judgment metadata plus effective configuration. The server reconstructs candidates and questions.
- `/api/jev/decide` is quarantined for historical v3 tooling and returns its legacy contract version explicitly.
- The boundary is same-origin loopback HTTP, limited to 2 MB. Invalid source/context fails before any upstream call. Missing configuration is 503; provider failure is 502 with an allowlisted category. Raw errors and credentials are never reflected.
- Server timeout defaults to five seconds, including response parsing, and settles even if a transport ignores abort. Timeout, transport/HTTP, invalid choice and malformed response stay distinguishable. Failure never compiles to NO_CHANGE or accounts source.
- Raw probabilities/confidence are retained without a hard-coded semantic threshold. Accepted events carry proposal and inspection identity; diagnostic traces include build/request/config identity and count unique attempts without double-counting mirrors.

The [implementation notes](docs/alive-cue-jev-proposals.md) describe bounds, failure handling, deterministic regressions and remaining qualification gaps. The [small live plan](docs/alive-cue-jev-live-plan.md) is prepared but **not executed**. Automated tests use mocked responses and never call paid providers.

## Optional OpenAI Presentation V1

Jev selects the teaching content and publishes its exact source Cue immediately. OpenAI may asynchronously improve how that same revision is written and structured. Presentation is display-only: generated content never enters evidence, candidates, Jev input, or source Cue state.

1. Set `OPENAI_API_KEY` in this checkout's ignored `.env.local`, alongside `TYPESAFE_API_KEY` (and `SPEECHMATICS_API_KEY` for microphone input). Never prefix credentials with `VITE_`. Restart the local dev/preview server after configuration changes.
2. In the normal microphone entry, open **采集设置** and enable **整理呈现**. On `/dev`, use microphone or **Jev** text replay and enable **Text refinement · preserve meaning, clarify structure**. Enhancement defaults to off; missing configuration does not block teaching. Status checks do not call a model. Enabling with an existing Cue starts one fresh attempt.
3. Original source remains visible. The first successful presentation observed for each Cue revision is retained separately, labelled **整理表达** with its source version, and included in the TRACE file. Turning refinement off cancels future generation, while the already saved presentation remains readable. The existing scheduler is still current-only; browsing does not reschedule it. This is not ENRICH or an artifact-editing system.
4. In development, **Show diagnostics → Export session diagnostics** records source and display state separately, requested targets, result kind, outcomes, and monotonic request/result times. The diagnostic journal uses schema v4 with style `presentation-v1`; timings do not measure browser paint. Keep real session exports and model reports private.

`Cue.text`, source revision, identity, timestamps and provenance are derived from accepted lesson Cue revisions. Separate display state holds a `presentation`. A later Jev UPDATE immediately displays its new source, invalidates and aborts obsolete compilation. Cancellation retains the active slot until its `finally`; one latest pending revision starts after release. Final session/Cue/revision and epoch checks remain authoritative if a transport ignores cancellation. Old successes and failures are history only and cannot overwrite current status. When a Cue becomes previous, late output cannot revise it; the existing expiry remains unchanged.

Pause leaves a valid compilation running. Stop drains Speechmatics/Jev without waiting for OpenAI, then cancels presentation work. Reset, source/provider changes and disposal invalidate old work. The server deadline remains 6,000 ms by default. There are no retries, repair calls, tools, model switching, or additional schedulers.

### Presentation contract

The shared JSON Schema, types and runtime parser live in `src/refinement/presentation.ts`. Strict Structured Outputs use an object root with a union under `result`, required fields, explicit nullable labels, and `additionalProperties: false` on every object:

- `{ result: { kind: "source" } }` keeps the exact current source, without presentation limits or truncation.
- `{ result: { kind: "presentation", blocks: [...] } }` contains one to three `text`, `list`, or `chain` blocks. Lists contain `{ label: string | null, text: string }` items. Chains contain text nodes and explicit `sequence`, `causes`, `becomes`, or `moves_to` links, with nullable labels.

Limits are five list items, two to four chain nodes and exactly one link between each pair, 280 Unicode code points per text/node, 80 per label, and 1,200 total visible generated code points. Invalid, empty, additional-field, or oversized output is rejected whole; never truncated. Text and lists use semantic HTML. Chains expose each relation in visible/accessibility text, distinguish sequence from causality, and become vertical on narrow screens. Long content flows normally without clipping or line clamps.

There are no titles, tables, generated HTML/CSS/SVG/Markdown, LaTeX, persistent node keys, per-atom provenance, general presentation editing/version management, or layout preflight.

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
- Playwright browser tests: replay across five subjects, full Cue/version/source navigation, stable teacher selection, notes and file round trip, malformed/inert imports, pause/reset/switching/deletion guards, keyboard/narrow layout, Jev and microphone mocks, stop/drain and late-response isolation.
- Production bundle isolation, TRACE export/import without diagnostics, no external requests in scripted mode or file viewing, honest tab-storage limits, and preview-server configuration.
- Browser screenshots and failure traces are written to ignored output directories and uploaded by CI; they are not committed.

CI runs the same checks on pull requests, without model secrets or calls.

## Next delivery and product evaluation

The current product question is whether a teacher can understand and verify the structure of their own lecture, keep useful notes and leave with a record they can reopen. Check identity continuity, exact provenance, historical versions, mismatch feedback burden and file usability. Authored fixtures and mocked browser sessions establish engineering contracts, not model accuracy or teacher value.

Automatic recovery across tab closure remains [#17](https://github.com/shhh-hoo/CueLight/issues/17). ENRICH, REWORK, retrieval and real teacher/model evaluation require separate work. There is no required Take 1 → Take 2 loop, student display prerequisite or automatic lesson diagnosis. Issues #7/#8/#10/#12 and the display emphasis in #9 describe the old student route; their scope does not govern TRACE. The source-authority meaning of #11 is retained. No historical issues were rewritten or closed.

## Deliberate limits

TRACE is a sourced interpretation, not a complete reconstruction or objective teaching assessment. WAIT, deferred and recorded ranges remain distinct from accounted ranges; queue idle, Stop and successful download do not establish complete understanding. Missing relations do not imply teaching defects. Partial quotations inherit their Final's interval without character-based timing; acceptedAt and display dwell are not lecture duration. Unrecorded historical error reasons remain unknown.

Raw audio, unseen board work and uncaptured slides cannot be recovered from the text history. The Speechmatics SDK remains the only segment boundary owner. No Domain Pack retrieval, general knowledge graph, ENRICH/REWORK model tasks, student surface, public deployment or model/dependency upgrade is included.

Historical foundation, presentation and Jev implementation records remain in `docs/`; they explain earlier mechanisms and do not override the teacher product definition. Slice III stabilization remains documented in [its implementation notes](docs/alive-cue-jev-stabilization.md).
