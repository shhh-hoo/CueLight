import { matchesRoleSubject, relevantRoles, roleCovers, roleSubject } from './authority';
import { covers, freeze, overlaps, processRange, sameFragment, requireDomain as check, validId, validateBinding, validateFragment } from './evidence';
import type { AcceptedEvent, CueContentPart, CueRecord, CueRevision, EvidenceBinding, LessonState, ReadSet, SemanticProposal } from './types';

export function emptyLesson(sessionId: string, sessionEpoch = 0): LessonState {
  validId(sessionId);
  check(Number.isSafeInteger(sessionEpoch) && sessionEpoch >= 0, 'Invalid session epoch.');
  return freeze({ sessionId, sessionEpoch, sequence: 0, evidence: {}, evidenceOrder: [], cues: {}, relations: {},
    roles: {}, adoptions: {}, deferred: {}, processing: {}, occurrences: [],
    attention: { revision: 0, currentCueId: null, previousCueId: null, changedAt: 0 } });
}
export const currentRevision = (cue: CueRecord): CueRevision => cue.revisions.at(-1)!;

export function checkReadSet(state: LessonState, read: ReadSet): void {
  const versions = {
    cues: Object.fromEntries(Object.values(state.cues).map(c => [c.cueId, c.currentSemanticRevision])),
    relations: Object.fromEntries(Object.values(state.relations).map(r => [r.relationId, r.relationRevision])),
    roles: Object.fromEntries(Object.values(state.roles).map(r => [r.bindingId, r.revision])),
    deferred: Object.fromEntries(Object.values(state.deferred).map(d => [d.deferredId, d.revision])),
    processing: Object.fromEntries(Object.entries(state.processing).map(([id, p]) => [id, p.revision])),
  };
  for (const key of Object.keys(versions) as (keyof typeof versions)[]) {
    for (const [id, version] of Object.entries(read[key] ?? {})) {
      validId(id);
      check(Number.isSafeInteger(version) && version >= 0 && (versions[key][id] ?? 0) === version, `Stale ${key} dependency: ${id}.`);
    }
  }
  for (const [id, eventId] of Object.entries(read.lifecycle ?? {})) {
    check(state.cues[id]?.lastLifecycleEventId === eventId, `Stale lifecycle dependency: ${id}.`);
  }
  if (read.attention !== undefined) check(read.attention === state.attention.revision, 'Stale attention dependency.');
}
export function resultVersions(state: LessonState): ReadSet {
  return {
    cues: Object.fromEntries(Object.values(state.cues).map(c => [c.cueId, c.currentSemanticRevision])),
    relations: Object.fromEntries(Object.values(state.relations).map(r => [r.relationId, r.relationRevision])),
    roles: Object.fromEntries(Object.values(state.roles).map(r => [r.bindingId, r.revision])),
    deferred: Object.fromEntries(Object.values(state.deferred).map(d => [d.deferredId, d.revision])),
    processing: Object.fromEntries(Object.entries(state.processing).map(([id, p]) => [id, p.revision])),
    lifecycle: Object.fromEntries(Object.values(state.cues).map(c => [c.cueId, c.lastLifecycleEventId])),
    attention: state.attention.revision,
  };
}

// Pure transaction candidate. No writes, clocks, provider calls, or diagnostics.
export function reduceAccepted(state: LessonState, event: AcceptedEvent): LessonState {
  check(event.sessionId === state.sessionId && event.sessionEpoch === state.sessionEpoch, 'Wrong session or epoch.');
  check(event.eventSequence === state.sequence + 1 && event.eventId === `${state.sessionId}:${event.eventSequence}`, 'Invalid event order.');
  check(event.policyVersion === 'alive-foundation-v1' && Number.isFinite(event.acceptedAt), 'Invalid acceptance policy/time.');
  check(['host', 'teacher', 'jev', 'llm'].includes(event.origin), 'Unknown proposal origin.');
  validId(event.proposalId);
  checkReadSet(state, event.readSet);
  const next = { ...state, sequence: event.eventSequence, evidence: { ...state.evidence }, evidenceOrder: [...state.evidenceOrder],
    cues: { ...state.cues }, roles: { ...state.roles }, adoptions: { ...state.adoptions }, relations: { ...state.relations },
    deferred: { ...state.deferred }, processing: { ...state.processing }, occurrences: [...state.occurrences] };
  const ranges = (refs: readonly EvidenceBinding[], required = true) => {
    check(!required || refs.length > 0, 'An explicit evidence basis is required.');
    refs.forEach(ref => validateBinding(next, ref));
  };
  const readCue = (id: string) => {
    const cue = next.cues[id]; check(cue, 'Unknown Cue.');
    if (state.cues[id]) check(event.readSet.cues?.[id] === state.cues[id]!.currentSemanticRevision, 'Missing Cue revision dependency.');
    check(currentRevision(cue).standing === 'current', 'Withdrawn Cue cannot be restored or used.');
    return cue;
  };
  const requireRoleReads = (refs: readonly EvidenceBinding[]) => {
    const roles = relevantRoles(next, refs);
    for (const role of roles) {
      if (state.roles[role.bindingId]) check(event.readSet.roles?.[role.bindingId] === role.revision, 'Missing role dependency.');
    }
    return roles;
  };
  const teacherGrounded = (refs: readonly EvidenceBinding[], roleIds: readonly string[]) => {
    const roles = requireRoleReads(refs);
    return refs.length > 0 && roles.every(role => role.role === 'teacher') && refs.every(ref => roles.some(role => roleIds.includes(role.bindingId) && role.role === 'teacher' &&
      roleCovers(next, role, ref)));
  };
  const teacherEstablished = (part: CueContentPart) => part.stance === 'asserted' ||
    relevantRoles(next, part.establishmentEvidence).some(role => role.role === 'teacher');
  const validateParts = (parts: readonly CueContentPart[], cueId: string) => {
    check(parts.length > 0 && new Set(parts.map(p => p.partId)).size === parts.length, 'Cue parts must be nonempty and unique.');
    for (const part of parts) {
      validId(part.partId); check(typeof part.stance === 'string' && part.stance.trim(), 'Explicit stance is required.');
      ranges(part.establishmentEvidence);
      const source = part.content === 'source_spans' ? part.sourceBindings : part.establishmentEvidence;
      ranges(source); requireRoleReads(source);
      for (const id of part.roleBindingRefs) {
        check(next.roles[id], 'Unknown role binding.');
        if (state.roles[id]) check(event.readSet.roles?.[id] === state.roles[id]!.revision, 'Missing role dependency.');
      }
      for (const id of part.adoptionIds) check(next.adoptions[id], 'Unknown adoption.');
      if (part.content === 'selected_asset') {
        Object.values(part.assetRef).forEach(value => check(typeof value === 'string' && value.trim(), 'Exact Asset version and digest required.'));
        check(part.selectedText.trim() && teacherGrounded(part.establishmentEvidence, part.roleBindingRefs), 'Asset selection requires teacher evidence.');
      } else check(part.content === 'source_spans', 'Unknown content kind.');
      if (part.stance === 'asserted') {
        for (const ref of source) {
          const adopted = part.adoptionIds.some(id => {
            const adoption = next.adoptions[id]!;
            return adoption.adoptedRanges.some(a => covers(a, ref)) &&
              adoption.targetCueParts.some(target => target.cueId === cueId && target.partId === part.partId) &&
              teacherGrounded(adoption.teacherEvidenceRefs, adoption.roleBindingRefs);
          });
          check(teacherGrounded([ref], part.roleBindingRefs) || adopted, 'Assertion lacks teacher authority or exact adoption.');
        }
      }
    }
  };
  const revise = (cue: CueRecord, parts: readonly CueContentPart[], basis: readonly EvidenceBinding[], standing: CueRevision['standing'] = 'current') => {
    const revision: CueRevision = { cueId: cue.cueId, revision: cue.currentSemanticRevision + 1,
      previousRevision: cue.currentSemanticRevision, acceptedEventId: event.eventId, standing, parts,
      establishmentEvidence: basis, acceptedAt: event.acceptedAt };
    next.cues[cue.cueId] = { ...cue, currentSemanticRevision: revision.revision, revisions: [...cue.revisions, revision] };
  };
  const processed: EvidenceBinding[] = [];
  const process = (refs: readonly EvidenceBinding[], status: 'wait' | 'accounted' | 'deferred', deferredId?: string) => {
    ranges(refs);
    for (const ref of refs) {
      check(!processed.some(other => overlaps(other, ref)), 'Overlapping processing effects.'); processed.push(ref);
      check(event.readSet.processing?.[ref.evidenceId] === state.processing[ref.evidenceId]?.revision, 'Missing processing dependency.');
      const prior = next.processing[ref.evidenceId]!;
      next.processing[ref.evidenceId] = { revision: state.processing[ref.evidenceId]!.revision + 1,
        ranges: processRange(prior.ranges, ref, { status, eventId: event.eventId, ...(deferredId ? { deferredId } : {}) }) };
    }
  };
  let createIndex = 0;
  for (const op of event.operations) {
    // Foundation does not enable background semantic writes. The legacy Jev
    // adapter cannot assign roles, adopt students, or infer relations/lifecycle.
    check(event.origin !== 'llm', 'Background semantic operations are not enabled.');
    if (event.origin === 'jev') check(['CREATE', 'EXTEND', 'REVISE', 'MENTION', 'RECALL', 'DEFER', 'RESOLVE_DEFERRED'].includes(op.type), 'Operation not enabled for Jev.');
    switch (op.type) {
      case 'RECORD_EVIDENCE': {
        check(event.origin === 'host', 'Only the capture host records evidence.');
        for (const fragment of op.fragments) {
          validateFragment(fragment);
          const previous = next.evidence[fragment.id];
          const captureId = fragment.sessionId ?? state.sessionId;
          const providerSourceId = fragment.sequence === undefined ? fragment.id : String(fragment.sequence);
          if (previous) {
            check(sameFragment(previous, fragment), 'Provider identity was reused with changed evidence.');
            continue;
          }
          check(!Object.values(next.evidence).some(e => e.captureId === captureId && e.providerSourceId === providerSourceId), 'Provider identity has a different evidence ID.');
          const last = next.evidence[next.evidenceOrder.at(-1) ?? ''];
          check(!last || fragment.endMs >= last.endMs, 'Finalized fragments must arrive in timestamp order.');
          next.evidence[fragment.id] = { ...fragment, lessonId: state.sessionId, captureId, providerSourceId, committedSequence: next.evidenceOrder.length + 1 };
          next.evidenceOrder.push(fragment.id);
          next.processing[fragment.id] = { revision: 0, ranges: [{ start: 0, end: fragment.text.length, status: 'recorded', eventId: event.eventId }] };
        }
        break;
      }
      case 'BIND_ROLE': {
        const role = op.binding; validId(role.bindingId); validId(roleSubject(role).id);
        check(['speaker', 'capture', 'channel'].includes(roleSubject(role).kind), 'Invalid role subject.');
        ranges(role.sourceRanges, roleSubject(role).kind === 'speaker');
        check(['teacher', 'student', 'unknown'].includes(role.role) && ['configured', 'teacher_confirmed', 'supplied_metadata'].includes(role.basis) && role.basisRefs.length > 0, 'Role needs an explicit authority basis.');
        check(role.sourceRanges.every(ref => matchesRoleSubject(role, next.evidence[ref.evidenceId]!)), 'Role does not match source subject.');
        const previous = state.roles[role.bindingId];
        check(role.revision === (previous?.revision ?? 0) + 1 && event.readSet.roles?.[role.bindingId] === (previous?.revision ?? 0), 'Missing/stale role revision.');
        check(!Object.values(next.roles).some(other => other.bindingId !== role.bindingId && other.role !== role.role &&
          ((roleSubject(other).kind === roleSubject(role).kind && roleSubject(other).id === roleSubject(role).id &&
            (other.sourceRanges.length === 0 || role.sourceRanges.length === 0)) ||
          Object.values(next.evidence).some(e => roleCovers(next, role, { evidenceId: e.id, start: 0, end: e.text.length, quote: e.text }) &&
            roleCovers(next, other, { evidenceId: e.id, start: 0, end: e.text.length, quote: e.text })) ||
          other.sourceRanges.some(a => role.sourceRanges.some(b => overlaps(a, b))))), 'Conflicting source roles.');
        next.roles[role.bindingId] = role; break;
      }
      case 'ADOPT': {
        const adoption = op.adoption; validId(adoption.adoptionId);
        check(!next.adoptions[adoption.adoptionId], 'Adoption is immutable.');
        ranges(adoption.contributionSourceRefs); ranges(adoption.teacherEvidenceRefs); ranges(adoption.adoptedRanges); ranges(adoption.excludedRanges, false);
        check(teacherGrounded(adoption.teacherEvidenceRefs, adoption.roleBindingRefs), 'Adoption lacks teacher confirmation.');
        const contributionRoles = requireRoleReads(adoption.contributionSourceRefs);
        check(adoption.contributionSourceRefs.every(ref => contributionRoles.some(role => role.role === 'student' &&
          adoption.roleBindingRefs.includes(role.bindingId) && roleCovers(next, role, ref))), 'Contribution lacks sourced student role.');
        check([...adoption.adoptedRanges, ...adoption.excludedRanges].every(ref => adoption.contributionSourceRefs.some(source => covers(source, ref))), 'Adoption exceeds contribution.');
        check(!adoption.adoptedRanges.some(a => adoption.excludedRanges.some(b => overlaps(a, b))), 'Adopted and excluded ranges overlap.');
        for (const target of adoption.targetCueParts) readCue(target.cueId);
        check(adoption.targetCueParts.length > 0, 'Adoption requires a target.');
        next.adoptions[adoption.adoptionId] = { ...adoption, acceptedEventId: event.eventId }; break;
      }
      case 'CREATE': {
        validId(op.identityKey); ranges(op.basis);
        check(!Object.values(next.cues).some(c => c.identityKey === op.identityKey), 'Semantic identity already exists; use its Cue ID.');
        const cueId = event.createdCueIds[op.identityKey];
        check(cueId === `cue-${state.sessionEpoch}-${event.eventSequence}-${++createIndex}`, 'CREATE identity must be Host-assigned.');
        validateParts(op.parts, cueId);
        const revision: CueRevision = { cueId, revision: 1, acceptedEventId: event.eventId, standing: 'current',
          parts: op.parts, establishmentEvidence: op.basis, acceptedAt: event.acceptedAt };
        next.cues[cueId] = { cueId, lessonId: state.sessionId, identityKey: op.identityKey, currentSemanticRevision: 1,
          development: 'open', lastLifecycleEventId: event.eventId, createdAt: event.acceptedAt, revisions: [revision] };
        break;
      }
      case 'EXTEND': case 'REVISE': {
        const cue = readCue(op.cueId); ranges(op.basis);
        const old = currentRevision(cue).parts;
        check(op.parts.length + op.removePartIds.length > 0, 'Empty semantic revision.');
        check(op.removePartIds.every(id => old.some(p => p.partId === id)), 'Unknown removed part.');
        if (op.type === 'EXTEND') check(op.removePartIds.length === 0 && op.parts.every(p => !(p.replacesPartIds?.length) && !old.some(previous => previous.partId === p.partId)), 'EXTEND only adds new parts.');
        for (const part of op.parts) check((part.replacesPartIds ?? []).every(id => old.some(p => p.partId === id)), 'Unknown replaced part.');
        const replaced = new Set([...op.removePartIds, ...op.parts.flatMap(p => [p.partId, ...(p.replacesPartIds ?? [])])]);
        if (old.some(teacherEstablished)) {
          check(teacherGrounded(op.basis, requireRoleReads(op.basis).map(role => role.bindingId)), 'Semantic mutation requires teacher-grounded correction evidence.');
        }
        // Each replacement anchors at its earliest replaced position. Disjoint
        // groups follow original composition order; genuinely new parts append.
        const owners = new Set<string>();
        const anchored = op.parts.map(part => {
          const ids = [...new Set([part.partId, ...(part.replacesPartIds ?? [])])].filter(id => old.some(p => p.partId === id));
          check(ids.every(id => !owners.has(id)), 'Ambiguous overlapping part replacements.');
          ids.forEach(id => owners.add(id));
          return { part, index: ids.length ? Math.min(...ids.map(id => old.findIndex(p => p.partId === id))) : old.length };
        });
        const parts = old.flatMap((part, index) => [
          ...anchored.filter(entry => entry.index === index).map(entry => entry.part),
          ...(!replaced.has(part.partId) ? [part] : []),
        ]).concat(anchored.filter(entry => entry.index === old.length).map(entry => entry.part));
        validateParts(parts, cue.cueId); revise(cue, parts, op.basis); break;
      }
      case 'MENTION': case 'RECALL': {
        readCue(op.cueId); ranges(op.basis);
        next.occurrences.push({ cueId: op.cueId, kind: op.type, eventId: event.eventId, basis: op.basis }); break;
      }
      case 'SETTLE': case 'REOPEN': {
        const cue = readCue(op.cueId); ranges(op.basis);
        check(event.readSet.lifecycle?.[cue.cueId] === state.cues[cue.cueId]?.lastLifecycleEventId, 'Missing lifecycle dependency.');
        next.cues[cue.cueId] = { ...cue, development: op.type === 'SETTLE' ? 'settled' : 'open', lastLifecycleEventId: event.eventId }; break;
      }
      case 'WITHDRAW': {
        const cue = readCue(op.cueId); ranges(op.basis);
        if (currentRevision(cue).parts.some(teacherEstablished)) {
          check(teacherGrounded(op.basis, requireRoleReads(op.basis).map(role => role.bindingId)), 'Withdrawal requires teacher-grounded evidence.');
        }
        revise(cue, currentRevision(cue).parts, op.basis, 'withdrawn'); break;
      }
      case 'RELATE': {
        const relation = op.relation; validId(relation.relationId);
        readCue(relation.fromCueId); readCue(relation.toCueId); ranges(relation.basisRefs);
        checkReadSet(next, relation.dependencyReadSet);
        check(relation.dependencyReadSet.cues?.[relation.fromCueId] === next.cues[relation.fromCueId]!.currentSemanticRevision &&
          relation.dependencyReadSet.cues?.[relation.toCueId] === next.cues[relation.toCueId]!.currentSemanticRevision, 'Relation must depend on both Cue versions.');
        const previous = state.relations[relation.relationId];
        check(relation.relationRevision === (previous?.relationRevision ?? 0) + 1 && event.readSet.relations?.[relation.relationId] === (previous?.relationRevision ?? 0), 'Missing relation dependency.');
        check(['current', 'needs_review', 'withdrawn'].includes(relation.status) && relation.kind.trim(), 'Invalid relation.');
        if (relation.family === 'external_domain') check(relation.assetRefs.length > 0, 'External relation needs an exact Asset.');
        else check(['classroom_discourse', 'classroom_domain'].includes(relation.family), 'Invalid relation family.');
        if (relation.family === 'classroom_domain') {
          check(teacherGrounded(relation.basisRefs, requireRoleReads(relation.basisRefs).map(role => role.bindingId)), 'Classroom-domain relation requires teacher authority.');
          for (const role of requireRoleReads(relation.basisRefs)) check(relation.dependencyReadSet.roles?.[role.bindingId] === role.revision, 'Relation requires role provenance dependency.');
        }
        next.relations[relation.relationId] = relation; break;
      }
      case 'DEFER': {
        validId(op.deferredId); check(!next.deferred[op.deferredId] && op.reason.trim(), 'Invalid deferred identity/reason.');
        op.relatedCueIds.forEach(readCue); process(op.ranges, 'deferred', op.deferredId);
        next.deferred[op.deferredId] = { deferredId: op.deferredId, revision: 1, sourceRanges: op.ranges,
          reason: op.reason, relatedCueIds: op.relatedCueIds, createdEventId: event.eventId, status: 'open', resolutionEvidence: [] }; break;
      }
      case 'RESOLVE_DEFERRED': {
        const deferred = next.deferred[op.deferredId];
        check(deferred?.status === 'open' && event.readSet.deferred?.[op.deferredId] === deferred.revision, 'Missing/stale deferred dependency.');
        check(['resolved', 'closed_incomplete'].includes(op.status), 'Invalid deferred resolution.');
        ranges(op.basis);
        if (op.status === 'resolved') process(deferred.sourceRanges, 'accounted', deferred.deferredId);
        next.deferred[op.deferredId] = { ...deferred, revision: deferred.revision + 1, status: op.status, resolutionEvidence: op.basis }; break;
      }
      default: throw new Error('Unknown semantic operation.');
    }
  }
  for (const effect of event.processing) {
    check(event.origin !== 'llm', 'Background processing is not enabled.');
    check(['WAIT', 'NO_CHANGE', 'ACCOUNT'].includes(effect.kind), 'Unknown processing effect.');
    if (effect.kind === 'NO_CHANGE') check(event.operations.every(op => ['MENTION', 'RECALL'].includes(op.type)), 'NO_CHANGE cannot accompany semantic mutation.');
    process(effect.ranges, effect.kind === 'WAIT' ? 'wait' : 'accounted');
  }
  for (const adoption of Object.values(next.adoptions)) {
    check(adoption.targetCueParts.every(target => next.cues[target.cueId]?.revisions.some(revision => revision.parts.some(part => part.partId === target.partId))), 'Unknown adoption target part.');
  }
  // Only actual dependencies invalidate a relation. No transitive graph repair.
  for (const relation of Object.values(next.relations)) {
    if (relation.status !== 'current') continue;
    try { checkReadSet(next, relation.dependencyReadSet); }
    catch { next.relations[relation.relationId] = { ...relation, relationRevision: relation.relationRevision + 1, status: 'needs_review' }; }
  }
  if (event.foreground !== undefined) {
    check(event.origin !== 'llm' && event.readSet.attention === state.attention.revision, 'Missing attention dependency/permission.');
    const cueId = event.createdCueIds[event.foreground] ?? event.foreground;
    readCue(cueId);
    if (next.attention.currentCueId !== cueId) next.attention = { revision: next.attention.revision + 1,
      currentCueId: cueId, previousCueId: next.attention.currentCueId, changedAt: event.acceptedAt };
  }
  for (const slot of ['currentCueId', 'previousCueId'] as const) {
    const id = next.attention[slot];
    if (id && currentRevision(next.cues[id]!).standing === 'withdrawn') next.attention = { ...next.attention, [slot]: null, revision: next.attention.revision + 1 };
  }
  return freeze(next);
}

export function prepareAcceptance(state: LessonState, proposal: SemanticProposal, acceptedAt: number): { event: AcceptedEvent; state: LessonState } {
  const sequence = state.sequence + 1;
  let createIndex = 0;
  const createdCueIds: Record<string, string> = {};
  for (const op of proposal.operations) if (op.type === 'CREATE') {
    validId(op.identityKey);
    check(!createdCueIds[op.identityKey], 'Duplicate identity in proposal.');
    createdCueIds[op.identityKey] = `cue-${state.sessionEpoch}-${sequence}-${++createIndex}`;
  }
  const event: AcceptedEvent = { ...structuredClone(proposal), eventId: `${state.sessionId}:${sequence}`,
    eventSequence: sequence, acceptedAt, createdCueIds, resultingVersions: {} };
  const result = reduceAccepted(state, event);
  return { event: freeze({ ...event, resultingVersions: resultVersions(result) }), state: result };
}
