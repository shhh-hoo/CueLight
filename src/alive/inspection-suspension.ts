import { relevantRoles } from './authority';
import { covers, overlaps, pendingBindings } from './evidence';
import { rangeKey } from './inspection';
import type { EvidenceBinding, LessonState } from './types';

export const MAX_SUSPENSIONS = 256;
// Session-local scheduling state, not semantic truth. The journal still owns WAIT
// and raw evidence. Do not evict an unresolved entry and accidentally retry it.
export class InspectionSuspensions {
  private entries = new Map<string, { ref: EvidenceBinding; fingerprint: string }>();
  clear() { this.entries.clear(); }
  private fingerprint(state: LessonState, ref: EvidenceBinding) {
    return JSON.stringify({ range: ref, processing: state.processing[ref.evidenceId]?.ranges
      .filter(r => overlaps(ref, { evidenceId: ref.evidenceId, ...r, quote: '' }))
      .map(r => [Math.max(r.start, ref.start), Math.min(r.end, ref.end), r.status, r.eventId]),
    roles: relevantRoles(state, [ref]).map(r => [r.bindingId, r.revision]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))) });
  }
  excluded(state: LessonState): ReadonlySet<string> {
    const pending = pendingBindings(state);
    for (const [key, entry] of this.entries) {
      if (!pending.some(ref => covers(ref, entry.ref)) || this.fingerprint(state, entry.ref) !== entry.fingerprint) this.entries.delete(key);
    }
    return new Set(this.entries.keys());
  }
  suspend(state: LessonState, refs: readonly EvidenceBinding[]) {
    this.excluded(state);
    for (const ref of refs) {
      const key = rangeKey([ref]);
      if (this.entries.has(key) || this.entries.size < MAX_SUSPENSIONS) this.entries.set(key, { ref, fingerprint: this.fingerprint(state, ref) });
    }
  }
  get atCapacity() { return this.entries.size >= MAX_SUSPENSIONS; }
}
