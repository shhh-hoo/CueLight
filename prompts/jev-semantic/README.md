# Jev semantic interpreter

This module makes the existing `alive-jev-v1` classroom interpreter readable, reviewable in Git, and evaluable through its real production path.

Jev selects one grounded operation, each source alternative's pedagogical stance, and whether explicit relation evidence warrants an optional follow-up. It does not write canonical state, generate Cue prose, decide UI attention policy, assign speaker authority, retrieve omitted context, merge/split identities, settle topics, or implement background semantic repair.

| Decision | Existing meaning |
| --- | --- |
| WAIT | Preserve incomplete evidence or evidence whose required referent/context is missing. |
| NO_CHANGE | Account for understood repetition, filler or administration without semantic mutation. |
| CREATE | Establish a distinct teaching object, not one Cue per sentence/topic change. |
| REVISE | Develop/correct the same identity: append, replace a supplied part, or mark it criticised. |
| RECALL | Explicitly return to an existing object without new meaning or a semantic revision. |
| WITHDRAW | Direct teacher-grounded invalidation; never silence, topic change or outside disagreement. |
| RELATION_INTENT | Select the starting Cue for relation-only evidence; no revision, recall or foreground change. |

Optional relation inspection selects `NONE` or an explicit `ELABORATES`, `EXAMPLE_OF`, `CONTRASTS_WITH`, `RECAPS`, or `REFERENCES` endpoint/kind.

## Reading and authority

- [contract.md](contract.md): human-readable description of **current** semantics.
- [decisions.md](decisions.md): rationale supported by repository implementation notes/history.
- [instructions.ts](instructions.ts): **executable static wording**, imported by production; Markdown is not compiled into prompts.
- [inspection.ts](../../src/alive/inspection.ts): executable dynamic state, candidates, source/Cue/part aliases, criteria, bounds and compiler.
- [reducer.ts](../../src/alive/reducer.ts) and [journal.ts](../../src/alive/journal.ts): canonical validation/acceptance and journal writer.

The root README's canonical product/runtime authority order still applies. These notes describe the checked-in implementation; they do not supersede product decisions. If docs and executable behavior differ, investigate explicitly rather than silently rewriting a prompt.

**Available to Jev:** exact supplied source alternatives/ranges; bounded current Cue meanings, IDs/revisions and parts/stances; included relations, roles/adoptions and source metadata; omission/coverage summaries; relation origin in the follow-up. Host-generated candidates constrain choices.

**Deliberately unavailable:** full transcript/history, prior Cue revisions, generated presentation text, a privileged `currentCue` teaching focus, hidden omitted source bodies, teacher notes, audio, retrieval results, external factual truth and credentials. Display attention can affect Host ranking but is not a model authority signal. Classroom source is data, not system instructions.

## Commands (Node 24+)

```bash
npm ci
npm run eval:jev:validate   # config/schema validation; zero provider calls
npm run test:jev-evals     # fixture/provider/assertion/extraction tests; zero network
npm run eval:jev           # LIVE: real TypeSafe/Jev requests; may incur cost
npm run eval:jev:view      # local viewer for results from an explicitly run evaluation
```

Live runs require `TYPESAFE_API_KEY` in the environment, or `npm run eval:jev -- --env-file .env.local`. Optional `JEV_MODEL` / `JEV_TIMEOUT_MS` use production defaults (`jev-latest` / 5000 ms); pin the model for reproducible comparisons. The launcher enables live mode, prints the cost notice, disables telemetry/update checks, and keeps local data in ignored `.promptfoo/`. CI and missing opt-in block provider calls. Direct Promptfoo calls require explicit `CUELIGHT_JEV_EVAL_LIVE=1`. Use **validate config**, never **validate target** (which can call providers). Validation does not establish credentials or semantic quality.

The default suite has **22 curated cases**: 7 invariants, 7 boundaries, 7 regressions, and 1 exploratory observation, across identity/revision/wait/authority/recall/relation/coverage/compound. See [cases.ts](evals/cases.ts) for each principle, motivation, severity, fixture and allowed/forbidden result set. Two cases intentionally block before transport; a full default run makes at most **20 Jev calls**, one per remaining case, without adapter retries or automatic relation follow-ups. This is an inventory bound, not a currency budget. No paid or live evaluation was run when introducing this workflow.

## Evaluation path and limits

[provider.ts](evals/provider.ts) builds/replays authored accepted events and real role bindings, uses `captureInspection` → `semanticWorkingSet` (or `captureRelation` after an authored accepted intent), then calls production `buildSemanticRequest`, input validation, server `inspectWithJev`/parser, `compileProposal`, and `LessonStore.accept`. No parallel interpreter or browser server is used.

Normalized JSON exposes action/target/part/source, stance, coverage and actual model/confidence. `cueRevision` is the input target version; `resultingCueRevision` is the accepted version. Coverage blocks use `action: null`; failures return errors, never NO_CHANGE. The viewer receives the exact credential-free request.

Assertions use JavaScript, never model graders. Exploratory rows have no semantic assertion: any viewer “success” means ungraded, not correct. Offline tests use authored responses and establish engineering contracts only; the Promptfoo loader smoke runs with injected transport, network disabled and in-memory results.

Known risks: finite candidate/context coverage, unstable `jev-latest`, ambiguous identity/stance, one-primary-operation compound loss, teacher-centric authority, and source-first wording limitations. This harness evaluates one captured inspection; existing runtime tests cover orchestration. Relation follow-ups are isolated from primary intent, and microphone, scheduling, retrieval and presentation quality remain outside its scope. Do not classify a missing candidate/context as model error without examining coverage. Promptfoo's upstream package brings a large development-only dependency graph; it is not imported into the browser runtime.

Commit authored fixtures, assertions and reviewable wording. Keep keys, `.promptfoo/` DB/cache, exports, screenshots and paid results out of Git; use `evals/outputs/` or `evals/screenshots/` for optional local exports. CI validates config, runs offline tests (including baseline request snapshots), and preserves existing typecheck, Voice and browser checks. A future before/after GitHub Promptfoo action would need explicit cost/credential decisions; none is configured.
