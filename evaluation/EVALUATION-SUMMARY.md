# Historical product evaluation — actual observations

This report preserves observations from the earlier baseline/structured-context investigation. The application now uses only **structured-v3**, with explicit backticked state-field references following the current TypeSafe guidance. The TypeSafe skill, State, primitives/field references, Choice, HTTP API and source-span cookbook review is complete. No new paid evaluation was run for V3; these historical results do not establish its semantic quality or overall improvement. See [HANDOFF.md](HANDOFF.md) for the current implementation and remaining product questions.

## Method and identity

- Same production Cue Engine/provider and unchanged 20-second/32-fragment evidence plus latest 1/2/3/current-span candidate baseline.
- Input is the user's supplied MIT Lecture 9 mapping, using original VTT caption boundaries. Each caption is admitted only at its end. Reading paragraphs and labels are not model inputs.
- Source, reuse terms, original VTT hash, user labels and separate assistant labels are retained in `evaluation/materials/`.
- Baseline code: `61c21ed`, with original engine/context from main `92109f0`. Long replay metadata records the code and file hashes; existing tests were being added locally, so use the recorded component hashes as well as the commit.
- Comparison code: `c5d71bf`. Both context arms use the same updated engine. Single-request semantic replay makes the freshness-policy difference inactive.
- Model request used existing configuration; reported actual model was `jev-1.13.0`.
- No semantic labels are hard-coded as expected outputs. No accuracy/precision/recall is claimed.

## Recorded runs

The matching `.md`, `.json` and `.jsonl` files are preserved in the handoff archive and [checkpoint b793fec](https://github.com/shhh-hoo/CueLight/tree/b793fec6972c290bc28a5471144be6c7f7783f68/evaluation/runs). All 39 generated files were removed from current Git tracking while keeping the local copies unchanged in the ignored `evaluation/runs/` directory. Run names below identify historical artifacts, not selectable contexts in the current application.

| Run | Calls | Applied | Successful QUIET | Fallback | NEW / UPDATE | API p50 / p95 (ms) |
|---|---:|---:|---:|---:|---:|---:|
| baseline-smoke | 21 | 4 | 17 | 0 | 1 / 3 | 443.0 / 613.1 |
| baseline-long | 594 | 23 | 570 | 1 | 7 / 16 | 417.9 / 511.3 |
| development-intro-definition-baseline-v1 | 25 | 4 | 20 | 1 | 1 / 3 | 418.9 / 644.0 |
| development-intro-definition-structured-v2 | 25 | 5 | 20 | 0 | 5 / 0 | 437.8 / 553.3 |
| development-acceptor-clarification-baseline-v1 | 54 | 11 | 43 | 0 | 2 / 9 | 431.3 / 606.7 |
| development-acceptor-clarification-structured-v2 | 54 | 15 | 39 | 0 | 11 / 4 | 422.6 / 524.1 |
| development-radius-and-ions-baseline-v1 | 33 | 0 | 33 | 0 | 0 / 0 | 422.5 / 532.8 |
| development-radius-and-ions-structured-v2 | 33 | 0 | 33 | 0 | 0 / 0 | 441.7 / 530.1 |
| check-isoelectronic-baseline-v1 | 19 | 0 | 19 | 0 | 0 / 0 | 409.8 / 992.2 |
| check-isoelectronic-structured-v2 | 19 | 6 | 13 | 0 | 4 / 2 | 420.0 / 1000.4 |
| check-bond-types-baseline-v1 | 17 | 0 | 17 | 0 | 0 / 0 | 451.0 / 1291.4 |
| check-bond-types-structured-v2 | 17 | 8 | 9 | 0 | 3 / 5 | 435.3 / 1183.6 |
| paced-structured-v2 | 29 | 4 | 24 | 1 | 4 / 0 | 405.0 / 978.3 |

All runs had zero engine discards. The three fallbacks were at baseline-long chem-09-0354, intro baseline comparison chem-09-0018, and paced chem-09-0472. They are service/schema failure paths, not successful model QUIET. The safe error retained is “Jev returned no usable decision”; the exact raw cause was not captured, so do not infer a specific outage or malformed field.

Reported totals: 940 calls; 1,760,772 input and 85,816 output tokens. Monetary cost was not supplied/measured. A fallback may have usage because a response can supply usage but fail answer validation.

## Representative cases manually reviewed

All source IDs below use prefix `chem-09-`. The relevant run Markdown includes the full incoming window, every actual candidate, current Cue before the request, returned action, applied state and provenance.

| Case and supporting reference | Actual evidence/output | Interpretation |
|---|---|---|
| Licence opening; 0001–0002, 00:03.780 | Baseline NEW displays “The following content is provided under a Creative Commons license.” V2 intro omits it. | Candidate filler is present; the baseline decision selected it. This is a useful v2 change. The existence of an unlabelled Cue alone would not prove it unwanted; here its licence function is evident. |
| Electronegativity definition; U02/A01, 0018–0019, 00:59.610 | Long baseline first applies “So electron negativity, the net ability” at 0018, then completes it at 0019. V2 intro waits for the complete definition, but also creates several surrounding NEW Cues. | Premature decision when a better source span arrives next; no need to repair the transcript. V2 avoids this specific fragment, but density is mixed. |
| Acceptor explanation; U04–U06, 0083–0090 | Baseline comparison creates NEW from “that it has a high affinity for electrons.” V2 updates the previous acceptor statement with that explanation. Later v2 creates NEW with an unfinished “when you have a high ionization energy,” before completing it. | V2 improves one subject/context dependency but still chooses incomplete text and fragments the same explanation. Changes rise from 11 to 15 (4.76 to 6.49 per source minute); this is a descriptive comparison, not a fixed density threshold. |
| Chlorine mechanism; U10/A04, 0174–0180, 09:06.350–09:18.470 | Long baseline selects electron withdrawal, then expands to carbon reactivity and antibiotic effect. At 0177 it temporarily ends with “much more reactive”; by 0180 the cause/effect chain is complete. | Representative useful coverage, with premature intermediate wording. The candidate expansion from current provenance helps assemble more than three captions. |
| Atomic radius; U15/A07, 0279–0280, 14:14.590 | The two-fragment candidate contains “the atomic radius is defined by the value of r that has about 90% of the electron density.” Long baseline returns QUIET. | The useful definition and qualification were representable; this miss is not explained by candidate absence or scheduling discard. |
| Cation charge/loss/size; U19–U21, 0356–0358, 17:31.520 | A three-fragment candidate has cations positively charged, losing an electron, smaller than parent. Long baseline and both paired arms remain QUIET. Anions at 0367–0369 are similarly available. | Clear decision/context failure remains. The exact contribution of prior Cue state, prompt design and model behavior needs further diagnosis. |
| Fluorine/electron-poor explanation; U12–U13, 0227–0231 | The statement spans five captions. At 0231 the latest three omit the fluorine subject; the old Cue's source has left the window so the fourth expanding candidate does not exist. Later 0233–0235 gives an expressible restatement. | Local candidate coverage limitation exists, but does not explain all later misses. Do not infer that semantic splitting or a larger framework is already justified, or that Speechmatics Final will have this boundary. |
| Isoelectronic check; U27/A14, 0463–0467 | Baseline arm returns all QUIET. V2 builds “same electron configuration,” names isoelectronic and retains “don't necessarily have the same size.” It uses NEW while extending essentially the same point, then UPDATE. | V2 recovers valuable content; action identity and reading stability remain imperfect. Six changes in this short range are not six independent successes. |
| Fluorine question; Q04, 0469–0473 | V2 retains the question about gaining/losing electrons without supplying a future answer; it selects an initial then expanded question as two NEWs. | Grounding is useful; redundancy remains. Textual references such as “that configuration” can still depend on context. |
| Bond types check; U30–U32/A16–A18, 0555–0567 | Baseline arm stays QUIET. V2 produces electron transfer/ions/attraction, then covalent sharing, then unequal polar sharing toward the more electronegative atom. At 0557 it temporarily ends “a positively charged ion”; at 0563 NEW includes the previous covalent definition plus a polar introduction. | Useful topic tracking is recovered. Partial intermediate content and mixed transition text remain. Final candidate text stays verbatim and source grounded. Video closing captions are not selected here. |

The long baseline's last application is 0180 (09:18.470); the Cue remains unchanged to 30:22.990. There is no evidence-version discard in this sequential run. Thus the long semantic failure is primarily the model returning QUIET despite several good candidates, with candidate limitations at some other points.

## What changed and what did not

V2 labels latest speech, older background and current Cue provenance separately; removes opaque wall-clock fields from model-visible current Cue; and distinguishes repetition, clarification and a different teaching point. It includes examples of classroom administration versus substantive teaching. Candidate text and output actions are unchanged.

Comparisons are stateful within each segment and begin from the same archived baseline prefix. As soon as either arm makes a different decision, its future current-Cue/candidate-expansion state can differ. They are contextual product comparisons, not independent per-row classification accuracy.

Two check regions were reserved before editing v2 and not used for tuning. Their source text and human references were available earlier; they are not a wholly independent benchmark. They have now been inspected and must not be reused as “unseen” for future tuning claims.

No full revised 30-minute run was performed. **The evidence supports local gains and local regressions, not overall product improvement or generalization.** The current implementation uses V3 only; the earlier context implementations and selection options have been removed.

## Concurrency and timing

The old-engine continuous-arrival test failed because a new fragment made the pending decision stale. The amended guard allows bounded append-only progress, coalesces later input, and keeps reset/disposal isolation. Existing/new focused tests cover those deterministic contracts.

The live paced probe covers 23:30–24:30 at original caption end times, starting empty. It completed 29 decisions and four changes, with no overlapping arrival during an active decision in the recorded trace. It therefore does not exercise the new acceptance path under real overlap. That evidence comes from controlled tests, not this API run. Do not repeat calls simply to manufacture overlap.

Long-baseline provider p50/p95: 417.9/511.3 ms. Source-ready-to-Cue-state p50/p95 for applied changes: 431.7/567.8 ms. Paced provider p50/p95: 405.0/978.3 ms; applied Cue-state proxy p50/p95: 408.5/410.8 ms. These use different populations (all requests versus applied changes).

Provider time and first engine publication are separately recorded. Browser paint, speech end, ASR finalization, refinement delay, perceived reading burden and actual Speechmatics Final granularity are **unmeasured**.

## Next decision

Future product work should continue investigating Jev selection and reading stability. V3 has completed the field-reference correction, but its product behavior remains unmeasured. These are follow-up questions, not additional paid evaluations in this delivery. Some useful definitions already fit available candidates yet are ignored; optional OpenAI refinement cannot fix a Cue that never appears. The candidate-span limitation motivates a later small native Speechmatics Final boundary probe, not preemptive segmentation or ASR infrastructure.

Keep the user preference disagreements open: examples, classroom questions, reminders and ideal density are not settled. This work does not establish a target Cue count or treat unannotated text as negative labels.
