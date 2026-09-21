import type { EvidenceFragment } from '../evidence/evidence-buffer';

// One shared domain contract. Transport adapters retain provider fields verbatim.
export type EvidenceRecord = EvidenceFragment & Readonly<{
  lessonId: string; captureId: string; providerSourceId: string; committedSequence: number;
}>;
export type EvidenceBinding = Readonly<{
  evidenceId: string; start: number; end: number; quote: string;
}>;
export type RoleBinding = Readonly<{
  bindingId: string; revision: number; speakerId: string;
  role: 'teacher' | 'student' | 'unknown';
  basis: 'configured' | 'teacher_confirmed' | 'supplied_metadata';
  basisRefs: readonly string[]; sourceRanges: readonly EvidenceBinding[];
}>;
export type AssetRef = Readonly<{
  packId: string; releaseId: string; assetId: string; assetVersion: string; digest: string;
}>;
// Stance is preserved, never inferred by string heuristics. New labels need a
// caller's explicit contract; only asserted content carries adoption authority.
export type CueContentPart = Readonly<{
  partId: string; stance: string; establishmentEvidence: readonly EvidenceBinding[];
  roleBindingRefs: readonly string[]; adoptionIds: readonly string[];
  replacesPartIds?: readonly string[];
}> & (Readonly<{ content: 'source_spans'; sourceBindings: readonly EvidenceBinding[] }> |
  Readonly<{ content: 'selected_asset'; assetRef: AssetRef; selectedText: string }>);
export type CueRevision = Readonly<{
  cueId: string; revision: number; previousRevision?: number; acceptedEventId: string;
  standing: 'current' | 'withdrawn'; parts: readonly CueContentPart[];
  establishmentEvidence: readonly EvidenceBinding[]; acceptedAt: number;
}>;
export type CueRecord = Readonly<{
  cueId: string; lessonId: string; identityKey: string; currentSemanticRevision: number;
  development: 'open' | 'settled'; lastLifecycleEventId: string; createdAt: number;
  revisions: readonly CueRevision[];
}>;
export type ReadSet = Readonly<{
  cues?: Readonly<Record<string, number>>; relations?: Readonly<Record<string, number>>;
  roles?: Readonly<Record<string, number>>; deferred?: Readonly<Record<string, number>>;
  processing?: Readonly<Record<string, number>>; lifecycle?: Readonly<Record<string, string>>;
  attention?: number;
}>;
export type CueRelation = Readonly<{
  relationId: string; relationRevision: number; fromCueId: string; toCueId: string;
  family: 'classroom_discourse' | 'classroom_domain' | 'external_domain'; kind: string;
  basisRefs: readonly EvidenceBinding[]; assetRefs: readonly AssetRef[]; dependencyReadSet: ReadSet;
  status: 'current' | 'needs_review' | 'withdrawn';
}>;
export type ContributionAdoption = Readonly<{
  adoptionId: string; contributionSourceRefs: readonly EvidenceBinding[];
  teacherEvidenceRefs: readonly EvidenceBinding[]; adoptedRanges: readonly EvidenceBinding[];
  excludedRanges: readonly EvidenceBinding[]; targetCueParts: readonly { cueId: string; partId: string }[];
  roleBindingRefs: readonly string[]; acceptedEventId: string;
}>;
export type DeferredEvidence = Readonly<{
  deferredId: string; revision: number; sourceRanges: readonly EvidenceBinding[]; reason: string;
  relatedCueIds: readonly string[]; createdEventId: string;
  status: 'open' | 'resolved' | 'closed_incomplete'; resolutionEvidence: readonly EvidenceBinding[];
}>;
export type ProcessingRange = Readonly<{
  start: number; end: number; status: 'recorded' | 'wait' | 'accounted' | 'deferred';
  eventId: string; deferredId?: string;
}>;
export type ProcessingState = Readonly<{ revision: number; ranges: readonly ProcessingRange[] }>;
export type ProcessingEffect = Readonly<{
  kind: 'WAIT' | 'NO_CHANGE' | 'ACCOUNT'; ranges: readonly EvidenceBinding[];
}>;
export type SemanticOperation =
  | { type: 'RECORD_EVIDENCE'; fragments: readonly EvidenceFragment[] }
  | { type: 'BIND_ROLE'; binding: RoleBinding }
  | { type: 'ADOPT'; adoption: Omit<ContributionAdoption, 'acceptedEventId'> }
  | { type: 'CREATE'; identityKey: string; parts: readonly CueContentPart[]; basis: readonly EvidenceBinding[] }
  | { type: 'EXTEND' | 'REVISE'; cueId: string; parts: readonly CueContentPart[]; removePartIds: readonly string[]; basis: readonly EvidenceBinding[] }
  | { type: 'MENTION' | 'RECALL' | 'SETTLE' | 'REOPEN' | 'WITHDRAW'; cueId: string; basis: readonly EvidenceBinding[] }
  | { type: 'RELATE'; relation: CueRelation }
  | { type: 'DEFER'; deferredId: string; ranges: readonly EvidenceBinding[]; reason: string; relatedCueIds: readonly string[] }
  | { type: 'RESOLVE_DEFERRED'; deferredId: string; status: 'resolved' | 'closed_incomplete'; basis: readonly EvidenceBinding[] };
export type SemanticProposal = Readonly<{
  proposalId: string; origin: 'host' | 'teacher' | 'jev' | 'llm';
  sessionId: string; sessionEpoch: number; readSet: ReadSet;
  operations: readonly SemanticOperation[]; processing: readonly ProcessingEffect[];
  // CREATE uses its identityKey here; existing objects use their stable cueId.
  foreground?: string; policyVersion: 'alive-foundation-v1';
}>;
export type AcceptedEvent = SemanticProposal & Readonly<{
  eventId: string; eventSequence: number; acceptedAt: number;
  createdCueIds: Readonly<Record<string, string>>; resultingVersions: ReadSet;
}>;
export type LessonState = Readonly<{
  sessionId: string; sessionEpoch: number; sequence: number;
  evidence: Readonly<Record<string, EvidenceRecord>>; evidenceOrder: readonly string[];
  cues: Readonly<Record<string, CueRecord>>; relations: Readonly<Record<string, CueRelation>>;
  roles: Readonly<Record<string, RoleBinding>>; adoptions: Readonly<Record<string, ContributionAdoption>>;
  deferred: Readonly<Record<string, DeferredEvidence>>; processing: Readonly<Record<string, ProcessingState>>;
  occurrences: readonly { cueId: string; kind: 'MENTION' | 'RECALL'; eventId: string; basis: readonly EvidenceBinding[] }[];
  attention: Readonly<{ revision: number; currentCueId: string | null; previousCueId: string | null; changedAt: number }>;
}>;
export type LessonHistory = Readonly<{
  format: 'alive-cue-v1'; sessionId: string; sessionEpoch: number; events: readonly AcceptedEvent[];
}>;
