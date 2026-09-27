import { covers, overlaps } from './evidence';
import type { EvidenceBinding, EvidenceRecord, LessonState, RoleBinding } from './types';

export const roleSubject = (role: RoleBinding) => role.subject ?? { kind: 'speaker' as const, id: role.speakerId };
export function matchesRoleSubject(role: RoleBinding, evidence: EvidenceRecord): boolean {
  const subject = roleSubject(role);
  return subject.id === (subject.kind === 'capture' ? evidence.captureId :
    subject.kind === 'channel' ? evidence.inputChannelId : evidence.speakerId);
}
export function roleCovers(state: LessonState, role: RoleBinding, ref: EvidenceBinding): boolean {
  return !!state.evidence[ref.evidenceId] && matchesRoleSubject(role, state.evidence[ref.evidenceId]!) &&
    (role.sourceRanges.length === 0 || role.sourceRanges.some(scope => covers(scope, ref)));
}
export function relevantRoles(state: LessonState, refs: readonly EvidenceBinding[]): RoleBinding[] {
  return Object.values(state.roles).filter(role => refs.some(ref =>
    state.evidence[ref.evidenceId] && matchesRoleSubject(role, state.evidence[ref.evidenceId]!) &&
    (role.sourceRanges.length === 0 || role.sourceRanges.some(scope => overlaps(scope, ref)))));
}
