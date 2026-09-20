# Product Validation Policy

## TypeSafe / Jev skill

Always use the `typesafe-ai` skill for work in this project, especially Jev request construction, integration and evaluation. Locate and read its current `SKILL.md` before changing those paths; if it is unavailable, report that explicitly rather than silently substituting remembered API guidance.

CueLight is in an exploratory product phase. Optimize for learning from a working product, not for maximizing test coverage.

1. Do not add tests merely to increase coverage.

2. Separate product hypotheses from engineering contracts. Cue selection, timing, NEW_CUE versus UPDATE_CURRENT, information density, and visual behavior may still be hypotheses. Evaluate them through a runnable implementation before encoding them as extensive automated assertions.

3. Test deterministic engineering contracts immediately when failures would undermine experimentation. Examples include session isolation, source provenance, asynchronous result handling, and ensuring optional refinement cannot delay or overwrite the wrong Cue.

4. Add focused regression tests for observed bugs and accepted invariants where useful. Do not turn every subjective evaluation judgment into a permanent fixture.

5. Run the smallest relevant checks during iteration. Complete existing required repository and CI checks before delivery.

6. Keep evaluations proportionate to the current product question. Small diagnostic replays and readable comparison reports are encouraged. Do not introduce broad semantic benchmarks, exhaustive fixtures, prolonged reliability tests, or load tests without a concrete need.

7. Product evaluation may use live interaction, automated transcript/audio replay, and inspection of the resulting Cue sequence. Do not require repeated manual browser testing when an automated run can answer the question.

For each change, identify the product question, the engineering contracts that must remain reliable, and the smallest useful evaluation.
