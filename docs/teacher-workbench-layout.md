# Teacher workbench layout

## Question and verified base

Can a teacher alternate between speaking, seeing a real Cue form, inspecting past evidence, and writing a note without capture taking over their work?

On 2026-09-27, GitHub and the clean local PR #18 branch both pointed to `1a239fa58aa72fa4c167081b12e09a13ff3b5331`. #18 is open/draft, targeting `feat/alive-cue-v1-jev-proposals` (`f9d49157f9a0a7743911d7a0512535fe8019f1a3`, #16), above #15 (`dd3659a965b976bce8d58e253dd9acfbcb071535`) and main (`e15d73c64a56ecbf1b3a398be39b45796c3f2261`). `codex/teacher-workbench` starts at that exact #18 head and targets `feat/teacher-trace-v0`. Lower PRs are not rewritten.

## Interaction and ownership

- `/` opens the teacher workbench, with the real `CueSurface` receiving `engine.getSnapshot().cues` and the existing `CueRefinement` display state. Source fallback, text, list and chain are the existing renderer; there is no table support. Normal input is the existing microphone path, behind an explicit Start action. Readiness checks are local status requests, not model requests.
- Display and Lesson Flow occupy the same main region. Both remain mounted behind `hidden`, preserving scroll and browser state. Flow reads the full existing `projectTrace` projection, including withdrawn Cues, historical versions, sourced relations and process records. An explicit return action shows current Display without changing attention or adding a semantic event.
- A single contextual sheet owns the selected Cue ID, exact revision, current task, and source references. Only explicit teacher actions change that state. Cue/version browsing is deliberately pinned, even when that same Cue gets a newer revision. Choosing its latest version or clicking Current Cue is explicit.
- Reference, Note, Evidence and Cue details are mutually exclusive sheet tasks. New runtime Cues and presentation results have no effect on selection, task, focus or scroll. Opening a sheet uses a layout effect scoped to teacher selection/task changes, with no lesson dependency. Escape closes it and returns focus to its opener or the current view control.
- Notes still use `TraceSession.note`, keyed by Cue ID, with immediate in-memory retention and the existing storage-error reporting. Display/Flow changes preserve the mounted editor, caret and draft. Task/Cue switches recover the corresponding note from workbench metadata. No note or browser action submits a semantic proposal.
- Capture phase never controls view or task. Stop retains the workbench and existing drain/cancellation behavior. Import has its own read-only workbench, with frozen archived attention and saved same-version presentations. Returning preserves the live workbench. Import validation, export format, leave guards, deletion and late-result safety are unchanged.
- Export/Markdown/delete are in the on-demand **记录与导出** menu. Original speech, accepted interpretation, derived presentation and teacher notes keep distinct labels and storage ownership. Storage remains tab scoped; portable files are the supported cross-close route.
- `/dev` is an explicit test route in both local development and preview builds. It retains offline fixture replay and provider selectors. Diagnostics require both `/dev` and a development build. These controls do not appear on `/`.

## Unconnected backend seams

**ENRICH:** the Reference task receives a stable Cue ID / semantic revision, already isolated from runtime attention. It currently renders an empty state and disabled request button. A future request/result component belongs here, must bind responses to this exact target, and must keep AI annotations and external references separately attributed. It must not use `CueRefinement` as a general enrichment service or write `LessonHistory`.

**REWORK:** Flow has a disabled REWORK affordance. A future whole-lesson request must receive a read-only history snapshot/sequence and explicit scope, return a separate derived suggestion, and remain independent of capture/view state. There is no model endpoint, fake output, adoption action or historical-record rewrite in this change.

## Prototype adaptations

The supplied HTML guided the ivory/green palette, typography, spacing, default Display, bottom work controls and optional 380px sheet. Its data and JavaScript were not used for runtime behavior. Existing bilingual product labels and exact source metadata remain where needed to preserve source/version verification. Real capture has Stop/drain rather than the prototype’s fictional pause/resume session. The existing four-second previous-Cue lifetime is preserved; older objects remain in Flow. Narrow screens overlay the contextual sheet rather than creating a third column. Prototype AI examples are replaced with unavailable states; session-wide notes were not invented beyond PR #18’s Cue notes.

## Verification

Run locally with Node 24.21.0 and Python 3.13, using only authored data, intercepted provider responses, and synthetic microphone audio:

- `CI=true CUELIGHT_TEST_DEV_PORT=5191 npm run check`: typecheck, 313 unit/contract tests, production build and 37 browser tests.
- `npm run test:voice`: 7 synthetic/stub Voice tests.
- `git diff --check`.
- Agent-browser verified `/` loads with a real Display region, nonempty content and no Vite error overlay. Actual screenshots at 1440×900 and 1100×900 cover Display with current/previous presentation, an older Cue sheet, and Flow (`artifacts/workbench-{display,sheet,flow}-{1440,1100}.png`).

The browser suite keeps the PR #18 archive/UTF-16/source/history/storage/download/deletion/late-result contracts, adapting interactions to explicit Flow and sheet tasks. Added scenarios assert journal equality across browsing and view switches, pinned old-Cue identity, note text/caret/focus/editor and sheet scroll through incoming Cues, no forced navigation on Stop in either view, and no test controls on the normal production route. Existing 390px tests cover keyboard/source navigation and long presentations.

The first Voice attempt was blocked by sandbox loopback permissions; the rerun with local listener access passed. No dependencies or provider/runtime contracts changed. Real paid Speechmatics/Jev/OpenAI calls, real teacher trials, merging and deployment were not performed. Automatic cross-close recovery (#17), ENRICH and REWORK backends remain separate work.
