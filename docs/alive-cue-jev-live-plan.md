# Proposed live Jev qualification — NOT RUN

Requires separate approval. No paid Jev, OpenAI or Speechmatics calls were made
for this implementation. Mocks establish only engineering invariants.

Freeze the final PR head SHA, source bytes, initial AcceptedEvent histories and
all captured options before running. Use the new semantic adapter directly, not
the quarantined structured-v3 replay CLI. Do not choose new fixtures after seeing
answers, or retry failures to improve apparent scores.

## Exact proposed request and budget contract

- **12 HTTP requests total**, one pass; zero automatic retries or replacement calls.
- Model: **`jev-1.13.0`**, explicitly pinned (official model page checked 2026-09-22).
- API: HTTP v1 `/systemone`; `alive-jev-v1` contract; `alive-foundation-v1` acceptance.
- Timeout: 5,000 ms each. Primary: one operation Choice, one independent stance
  Choice per legal source alternative, and one independent relation-evidence Choice.
  Relation requests: one Choice with NONE and the five allowed discourse kinds.
- Bounds: 8 Cues, 16,000 evidence code units, 3 source alternatives, 4 target parts,
  128 operation options, provider-body guard 48,000 code units; no confidence cutoff.
- Hard total budget: **US$0.05**. Official published input pricing is $0.042/M tokens,
  output free, and the request context ceiling is 64k tokens. Twelve full-ceiling
  requests would cost at most **$0.032256** at that price. Recheck price/model availability
  before approval; a changed rate/config requires a revised budget, not silent substitution.
- No OpenAI/Speechmatics calls, audio replay, deployment, or automatic fixture expansion.
  Setup Cues and role authority use deterministic accepted events, not additional calls.

## Frozen request inventory

| Requests | Scenario | Expected comparison |
| --- | --- | --- |
| 1–2 | Definition of Insight, then explanation of how it works | CREATE vs same-object REVISE or distinct related CREATE |
| 3 | Return to Insight after a different foreground Cue | RECALL old ID, no duplicate |
| 4–5 | Incomplete condition, then genuine repetition | WAIT vs NO_CHANGE and accounting |
| 6–7 | Darcy example primary, then relationship | Grounded primary; EXAMPLE_OF vs NONE |
| 8–9 | One Final with two independent teaching points | Strictly advancing subranges; two bounded accepted steps |
| 10–12 | Beloved basic analysis, teacher marks it simplistic, stronger analysis | CREATE, stance/correction REVISE, appropriate development |

Requests 7 and 9 are dependent follow-ups. If the actual preceding judgment does
not justify the follow-up or progress, mark its slot **NOT_RUN** rather than forcing
acceptance or substituting a different call. Thus 12 is the exact maximum planned
inventory; every slot must be reported, including failures and unexecuted slots.

Report request/response/config, actual input tokens and cost, candidate coverage,
selected identity/part/source, acceptance/rejection, processing advancement and
observed failure category. Judge source fidelity, identity continuity, stance,
conditions and explicit relations; do not optimize Cue count. Separate a missing
candidate/context from a bad supplied-option choice. Preserve failures and stop on
budget exhaustion. This trial cannot establish general classroom usefulness.

Sources: [official model/pricing page](https://docs.typesafe.ai/models),
[HTTP API](https://docs.typesafe.ai/api), [confidence guidance](https://docs.typesafe.ai/confidence).
