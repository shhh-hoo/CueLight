import { validateDecision, type DecisionInput } from '../decision/decision-provider';
import type { CueDecision } from '../decision/types';
import { binding, pendingBindings } from './evidence';
import { currentRevision } from './reducer';
import type { CueContentPart, LessonState, SemanticOperation, SemanticProposal } from './types';

// Transitional structured-v3 adapter, not the Alive Cue ontology. In particular,
// QUIET cannot distinguish unfinished speech from understood/no-change. Preserve
// it as WAIT; only Slice III's explicit judgments may produce NO_CHANGE.
export function legacyProposal(state: LessonState, input: DecisionInput, decision: CueDecision, proposalId: string): SemanticProposal | null {
  decision = validateDecision(decision, input.candidates);
  const candidate = decision.action === 'QUIET' ? undefined : input.candidates.find(c => c.id === decision.candidateId);
  const ids = candidate?.sourceFragmentIds ?? input.evidence.fragments.map(f => f.id);
  const process = pendingBindings(state, ids);
  const cue = input.currentCue ? state.cues[input.currentCue.id] : undefined;
  const readSet = {
    cues: cue ? { [cue.cueId]: cue.currentSemanticRevision } : {},
    processing: Object.fromEntries(process.map(ref => [ref.evidenceId, state.processing[ref.evidenceId]!.revision])),
    roles: Object.fromEntries(Object.values(state.roles).filter(role => role.sourceRanges.some(ref => ids.includes(ref.evidenceId))).map(role => [role.bindingId, role.revision])),
    attention: state.attention.revision,
  };
  const base = { proposalId, origin: 'jev' as const, sessionId: state.sessionId, sessionEpoch: state.sessionEpoch,
    policyVersion: 'alive-foundation-v1' as const, readSet };
  if (!candidate) return process.length ? { ...base, operations: [], processing: [{ kind: 'WAIT', ranges: process }] } : null;
  const refs = candidate.sourceFragmentIds.map(id => binding(state, id));
  if (refs.map(ref => ref.quote).join(' ') !== candidate.text) throw new Error('Legacy candidate does not match recorded source.');
  const part: CueContentPart = { partId: 'legacy-source', content: 'source_spans', sourceBindings: refs,
    establishmentEvidence: refs, stance: 'unclassified', roleBindingRefs: [], adoptionIds: [] };
  let operation: SemanticOperation;
  let foreground: string;
  if (decision.action === 'UPDATE_CURRENT' && cue) {
    foreground = cue.cueId;
    const old = currentRevision(cue).parts;
    const unchanged = old.length === 1 && old[0]!.content === 'source_spans' &&
      JSON.stringify(old[0]!.sourceBindings) === JSON.stringify(refs);
    operation = unchanged ? { type: 'MENTION', cueId: cue.cueId, basis: refs } :
      { type: 'REVISE', cueId: cue.cueId, parts: [part], removePartIds: old.map(p => p.partId), basis: refs };
  } else {
    // Canonical source identity, independent of candidate/window/request ID.
    // v3 has no separate semantic-object identifier: exact re-selection recalls
    // its existing object. Distinct overlapping objects use explicit Host CREATE
    // identity keys; bounded semantic identity judgments belong to Slice III.
    const identityKey = `legacy:${JSON.stringify(refs.map(({ evidenceId, start, end }) => [evidenceId, start, end]))}`;
    const matches = Object.values(state.cues).filter(c => c.identityKey === identityKey ||
      (c.identityKey.startsWith('legacy:') && c.revisions.some(revision => revision.parts.length === 1 &&
        revision.parts[0]!.content === 'source_spans' && JSON.stringify(revision.parts[0]!.sourceBindings) === JSON.stringify(refs))));
    if (matches.length > 1) throw new Error('Legacy selection has ambiguous Cue identity; explicit targeting is required.');
    const existing = matches[0];
    if (existing) {
      operation = { type: 'RECALL', cueId: existing.cueId, basis: refs };
      foreground = existing.cueId;
      readSet.cues[existing.cueId] = existing.currentSemanticRevision;
    } else {
      operation = { type: 'CREATE', identityKey, parts: [part], basis: refs }; foreground = identityKey;
    }
  }
  return { ...base, operations: [operation], foreground,
    processing: process.length ? [{ kind: 'ACCOUNT', ranges: process }] : [] };
}
