# CueLight continuation checkpoint

This commit preserves unfinished work for continuation in the **CueLight** project. It is not a completed product-validation claim. Main at the start was `92109f0`; earlier local checkpoints were `61c21ed` and `c5d71bf`. The current feature branch is `feat/long-replay-jev-context`.

Read [the actual evaluation summary](EVALUATION-SUMMARY.md), [segment definitions](segments.json), and the individual Markdown/JSON/JSONL traces in `runs/`. Original user and assistant references are separately retained under `materials/`. Do not repeat the whole paid baseline without a specific reason.

Always use the official [typesafe-ai skill](https://github.com/typesafe-ai/skills/blob/main/skills/typesafe-ai/SKILL.md) and follow the repository Product Validation Policy. The skill's main file was read; review of the current State, Choice, HTTP API and source-span cookbook pages was interrupted. Finish that review before further Jev changes. In particular, verify whether v2's plain field references need backticked paths; their effect is not yet established. Preserve the recorded experimental context/version if a new variant is introduced.

Latest design: https://docs.google.com/document/d/1rTZiWCVA_7uPSBgMYyFycpPqJ8313Xu7knKF3ZswNcs

## Completed

- Browser-free replay using the real Cue Engine, with original caption boundaries, no future text/labels, immutable run output names, source provenance and separate API/Cue-state timing.
- One 594-caption baseline through 30:22.990, a 21-caption smoke, five paired segment comparisons and one paced probe: 940 real Jev calls in total; 3 fallbacks. No new calls during packaging.
- Bounded append-only response acceptance, one request in flight, coalesced subsequent evidence, and reset/disposal isolation. Focused tests reproduce the old progress failure and verify the new engineering rule.
- Experimental structured-v2 context. Results are mixed; baseline-v1 remains default. No candidate/window changes.
- Latest complete checks passed: TypeScript, production build, 77 unit/contract/integration tests and 14 Playwright tests.

## Still unfinished

1. Finish TypeSafe skill/live-document review and code review. No independent review was performed.
2. Reassess the streaming guard's limits: five-second age/source bounds do not recognize a semantic correction or topic switch inside that interval. The real-paced probe had no overlapping arrival during an active request; only controlled tests exercised overlap.
3. Finalize the product report and README. The README still has stale initial-slice claims about no real calls and discarding all advanced evidence. The included evaluation summary is interim.
4. Decide whether to compress redundant raw traces before final PR review without losing source/context/run reproducibility.
5. Finish the original PR delivery if still requested. No PR was created, merged or deployed at this checkpoint. Do not merge or deploy automatically.

Overall improvement has not been demonstrated: v2 recovers useful isoelectronic/bond content but misses the ion-radius segment and increases some display churn. First-display values are engine-publication proxies, not browser paint or speech latency. No revised full-length run, Speechmatics integration or OpenAI refinement has been performed.

## Run

Use Node 24+ and install dependencies with `npm ci`. The previous machine used Node 26.8.1.

```sh
# Offline plumbing only; no semantic inference:
npm run replay -- --to 65000 --out artifacts/offline-check

# Explicit paid call with existing authorized configuration:
npm run replay -- --live --env-dir /path/to/existing/config --context baseline-v1 --to 65000 --out artifacts/new-smoke

# Small contextual comparison, only when there is a concrete reason to rerun:
npm run replay -- --live --env-dir /path/to/existing/config --context structured-v2 --prefix-run evaluation/runs/baseline-long.json --from 1381610 --to 1432420 --out artifacts/new-check

npm run check
```

No credentials are committed. A completed run with a fallback exits nonzero after writing its report; inspect `interrupted` and `accepted`. `--mode paced` uses original caption end times at 1×; semantic replay waits for each response. They do not measure the same thing. Future speech should use Speechmatics-native Final boundaries, with no preemptive grouper/VAD/repair; future OpenAI must not block initial Cue display.
