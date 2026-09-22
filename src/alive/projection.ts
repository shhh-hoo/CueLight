import { relevantRoles } from './authority.ts';
import { EVIDENCE_WINDOW_MS, MAX_FRAGMENTS, type EvidenceWindow } from '../evidence/evidence-buffer.ts';
import type { Cue, CueState } from '../cue/types.ts';
import { binding, freeze, pendingBindings, requireDomain as check } from './evidence.ts';
import { currentRevision } from './reducer.ts';
import type { CueRecord, EvidenceBinding, LessonState, ReadSet } from './types.ts';

export function projectEvidenceWindow(state: LessonState): EvidenceWindow {
  const latest = state.evidence[state.evidenceOrder.at(-1) ?? ''];
  const cutoff = (latest?.endMs ?? 0) - EVIDENCE_WINDOW_MS;
  const fragments = state.evidenceOrder.map(id => state.evidence[id]!).filter(e => e.endMs >= cutoff).slice(-MAX_FRAGMENTS)
    .map(({ lessonId: _lesson, captureId: _capture, providerSourceId: _source, committedSequence: _sequence, ...fragment }) => fragment);
  return freeze({ version: state.evidenceOrder.length, fragments });
}

export function sourceText(cue: CueRecord): string {
  return currentRevision(cue).parts.map(part => part.content === 'source_spans'
    ? part.sourceBindings.map(ref => ref.quote).join(' ') : part.selectedText).join(' ');
}
export function projectCue(state: LessonState, id: string | null): Cue | null {
  const cue = id ? state.cues[id] : undefined;
  if (!cue || currentRevision(cue).standing === 'withdrawn') return null;
  const revision = currentRevision(cue);
  return freeze({ id: cue.cueId, text: sourceText(cue), sourceRevision: cue.currentSemanticRevision,
    sourceFragmentIds: [...new Set(revision.parts.flatMap(part => part.content === 'source_spans'
      ? part.sourceBindings.map(ref => ref.evidenceId) : part.establishmentEvidence.map(ref => ref.evidenceId)))],
    createdAt: cue.createdAt, updatedAt: revision.acceptedAt });
}
export function projectDisplay(state: LessonState, now: number, previousMs = 4_000, prior?: CueState): CueState {
  const stable = (cue: Cue | null, old: Cue | null | undefined) => cue && old &&
    cue.id === old.id && cue.sourceRevision === old.sourceRevision ? old : cue;
  const currentCue = stable(projectCue(state, state.attention.currentCueId), prior?.currentCue);
  const previousCue = stable(now - state.attention.changedAt < previousMs ? projectCue(state, state.attention.previousCueId) : null, prior?.currentCue?.id === state.attention.previousCueId ? prior.currentCue : prior?.previousCue);
  return prior && prior.currentCue === currentCue && prior.previousCue === previousCue ? prior : freeze({ currentCue, previousCue });
}
// Useful to future background jobs: semantic validity is independent of display.
export function matchesCueRevision(state: LessonState, cueId: string, revision: number): boolean {
  const cue = state.cues[cueId];
  return !!cue && cue.currentSemanticRevision === revision && currentRevision(cue).standing === 'current';
}
export function lookupLessonCues(state: LessonState, query: string): readonly CueRecord[] {
  const key = query.toLocaleLowerCase();
  return Object.values(state.cues).filter(cue => currentRevision(cue).standing === 'current' &&
    (cue.cueId === query || cue.identityKey === query || sourceText(cue).toLocaleLowerCase().includes(key)));
}
// Accepted event IDs end in the lesson-local monotonic sequence. Never use clock
// time or object insertion order to infer semantic relevance.
const eventOrder = (id: string) => Number(id.slice(id.lastIndexOf(':') + 1));
export function rankPartIds(cue: CueRecord, explicit: readonly string[] = []): string[] {
  const history = new Map<string, { established: number; modified: number }>();
  let previous = new Map<string, string>();
  for (const revision of cue.revisions) {
    const next = new Map<string, string>();
    for (const part of revision.parts) {
      const signature = JSON.stringify(part), prior = history.get(part.partId);
      history.set(part.partId, { established: prior?.established ?? revision.revision,
        modified: previous.has(part.partId) && previous.get(part.partId) !== signature || !previous.has(part.partId) && part.replacesPartIds?.length
          ? revision.revision : prior?.modified ?? 0 });
      next.set(part.partId, signature);
    }
    previous = next;
  }
  const parts = currentRevision(cue).parts;
  const rank = (id: string) => { const index = explicit.indexOf(id); return index < 0 ? Infinity : index; };
  const touched = (id: string) => Math.max(history.get(id)!.modified, history.get(id)!.established);
  return parts.map(p => p.partId).sort((a, b) => rank(a) - rank(b) || touched(b) - touched(a) ||
    history.get(b)!.modified - history.get(a)!.modified || history.get(b)!.established - history.get(a)!.established ||
    parts.findIndex(p => p.partId === a) - parts.findIndex(p => p.partId === b));
}
export type WorkingSetOptions = Readonly<{
  explicitCueIds?: readonly string[]; recalledCueIds?: readonly string[]; relevantCueIds?: readonly string[];
  explicitPartIds?: Readonly<Record<string, readonly string[]>>;
  maxCues?: number; maxEvidenceCodeUnits?: number;
}>;
export function semanticWorkingSet(state: LessonState, options: WorkingSetOptions = {}) {
  const maxCues = options.maxCues ?? 8, maxEvidence = options.maxEvidenceCodeUnits ?? 16_000;
  check(Number.isSafeInteger(maxCues) && maxCues >= 0 && Number.isSafeInteger(maxEvidence) && maxEvidence >= 0, 'Invalid Working Set budget.');
  const explicit = [...(options.explicitCueIds ?? []), ...(options.recalledCueIds ?? [])];
  const occurrence = new Map<string, number>();
  state.occurrences.forEach(o => occurrence.set(o.cueId, eventOrder(o.eventId)));
  const revisionOrder = (c: CueRecord) => eventOrder(currentRevision(c).acceptedEventId);
  const latest = (c: CueRecord) => Math.max(revisionOrder(c), occurrence.get(c.cueId) ?? 0);
  const all = Object.values(state.cues).filter(c => currentRevision(c).standing === 'current');
  const recent = (a: CueRecord, b: CueRecord) => latest(b) - latest(a) || a.cueId.localeCompare(b.cueId);
  const open = all.filter(c => c.development === 'open');
  const mentioned = all.filter(c => occurrence.has(c.cueId)).sort((a, b) => occurrence.get(b.cueId)! - occurrence.get(a.cueId)! || recent(a, b));
  const revised = all.filter(c => c.currentSemanticRevision > 1).sort((a, b) => revisionOrder(b) - revisionOrder(a) || recent(a, b));
  const requested = [...new Set([...explicit, ...(state.attention.currentCueId ? [state.attention.currentCueId] : []),
    ...mentioned.map(c => c.cueId), ...revised.map(c => c.cueId), ...(options.relevantCueIds ?? []),
    ...open.sort(recent).map(c => c.cueId), ...all.filter(c => c.development === 'settled').sort(recent).map(c => c.cueId)])];
  const cueIds = requested.filter(id => state.cues[id] && currentRevision(state.cues[id]!).standing === 'current').slice(0, maxCues);
  const cueSet = new Set(cueIds);
  // Relations are context only when BOTH endpoints already fit the selected view.
  // Rank independently and never expand the view by graph closure.
  const adjacent = Object.values(state.relations).filter(r => r.status !== 'withdrawn' && (cueSet.has(r.fromCueId) || cueSet.has(r.toCueId)));
  const rankedRelations = adjacent.filter(r => cueSet.has(r.fromCueId) && cueSet.has(r.toCueId)).sort((a, b) =>
    Math.max(...b.basisRefs.map(r => state.evidence[r.evidenceId]!.committedSequence)) -
    Math.max(...a.basisRefs.map(r => state.evidence[r.evidenceId]!.committedSequence)) || a.relationId.localeCompare(b.relationId));
  const requiredCueIds = cueIds;
  const cues = cueIds.map(id => state.cues[id]!);
  const partTargetOrder = Object.fromEntries(cues.map(c => [c.cueId, rankPartIds(c, options.explicitPartIds?.[c.cueId])]));
  const sourceIds = new Set(cues.flatMap(c => currentRevision(c).parts.flatMap(p =>
    [...p.establishmentEvidence, ...(p.content === 'source_spans' ? p.sourceBindings : [])].map(ref => ref.evidenceId))));
  cues.forEach(c => currentRevision(c).establishmentEvidence.forEach(ref => sourceIds.add(ref.evidenceId)));
  const pending = pendingBindings(state);
  const tail = pending.filter(ref => state.processing[ref.evidenceId]!.ranges.some(r => r.status === 'wait' && r.start === ref.start));
  const newEvidence: EvidenceBinding[] = [];
  let used = [...sourceIds].reduce((n, id) => n + state.evidence[id]!.text.length, 0);
  for (const ref of pending) {
    const size = sourceIds.has(ref.evidenceId) ? 0 : state.evidence[ref.evidenceId]!.text.length;
    if (used + size > maxEvidence) continue;
    used += size; sourceIds.add(ref.evidenceId); newEvidence.push(ref);
  }
  const adoptions = Object.values(state.adoptions).filter(a => a.targetCueParts.some(t => requiredCueIds.includes(t.cueId)));
  for (const adoption of adoptions) [...adoption.contributionSourceRefs, ...adoption.teacherEvidenceRefs].forEach(ref => sourceIds.add(ref.evidenceId));
  // Optional relation provenance must not crowd out primary source or Cue facts.
  const relations: typeof rankedRelations = [];
  let contextSize = [...sourceIds].reduce((n, id) => n + state.evidence[id]!.text.length, 0);
  for (const relation of rankedRelations) {
    const extra = [...new Set(relation.basisRefs.map(ref => ref.evidenceId))].filter(id => !sourceIds.has(id));
    const size = extra.reduce((n, id) => n + state.evidence[id]!.text.length, 0);
    if (relations.length === 8 || contextSize + size > maxEvidence) continue;
    relations.push(relation); extra.forEach(id => sourceIds.add(id)); contextSize += size;
  }
  const omittedRelationIds = adjacent.filter(r => !relations.includes(r)).map(r => r.relationId);
  const roles = relevantRoles(state, [...sourceIds].map(id => binding(state, id)));
  const evidence = state.evidenceOrder.filter(id => sourceIds.has(id)).map(id => state.evidence[id]!);
  const omittedCueIds = requested.filter(id => !requiredCueIds.includes(id));
  const omittedEvidence = pending.filter(ref => !newEvidence.includes(ref));
  const missing = explicit.filter(id => !requiredCueIds.includes(id));
  const readSet: ReadSet = { cues: Object.fromEntries(cues.map(c => [c.cueId, c.currentSemanticRevision])),
    relations: Object.fromEntries(relations.map(r => [r.relationId, r.relationRevision])),
    roles: Object.fromEntries(roles.map(r => [r.bindingId, r.revision])),
    deferred: Object.fromEntries(Object.values(state.deferred).filter(d => d.status === 'open').map(d => [d.deferredId, d.revision])),
    processing: Object.fromEntries(newEvidence.map(ref => [ref.evidenceId, state.processing[ref.evidenceId]!.revision])),
    attention: state.attention.revision };
  const contextBlocked = missing.length > 0 || evidence.reduce((n, e) => n + e.text.length, 0) > maxEvidence;
  const contextComplete = !contextBlocked && omittedCueIds.length === 0 && omittedEvidence.length === 0 && omittedRelationIds.length === 0;
  return freeze({ cues, partTargetOrder, relations, roles, adoptions, evidence, newEvidence,
    unresolvedTail: tail, deferred: Object.values(state.deferred).filter(d => d.status === 'open'), readSet,
    teacherControl: state.attention,
    coverage: { omittedCueIds, omittedEvidence, omittedRelationIds, missingExplicitCueIds: missing,
      contextBlocked, contextComplete,
      includedSourceRanges: evidence.map(e => binding(state, e.id)) } });
}
