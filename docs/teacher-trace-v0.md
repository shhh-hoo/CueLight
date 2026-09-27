# Teacher TRACE V0

> This records PR #18’s original implementation and validation. The current Display / Lesson Flow composition, entry routes and follow-up verification are documented in [Teacher workbench layout](teacher-workbench-layout.md). The archive, source and semantic ownership contracts below remain in force.

## Scope and baseline

Product question: can a teacher inspect how a captured lecture developed, verify each Cue against original evidence, keep independent notes, and leave with a portable record? Deterministic fixtures test engineering contracts, not real classroom/model quality.

Baseline verified against GitHub on 2026-09-27: `main` e15d73c64a56ecbf1b3a398be39b45796c3f2261; #15 open at dd3659a965b976bce8d58e253dd9acfbcb071535; #16 open/draft at **f9d49157f9a0a7743911d7a0512535fe8019f1a3**. `feat/teacher-trace-v0` starts at #16 and targets `feat/alive-cue-v1-jev-proposals`. Neither existing PR is rebased, merged or rewritten.

The five authoritative documents linked in the handoff were accessible and read, including the teacher product/workspace definitions and runtime appendix D. Their earlier document-only authorization describes the previous revision; this development follows the user's newly approved TRACE implementation request. No source files in the synced ChatGPT project are changed.

Teacher TRACE replaces the normal student display entry. Old CueSurface/slot mechanisms remain for compatibility; no student accounts, LIVE surface, Pin/Dismiss, synchronization or training loop is added. Issues #7/#8/#10/#12 and #9's display framing are not prerequisites; #11's source authority is preserved. Historical issues and implementation notes remain untouched.

## Entry and shortest route

Use Node 24 and `npm ci && npm run dev`, or `npm run build && npm run preview` for the production interface.

1. Keep **文本回放 / 离线编写示例**, choose a subject, and **Start replay**. These five authored scripts make no model/microphone calls.
2. Select a Cue, switch versions, and select a source link. The full original Final is shown with exact quote highlighting, original speaker/role information and adjacent context.
3. Add **教师备注** or **梳理不符**. These change only workbench metadata.
4. **导出 TRACE 文件**; confirm the browser saved the download. In a new page, **打开 TRACE 文件** opens an independent read-only TRACE with the same identities, versions, sources, metadata and saved presentations. **导出 Markdown** provides a human-readable copy.

The microphone and Jev text routes reuse existing capture/provider setup. Starting them uses configured provider accounts; status checks only check local readiness. No live provider trial was executed in this task. Stop preserves history and detail. Current/previous slot changes never take over the teacher's selected Cue or selected historical version. On narrow screens, selecting a Cue moves keyboard focus to its detail.

## Reading and ownership

- `src/trace/projection.ts` reads **all** `LessonHistory.events` and `LessonState`, not `EngineSnapshot.evidence`, Working Set or display slots. Each process row binds the version at that operation, so later conditions cannot flow backward into a CREATE row. It retains CREATE/EXTEND/REVISE, recorded mention/recall, lifecycle and sourced relations, including withdrawn Cues and invalidated dependencies.
- `src/ui/TraceView.tsx` is a read-only consumer; selection and navigation cannot reach an Engine or provider. Content citations and revision establishment/change evidence are separate. Roles are supplied/configured data, not guessed from speaker IDs. Source text is React text, never HTML/Markdown to execute. Optional presentation is labelled and rendered separately from original words.
- `src/trace/session.ts` owns only notes, mismatch marks, observed recording status/issues and the first successful presentation per Cue revision. It does not submit proposals, write CueRevision, amend evidence or diagnose teaching. Notes are limited to 10,000 UTF-16 units per Cue; failed metadata storage retains the in-memory draft and reports failure.
- Existing `CueEngine.exportLesson()`, synchronous `LessonStore` and `replayLesson()` remain authoritative. No new semantic writer, model config, Jev threshold/candidate rule or Speechmatics segmentation change is introduced.
- Capture disposal/cancellation, semantic generation guards and Stop/drain are reused. Local delete first cancels/disposes the runtime, then removes that session's metadata and journal. If deletion fails, the retained view remains exportable and errors are explicit. Late work cannot write into that session or the next one.

## Time, processing and limits

Source links use the actual `startMs/endMs`. A partial quote gets only its Final's interval; no text-length interpolation, inferred continuous object duration or accumulated dwell time is used. Source-time ordering and system acceptance ordering are separate. Raw acceptedAt is available in the acceptance disclosure, labelled as system processing time (fixture clocks may be synthetic); it is not source time.

Recorded, WAIT, accounted and deferred ranges remain visible in the original-source disclosure. Deferred items retain reasons and open/resolved/closed-incomplete status. Capture issues are recorded only when observed, with the then-current accepted sequence; their exact missing interval is not invented. Processing failures are not relabelled as missing audio. Imported old inner histories have unknown source type, end state and unrecorded error causes. NO_CHANGE does not prove every repetition was captured. Missing relations do not diagnose a teaching defect.

## File and storage contract

The portable file is `{ format: "cuelight-trace", version: 1, history, workspace }`. `history` remains the original **alive-cue-v1** event journal. `workspace` contains notes by Cue ID, record source/phase/observed issues, and successful presentations tied to Cue/version. It adds no raw audio, credentials, runtime provider configuration or development diagnostics; accepted-event model/judgment metadata remains intact. The importer also supports an unwrapped legacy alive-cue-v1 history, with empty notes and unknown recording state.

Before opening: check file bytes (8 MiB), JSON complexity (40 levels / 200,000 nodes), supported wrapper/history versions and event limit (2,000); reject prototype keys and unknown structural fields/operations; validate types; replay the canonical domain checks for identity, exact UTF-16 quotes/ranges, authority, references, dependencies and resulting versions; validate metadata and presentation references. Extra inspection source references must exist by that accepted event. Validation finishes before the UI switches; malformed files cannot damage active capture. File content, URLs and provider-looking data never initiate requests.

Export validates the same round trip before handing a Blob to the browser. The UI reports a browser download request, not a filesystem write guarantee. Markdown includes all Cue versions, process/source positions, notes, relationships, source roles/processing, record issues and saved derived presentations; text is escaped. It is not a reconstruction format.

The journal and explicitly versioned metadata use **sessionStorage** only. There is no automatic reopening UI or cross-close recovery; #17 remains separate. Reset/source/new-session navigation prompts for unexported material or active recording; page exit uses the browser's native warning where supported. Confirming leave starts a fresh session; old tab records are not automatically resumed. Import does not overwrite or pause an active runtime: its separate read-only view has a return-to-session control and explicitly says capture may continue. Deleting the current local session does not delete earlier sessions or downloaded copies. The app does not claim remote deletion.

## Verification

Baseline: `npm ci`, `npm run typecheck`; 304 existing tests passed after rerunning outside the port-restricted sandbox. The first sandbox attempt failed only because local HTTP listeners received EPERM.

Final validation uses Node **24.19.0** and Python **3.13**:

- `npm run typecheck`, `npm test`, production build and Playwright through `CI=true CUELIGHT_TEST_DEV_PORT=5189 npm run check` : **313 unit/contract tests and 34 browser tests passed**, typecheck/build passed.
- `npx playwright install chromium` uses the repository-locked version.
- `python3.13 -m venv .venv`, `.venv/bin/python -m pip install -r voice_gateway/requirements.txt`, `npm run test:voice`: **7 passed**, stub/synthetic provider only.
- `git diff --check <base>...HEAD` plus working diff check.

Focused tests cover the foundation A → EXTEND → B → RECALL → REVISE sequence, > Working Set capacity, withdrawal and invalidated relations, cross-Final/shared sources, bilingual/UTF-16 ranges, late acceptance ordering and unresolved processing, hostile/oversize/unsupported imports, metadata isolation, storage/download/delete failures, active-session retention while viewing imports, and production file round trip without API calls. Old foreground-expiry and learner assertions were migrated to all-Cue/sticky-selection assertions; existing domain, provider, transaction, source, presentation grammar, cancellation and speech tests remain.

Browser evidence in ignored `artifacts/`: `trace-desktop.png`, `trace-mobile.png`, `trace-import.png`, `trace-long-source.png`, and `trace-presentation-*.png`. Desktop, 390px narrow layout, reduced motion, keyboard selection and long original text are exercised; screenshots show only authored/mock data. The development server also received an agent-browser load/interactive/error-overlay check. CI uploads browser evidence on runs.

NOT RUN: real Speechmatics/Jev/OpenAI calls, paid Jev evaluation plan, real teacher/lesson trials, semantic quality evaluation, merging, deployment. Remaining: #17 automatic cross-close persistence, ENRICH, REWORK and independent teacher validation.
