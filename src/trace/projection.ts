import { matchesRoleSubject } from '../alive/authority';
import type { CueRelation, CueRevision, EvidenceBinding, LessonHistory, LessonState } from '../alive/types';

export const actionLabels = {
  CREATE: '建立', EXTEND: '补充', REVISE: '修订', MENTION: '再次提及', RECALL: '回指',
  SETTLE: '暂时收束', REOPEN: '继续展开', WITHDRAW: '撤回', RELATE: '建立关系',
} as const;
export const processingLabels = { recorded: '已记录 · 待处理', wait: '等待上下文', accounted: '已处理', deferred: '暂缓梳理' } as const;
export const relationLabels: Record<string, string> = {
  ELABORATES: '解释／展开', EXAMPLE_OF: '示例／应用', CONTRASTS_WITH: '对比', RECAPS: '回顾', REFERENCES: '明确引用',
};
export const stanceLabels: Record<string, string> = {
  asserted: '陈述', question: '问题', hypothesis: '假设', hypothetical: '假设', quoted: '引用',
  criticized: '被批评的例子', unclassified: '作用未分类',
};
export const roleLabels = { teacher: '教师', student: '学生', unknown: '角色未知' } as const;

export function revisionText(revision: CueRevision): string {
  return revision.parts.map(part => part.content === 'source_spans'
    ? part.sourceBindings.map(ref => ref.quote).join(' ') : part.selectedText).join(' ');
}
export function sourceRoles(state: LessonState, ref: EvidenceBinding): string[] {
  const evidence = state.evidence[ref.evidenceId]!;
  const roles = Object.values(state.roles).filter(role => matchesRoleSubject(role, evidence) &&
    (role.sourceRanges.length === 0 || role.sourceRanges.some(range => range.evidenceId === ref.evidenceId && range.start < ref.end && range.end > ref.start)));
  if (!roles.length) return ['角色未知'];
  const coverage = roles.flatMap(role => role.sourceRanges.length ? role.sourceRanges.filter(r => r.evidenceId === ref.evidenceId)
    : [{ start: ref.start, end: ref.end }]).sort((a, b) => a.start - b.start);
  let coveredUntil = ref.start;
  for (const range of coverage) if (range.start <= coveredUntil) coveredUntil = Math.max(coveredUntil, range.end);
  const labels = roles.map(role => `${roleLabels[role.role]}${role.sourceRanges.length
    ? `（范围 ${role.sourceRanges.filter(r => r.evidenceId === ref.evidenceId).map(r => `[${r.start}, ${r.end})`).join(' / ')}）` : ''}`);
  if (coveredUntil < ref.end) labels.push('其余范围角色未知');
  return labels;
}
// Preserve the source's precision. A partial quote inherits the Final's interval;
// no character-to-time interpolation or first-to-last duration is calculated.
export function sourceTime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = (ms - minutes * 60_000) / 1_000;
  return `${minutes}:${seconds < 10 ? '0' : ''}${String(seconds)}`;
}
export function sourceInterval(state: LessonState, ref: EvidenceBinding): string {
  const e = state.evidence[ref.evidenceId]!;
  return `${sourceTime(e.startMs)}–${sourceTime(e.endMs)}`;
}
export type TraceStep = Readonly<{
  key: string; kind: keyof typeof actionLabels; cueId: string; revision: CueRevision;
  basis: readonly EvidenceBinding[]; eventSequence: number; acceptedAt: number; sourceStart: number;
  relation?: CueRelation; toCueId?: string;
}>;

// Reads the entire lesson, never the bounded semantic Working Set or display slots.
// Each row keeps the revision that existed at this operation, including multiple
// revisions of one Cue in one accepted transaction.
export function projectTrace(history: LessonHistory, state: LessonState) {
  const versions = new Map<string, number>();
  const steps: TraceStep[] = [];
  for (const event of history.events) {
    event.operations.forEach((op, index) => {
      if (!(op.type in actionLabels)) return;
      const cueId = op.type === 'CREATE' ? event.createdCueIds[op.identityKey]!
        : op.type === 'RELATE' ? op.relation.fromCueId : 'cueId' in op ? op.cueId : '';
      if (['CREATE', 'EXTEND', 'REVISE', 'WITHDRAW'].includes(op.type)) versions.set(cueId, (versions.get(cueId) ?? 0) + 1);
      const revision = state.cues[cueId]?.revisions.find(r => r.revision === versions.get(cueId));
      const basis = op.type === 'RELATE' ? op.relation.basisRefs : 'basis' in op ? op.basis : [];
      if (!revision || !basis.length) return; // Never invent an unsupported edge.
      steps.push({ key: `${event.eventId}/${index}`, kind: op.type as TraceStep['kind'], cueId, revision, basis,
        eventSequence: event.eventSequence, acceptedAt: event.acceptedAt,
        sourceStart: Math.min(...basis.map(ref => state.evidence[ref.evidenceId]!.startMs)),
        ...(op.type === 'RELATE' ? { relation: op.relation, toCueId: op.relation.toCueId } : {}) });
    });
  }
  const cues = Object.values(state.cues);
  return {
    cues, steps,
    sourceSteps: [...steps].sort((a, b) => a.sourceStart - b.sourceStart || a.eventSequence - b.eventSequence),
    processing: state.evidenceOrder.flatMap(id => state.processing[id]!.ranges.map(range => ({ evidenceId: id, ...range }))),
    relations: Object.values(state.relations).filter(relation => relation.basisRefs.length > 0),
  };
}
