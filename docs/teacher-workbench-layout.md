# Teacher workbench layout

## Question and verified base

Can a teacher alternate between speaking, seeing a real Cue form, inspecting past evidence, and writing a note without capture taking over their work?

On 2026-09-27, GitHub and the clean local PR #18 branch both pointed to `1a239fa58aa72fa4c167081b12e09a13ff3b5331`. #18 is open/draft, targeting `feat/alive-cue-v1-jev-proposals` (`f9d49157f9a0a7743911d7a0512535fe8019f1a3`, #16), above #15 (`dd3659a965b976bce8d58e253dd9acfbcb071535`) and main (`e15d73c64a56ecbf1b3a398be39b45796c3f2261`). `codex/teacher-workbench` starts at that exact #18 head and targets `feat/teacher-trace-v0`. Lower PRs are not rewritten.

## Interaction and ownership

- `/` opens the teacher workbench, with the real `CueSurface` receiving `engine.getSnapshot().cues` and the existing `CueRefinement` display state. Source fallback, text, list and chain are the existing renderer; there is no table support. Normal input is the existing microphone path, behind an explicit Start action. Readiness checks are local status requests, not model requests.
- Display and Lesson Flow occupy the same main region. Both remain mounted behind `hidden`, preserving scroll and browser state. Flow reads the full existing `projectTrace` projection, including withdrawn Cues, historical versions, sourced relations and process records. An explicit return action shows current Display without changing attention or adding a semantic event.
- Flow owns its explicit Cue/version selection independently of the contextual sheet. The selected card labels its pinned version, even after closing the sheet or receiving a newer revision. A single sheet context owns its task, nullable Cue/version target, and evidence references; closing it discards that entire context. With no open sheet, Display tools use the live Cue/version and Flow tools use the visibly selected Cue/version (Note/Reference are disabled until one is selected). An open sheet supplies its explicit target. Global/deferred evidence opens with no Cue target or Cue header; Cue-only actions stay disabled there. No missing historical revision silently falls back to the latest one.
- Reference, Note, Evidence and Cue details are mutually exclusive sheet tasks. New runtime Cues and presentation results have no effect on selection, task, focus or scroll. Opening/retargeting a sheet or following a source link explicitly requests focus; task tabs keep focus on the activated control. The sheet is a nonmodal native dialog on desktop and a modal drawer at widths up to 800px, with native background inertness. Escape/close releases it and returns focus to the external opener or current view control. Resizing and temporarily hiding the live workbench for an imported archive update dialog visibility without discarding context, notes or the mounted editor.
- Notes still use `TraceSession.note`, keyed by Cue ID, with immediate in-memory retention and the existing storage-error reporting. Display/Flow changes preserve the mounted editor, caret and draft. Task/Cue switches recover the corresponding note from workbench metadata. No note or browser action submits a semantic proposal.
- Capture phase never controls view or task. Stop retains the workbench and existing drain/cancellation behavior. Import has its own read-only workbench, with frozen archived attention and saved same-version presentations. Returning preserves the live workbench. Import validation, export format, leave guards, deletion and late-result safety are unchanged.
- Export/Markdown/delete are in the on-demand **记录与导出** menu. Original speech, accepted interpretation, derived presentation and teacher notes keep distinct labels and storage ownership. Storage remains tab scoped; portable files are the supported cross-close route.
- `/dev` is an explicit test route in both local development and preview builds. It retains offline fixture replay and provider selectors. Diagnostics require both `/dev` and a development build. These controls do not appear on `/`.

## Unconnected backend seams

**ENRICH:** the Reference task receives a stable Cue ID / semantic revision, already isolated from runtime attention. It currently renders an empty state and disabled request button. A future request/result component belongs here, must bind responses to this exact target, and must keep AI annotations and external references separately attributed. It must not use `CueRefinement` as a general enrichment service or write `LessonHistory`.

**REWORK:** Flow has a disabled REWORK affordance. A future whole-lesson request must receive a read-only history snapshot/sequence and explicit scope, return a separate derived suggestion, and remain independent of capture/view state. There is no model endpoint, fake output, adoption action or historical-record rewrite in this change.

## Prototype adaptations

The supplied HTML guided the ivory/green palette, typography, spacing, default Display, bottom work controls and optional 380px sheet. Its data and JavaScript were not used for runtime behavior. Existing bilingual product labels and exact source metadata remain where needed to preserve source/version verification. Real capture has Stop/drain rather than the prototype’s fictional pause/resume session. The existing four-second previous-Cue lifetime is preserved; older objects remain in Flow. Narrow screens show a full-height modal sheet over the workbench; close it before using capture, view, import or export controls. Prototype AI examples are replaced with unavailable states; session-wide notes were not invented beyond PR #18’s Cue notes.

## Verification

Reverified after the PR #19 review fixes with Node 26.8.1 and Python 3.13.2, using only authored data, intercepted provider responses, and synthetic microphone audio:

- `CI=true CUELIGHT_TEST_DEV_PORT=5191 npm run check`: typecheck, 313 unit/contract tests, production build and 41 browser tests.
- `npm run test:voice`: 7 synthetic/stub Voice tests.
- `git diff --check`.
- Agent-browser verified `/` loads with a real Display region, nonempty content and no Vite error overlay. Actual screenshots at 1440×900 and 1100×900 cover Display with current/previous presentation, an older Cue sheet, and Flow (`artifacts/workbench-{display,sheet,flow}-{1440,1100}.png`).

The browser suite keeps the PR #18 archive/UTF-16/source/history/storage/download/deletion/late-result contracts, adapting interactions to explicit Flow and sheet tasks. Added scenarios assert journal equality across browsing and view switches, pinned old-Cue identity, note text/caret/focus/editor and sheet scroll through incoming Cues, no forced navigation on Stop in either view, and no test controls on the normal production route. Targeted regressions additionally cover old Cue → close sheet → new Cue → Display Note/Reference/Evidence, distinct persisted notes, Flow’s explicit pin, same-Cue revision isolation, global/deferred evidence with no Cue header, and task-tab focus. The production build’s actual `/` route runs at 390×844 with the real recorder and mocked Voice/Jev: Start, incoming Cue, Note/caret, Tab/Shift+Tab background isolation, Escape/focus return, Flow, Stop and no horizontal overflow. Its Display, Note and Flow screenshots are `artifacts/workbench-production-{display,note,flow}-390.png`. Archive coverage now includes hiding an open live sheet, resizing, opening a modal archive sheet, returning to the live note, and resizing back to desktop. The narrow presentation test closes the modal before using background provider controls; all source/presentation assertions remain.

Browser and Voice tests ran with permitted local listeners. No dependencies or provider/runtime contracts changed. Real paid Speechmatics/Jev/OpenAI calls, real teacher trials, merging and deployment were not performed. Automatic cross-close recovery (#17), ENRICH and REWORK backends remain separate work.
