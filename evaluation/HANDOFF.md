# CueLight continuation state

Continued from checkpoint `b793fec` on `feat/long-replay-jev-context`. The current implementation uses **structured-v3 only**. Earlier context implementations, runtime selection branches and the replay `--context` option have been removed.

## Current implementation

- V3 preserves the structured state and Cue decision semantics, with explicit backticked paths following the current TypeSafe skill/docs. References account for a missing current Cue; candidate text is still copied verbatim through bounded Choice options.
- Existing Engine, evidence/candidate rules, bounded append-only response acceptance, coalescing, reset/disposal/session isolation and replay tooling remain in place.
- Browser-free replay records provenance, exact requests, model/context/code identity and separate provider/publication timing. Archived-prefix reconstruction uses recorded local decisions strictly before a range; it does not invoke an older context implementation.
- Remove stale `JEV_CONTEXT_VERSION` settings from local configuration. Unset/empty or `structured-v3` is accepted; other values fail explicitly. No selector is needed for V3.
- The TypeSafe skill and relevant live State, primitives/field references, Choice, HTTP API and source-span cookbook review is complete.

## Evidence and outputs

The [historical evaluation summary](EVALUATION-SUMMARY.md) preserves 940 real Jev decisions, 3 fallbacks and the observed successes/failures. The original source, separate user/assistant annotations and [segments](segments.json) remain versioned. No new live calls, long replay or context comparison were run to adopt V3.

The 39 generated Markdown/JSON/JSONL run files are no longer tracked in the current tree. Their contents remain unchanged in local `evaluation/runs/`, the handoff package and [checkpoint b793fec](https://github.com/shhh-hoo/CueLight/tree/b793fec6972c290bc28a5471144be6c7f7783f68/evaluation/runs). `/evaluation/runs/` is ignored; new replay outputs normally go to the already-ignored `artifacts/` directory. This does not ignore source materials, tests, summaries or segment definitions.

## Run and verify

Use Node 24+ and `npm ci`. See the [README](../README.md) for browser and optional live usage.

```sh
# Offline plumbing only; no model calls.
npm run replay -- --to 65000 --out artifacts/offline-check

# Full deterministic verification; fake models only.
npm run check
```

The tests protect V3 state references/action mapping, configuration errors, provenance, future-text/annotation exclusion, immutable outputs and existing Engine/HTTP/browser contracts. Test outputs remain ignored. The final PR and its CI checks carry the delivery verification result.

## Remaining product questions

- V3 is the current context; no new semantic-quality claim is made from the historical evaluations or deterministic tests.
- The five-second streaming bounds permit progress but cannot detect a semantic correction, invalidation or topic change inside that interval. The recorded paced run had no overlap; controlled tests establish overlap progress.
- First-display values are Engine publication proxies. Browser paint, speech completion, ASR finalization, Speechmatics/refinement latency and perceived reading latency remain unmeasured.
- Selection quality, density and reading stability still need product learning. Speechmatics integration, OpenAI refinement and semantic freshness redesign remain future work.

Delivery uses the existing feature branch and a PR against main. Do not merge or deploy automatically. Preserve unrelated user changes and the read-only project mirror/handoff sources.
