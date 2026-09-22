import { MAX_FRAGMENT_CHARS, type EvidenceFragment } from '../evidence/evidence-buffer';
import type { EvidenceBinding, LessonState, ProcessingRange } from './types';

export function requireDomain(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function validId(id: string): void {
  requireDomain(typeof id === 'string' && !!id.trim() && !['__proto__', 'constructor', 'prototype'].includes(id), 'Invalid domain identity.');
}
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
export function sameFragment(a: EvidenceFragment, b: EvidenceFragment): boolean {
  const fields: readonly (keyof EvidenceFragment)[] = ['id', 'text', 'startMs', 'endMs', 'sessionId', 'sequence', 'cycle', 'receivedAtMonoMs', 'speakerId', 'inputChannelId', 'language'];
  return fields.every(key => a[key] === b[key]);
}
export function validateFragment(fragment: EvidenceFragment): void {
  validId(fragment.id);
  requireDomain(typeof fragment.text === 'string' && fragment.text.trim() && fragment.text.length <= MAX_FRAGMENT_CHARS &&
    Number.isFinite(fragment.startMs) && Number.isFinite(fragment.endMs) && fragment.startMs >= 0 &&
    fragment.endMs >= fragment.startMs, 'Invalid finalized fragment.');
}
export function binding(state: LessonState, evidenceId: string, start = 0, end = state.evidence[evidenceId]?.text.length ?? 0): EvidenceBinding {
  const result = { evidenceId, start, end, quote: state.evidence[evidenceId]?.text.slice(start, end) ?? '' };
  validateBinding(state, result); return freeze(result);
}
export function validateBinding(state: LessonState, ref: EvidenceBinding): void {
  const evidence = state.evidence[ref.evidenceId];
  requireDomain(evidence, 'Unknown evidence.');
  const boundary = (offset: number) => offset === 0 || offset === evidence.text.length ||
    !(evidence.text.charCodeAt(offset - 1) >= 0xd800 && evidence.text.charCodeAt(offset - 1) <= 0xdbff &&
      evidence.text.charCodeAt(offset) >= 0xdc00 && evidence.text.charCodeAt(offset) <= 0xdfff);
  requireDomain(Number.isSafeInteger(ref.start) && Number.isSafeInteger(ref.end) && ref.start >= 0 &&
    ref.end > ref.start && ref.end <= evidence.text.length && boundary(ref.start) && boundary(ref.end) &&
    ref.quote === evidence.text.slice(ref.start, ref.end), 'Invalid evidence range or exact quote.');
}
export function covers(outer: EvidenceBinding, inner: EvidenceBinding): boolean {
  return outer.evidenceId === inner.evidenceId && outer.start <= inner.start && outer.end >= inner.end;
}
export function overlaps(a: EvidenceBinding, b: EvidenceBinding): boolean {
  return a.evidenceId === b.evidenceId && a.start < b.end && b.start < a.end;
}
// A processing range is disjoint from its neighbours. Grounding never calls this.
export function processRange(ranges: readonly ProcessingRange[], ref: EvidenceBinding, next: Omit<ProcessingRange, 'start' | 'end'>): readonly ProcessingRange[] {
  const result: ProcessingRange[] = [];
  for (const range of ranges) {
    if (range.end <= ref.start || range.start >= ref.end) { result.push(range); continue; }
    requireDomain(range.status !== 'accounted', 'Evidence is already accounted for.');
    requireDomain(range.status !== 'deferred' || next.deferredId === range.deferredId, 'Resolve deferred evidence explicitly.');
    if (range.start < ref.start) result.push({ ...range, end: ref.start });
    result.push({ ...next, start: Math.max(range.start, ref.start), end: Math.min(range.end, ref.end) });
    if (range.end > ref.end) result.push({ ...range, start: ref.end });
  }
  return result;
}
export function pendingBindings(state: LessonState, ids = state.evidenceOrder): readonly EvidenceBinding[] {
  return ids.flatMap(id => (state.processing[id]?.ranges ?? []).filter(r => r.status === 'recorded' || r.status === 'wait')
    .map(r => binding(state, id, r.start, r.end)));
}
export function accounting(state: LessonState) {
  let accountedFrontier = 0;
  for (const id of state.evidenceOrder) {
    if (!state.processing[id]!.ranges.every(r => r.status === 'accounted')) break;
    accountedFrontier++;
  }
  return { recordedFrontier: state.evidenceOrder.length, accountedFrontier,
    accountedCodeUnits: Object.values(state.processing).flatMap(p => p.ranges)
      .filter(r => r.status === 'accounted').reduce((n, r) => n + r.end - r.start, 0) };
}
