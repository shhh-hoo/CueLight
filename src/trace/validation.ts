// Shape checks at the untrusted file boundary. The existing domain replay then
// validates authority, ranges, UTF-16 boundaries, dependencies and version results.
// No provider configuration or URL in a file is executable.
import { requireDomain as check } from '../alive/evidence';
import type { LessonHistory } from '../alive/types';

type Check = (value: unknown) => void;
const text: Check = v => check(typeof v === 'string', 'Expected text.');
const number: Check = v => check(typeof v === 'number' && Number.isFinite(v) && v >= 0, 'Invalid number.');
const integer: Check = v => { number(v); check(Number.isSafeInteger(v), 'Invalid integer.'); };
const choice = (...values: string[]): Check => v => check(typeof v === 'string' && values.includes(v), 'Unsupported value.');
const array = (item: Check): Check => v => { check(Array.isArray(v), 'Expected a list.'); v.forEach(item); };
const fields = (required: Record<string, Check>, optional: Record<string, Check> = {}): Check => v => {
  check(!!v && typeof v === 'object' && !Array.isArray(v), 'Expected an object.');
  const o = v as Record<string, unknown>;
  for (const [key, test] of Object.entries(required)) { check(Object.hasOwn(o, key), `Missing ${key}.`); test(o[key]); }
  for (const [key, test] of Object.entries(optional)) if (Object.hasOwn(o, key)) test(o[key]);
  check(Object.keys(o).every(key => Object.hasOwn(required, key) || Object.hasOwn(optional, key)), 'Unexpected file field.');
};
const dict = (item: Check): Check => v => {
  check(!!v && typeof v === 'object' && !Array.isArray(v), 'Expected a map.'); Object.values(v).forEach(item);
};
const strings = array(text);
const binding = fields({ evidenceId: text, start: integer, end: integer, quote: text });
const bindings = array(binding);
const asset = fields({ packId: text, releaseId: text, assetId: text, assetVersion: text, digest: text });
const reads = fields({}, { cues: dict(integer), relations: dict(integer), roles: dict(integer), deferred: dict(integer),
  processing: dict(integer), lifecycle: dict(text), attention: integer });
const part: Check = v => {
  const base = { partId: text, stance: text, establishmentEvidence: bindings, roleBindingRefs: strings, adoptionIds: strings };
  if ((v as { content?: string } | null)?.content === 'source_spans') fields({ ...base, content: choice('source_spans'), sourceBindings: bindings }, { replacesPartIds: strings })(v);
  else fields({ ...base, content: choice('selected_asset'), assetRef: asset, selectedText: text }, { replacesPartIds: strings })(v);
};
const role: Check = v => {
  const base = { bindingId: text, revision: integer, role: choice('teacher', 'student', 'unknown'),
    basis: choice('configured', 'teacher_confirmed', 'supplied_metadata'), basisRefs: strings, sourceRanges: bindings };
  if (v && typeof v === 'object' && 'subject' in v) fields({ ...base, subject: fields({ kind: choice('speaker', 'capture', 'channel'), id: text }) })(v);
  else fields({ ...base, speakerId: text })(v);
};
const fragment = fields({ id: text, text, startMs: number, endMs: number }, { sessionId: text, sequence: integer,
  cycle: integer, receivedAtMonoMs: number, speakerId: text, inputChannelId: text, language: text });
const relation = fields({ relationId: text, relationRevision: integer, fromCueId: text, toCueId: text,
  family: choice('classroom_discourse', 'classroom_domain', 'external_domain'), kind: text,
  basisRefs: bindings, assetRefs: array(asset), dependencyReadSet: reads, status: choice('current', 'needs_review', 'withdrawn') });
const operations: Record<string, Check> = {
  RECORD_EVIDENCE: fields({ type: choice('RECORD_EVIDENCE'), fragments: array(fragment) }),
  BIND_ROLE: fields({ type: choice('BIND_ROLE'), binding: role }),
  ADOPT: fields({ type: choice('ADOPT'), adoption: fields({ adoptionId: text, contributionSourceRefs: bindings,
    teacherEvidenceRefs: bindings, adoptedRanges: bindings, excludedRanges: bindings,
    targetCueParts: array(fields({ cueId: text, partId: text })), roleBindingRefs: strings }) }),
  CREATE: fields({ type: choice('CREATE'), identityKey: text, parts: array(part), basis: bindings }),
  RELATE: fields({ type: choice('RELATE'), relation }),
  DEFER: fields({ type: choice('DEFER'), deferredId: text, ranges: bindings, reason: text, relatedCueIds: strings }),
  RESOLVE_DEFERRED: fields({ type: choice('RESOLVE_DEFERRED'), deferredId: text, status: choice('resolved', 'closed_incomplete'), basis: bindings }),
};
for (const type of ['EXTEND', 'REVISE']) operations[type] = fields({ type: choice(type), cueId: text, parts: array(part), removePartIds: strings, basis: bindings });
for (const type of ['MENTION', 'RECALL', 'SETTLE', 'REOPEN', 'WITHDRAW']) operations[type] = fields({ type: choice(type), cueId: text, basis: bindings });
const operation: Check = v => {
  check(!!v && typeof v === 'object' && 'type' in v && typeof v.type === 'string' && Object.hasOwn(operations, v.type), 'Unknown operation.');
  operations[v.type]!(v);
};
const event = fields({ proposalId: text, origin: choice('host', 'teacher', 'jev', 'llm'), sessionId: text,
  sessionEpoch: integer, readSet: reads, operations: array(operation),
  processing: array(fields({ kind: choice('WAIT', 'NO_CHANGE', 'ACCOUNT'), ranges: bindings })),
  policyVersion: choice('alive-foundation-v1'), eventId: text, eventSequence: integer, acceptedAt: number,
  createdCueIds: dict(text), resultingVersions: reads }, { foreground: text,
  inspection: fields({ contractVersion: choice('alive-jev-v1'), inspectionId: text, stage: choice('primary', 'relation'),
    evidenceScope: bindings, selectedCandidate: fields({ action: text, key: text }), judgment: () => {} }, { parentInspectionId: text }) });

export const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;
export const MAX_ARCHIVE_EVENTS = 2_000;
// Run before domain code, whose internal typed input is not an untrusted parser.
export function validateJsonTree(value: unknown): void {
  let nodes = 0;
  const visit = (v: unknown, depth: number) => {
    check(++nodes <= 200_000 && depth <= 40, 'Record is too complex.');
    if (v && typeof v === 'object') for (const [key, child] of Object.entries(v)) {
      check(!['__proto__', 'prototype', 'constructor'].includes(key), 'Unsafe object key.'); visit(child, depth + 1);
    }
  };
  visit(value, 0);
}
export function validateHistory(value: unknown): asserts value is LessonHistory {
  fields({ format: choice('alive-cue-v1'), sessionId: text, sessionEpoch: integer,
    events: v => { check(Array.isArray(v) && v.length <= MAX_ARCHIVE_EVENTS, 'Record exceeds the 2,000 event limit.'); array(event)(v); } })(value);
  const history = value as LessonHistory;
  for (const e of history.events) {
    const keys = e.operations.filter(op => op.type === 'CREATE').map(op => op.identityKey);
    check(Object.keys(e.createdCueIds).length === keys.length && keys.every(k => Object.hasOwn(e.createdCueIds, k)), 'Invalid created Cue references.');
  }
}
export { fields, array, dict, text, integer, choice };
