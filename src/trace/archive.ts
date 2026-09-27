import { freeze, requireDomain as check, validateBinding } from '../alive/evidence';
import { replayLesson } from '../alive/journal';
import { parsePresentationReply } from '../refinement/presentation';
import { actionLabels, processingLabels, projectTrace, revisionText, sourceInterval, sourceRoles, sourceTime } from './projection';
import { array, choice, dict, fields, integer, MAX_ARCHIVE_BYTES, text, validateHistory, validateJsonTree } from './validation';
import { unknownRecord, type OpenedTrace, type TraceArchive } from './types';

const bool = (v: unknown) => check(typeof v === 'boolean', 'Expected true or false.');
const noteText = (v: unknown) => { text(v); check((v as string).length <= 10_000, 'Note exceeds 10,000 characters.'); };
const workspace = fields({
  notes: dict(fields({ text: noteText, mismatch: bool })),
  record: fields({ source: choice('demo', 'text-replay', 'microphone', 'unknown'),
    phase: choice('ready', 'capturing', 'paused', 'stopping', 'stopped', 'finished', 'interrupted', 'unknown'),
    issues: array(fields({ kind: choice('capture', 'processing'), message: text, observedAtSequence: integer })) }),
  presentations: array(fields({ cueId: text, revision: integer, result: v => check(parsePresentationReply({ result: v }), 'Invalid presentation.') })),
});

export function openTrace(json: string): OpenedTrace {
  check(new TextEncoder().encode(json).byteLength <= MAX_ARCHIVE_BYTES, '文件超过 8 MiB 上限。');
  const value: unknown = JSON.parse(json);
  validateJsonTree(value);
  let archive: TraceArchive;
  if (value && typeof value === 'object' && 'format' in value && value.format === 'alive-cue-v1') {
    validateHistory(value);
    archive = { format: 'cuelight-trace', version: 1, history: value, workspace: { notes: {}, record: unknownRecord, presentations: [] } };
  } else {
    fields({ format: choice('cuelight-trace'), version: v => check(v === 1, '不支持此 TRACE 文件版本。'), history: validateHistory, workspace })(value);
    archive = value as TraceArchive;
  }
  const lesson = replayLesson(archive.history);
  // Inspection metadata is not consumed by replay, but its source references
  // must still exist at that event; no future source can be smuggled into it.
  const recorded = new Map<string, number>();
  for (const event of archive.history.events) {
    for (const op of event.operations) if (op.type === 'RECORD_EVIDENCE') for (const f of op.fragments) {
      if (!recorded.has(f.id)) recorded.set(f.id, event.eventSequence);
    }
    for (const ref of event.inspection?.evidenceScope ?? []) {
      validateBinding(lesson, ref); check(recorded.has(ref.evidenceId), 'Inspection references future evidence.');
    }
  }
  for (const id of Object.keys(archive.workspace.notes)) check(Object.hasOwn(lesson.cues, id), 'Note references an unknown Cue.');
  for (const issue of archive.workspace.record.issues) check(issue.observedAtSequence <= lesson.sequence, 'Issue references a future record.');
  const presentations = new Set<string>();
  for (const p of archive.workspace.presentations) {
    check(lesson.cues[p.cueId]?.revisions.some(r => r.revision === p.revision), 'Presentation references an unknown Cue version.');
    const key = `${p.cueId}/${p.revision}`; check(!presentations.has(key), 'Duplicate presentation.'); presentations.add(key);
  }
  return { archive: freeze(archive), lesson };
}

export function serializeTrace(archive: TraceArchive): string {
  const json = JSON.stringify(archive, null, 2);
  // Export success must mean the result is supported by this same importer.
  openTrace(json);
  return json;
}

export async function readTraceFile(file: File): Promise<OpenedTrace> {
  check(file.size <= MAX_ARCHIVE_BYTES, '文件超过 8 MiB 上限。');
  return openTrace(await file.text());
}

export function downloadText(text: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  try {
    const link = document.createElement('a'); link.href = url; link.download = name;
    document.body.append(link);
    try { link.click(); } finally { link.remove(); }
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1_000); }
}

// Indented, escaped plain text avoids turning imported HTML/URLs/Markdown into
// executable links or markup in Markdown readers. Original evidence in JSON is exact.
const safe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}[\]()#+.!|~-])/g, '\\$1');
export function traceMarkdown({ archive, lesson }: OpenedTrace): string {
  const trace = projectTrace(archive.history, lesson);
  const lines = ['# CueLight · TRACE', '', '系统已接受的梳理，可回到原话核对；不代表完整课堂或教师评价。',
    `记录来源：${archive.workspace.record.source}；结束状态：${archive.workspace.record.phase}。`,
    '时间为来源片段区间；部分引用没有更细时间对齐。系统接受时间不是讲授时长。',
    'NO_CHANGE 不记录每一次重复。没有关系不表示教学缺陷。', '', '## Cue 与版本'];
  for (const cue of trace.cues) {
    lines.push('', `### ${safe(cue.cueId)}`);
    for (const revision of cue.revisions) {
      lines.push('', `版本 ${revision.revision} · ${revision.standing === 'withdrawn' ? '已撤回' : revision.revision === cue.currentSemanticRevision ? '当前' : '历史版本'}`,
        safe(revisionText(revision)), '内容引用：');
      for (const part of revision.parts) {
        lines.push(`- 作用：${safe(part.stance)}`);
        if (part.content === 'selected_asset') lines.push(`- 实际使用的材料：${safe(part.selectedText)} · ${safe(JSON.stringify(part.assetRef))}`);
        for (const ref of part.content === 'source_spans' ? part.sourceBindings : part.establishmentEvidence)
          lines.push(`- ${safe(ref.evidenceId)} [${ref.start}, ${ref.end}) · ${sourceInterval(lesson, ref)} · ${safe(ref.quote)}`);
      }
      lines.push('本版本建立／变化依据：');
      for (const ref of revision.establishmentEvidence) lines.push(`- ${safe(ref.evidenceId)} [${ref.start}, ${ref.end}) · ${sourceInterval(lesson, ref)} · ${safe(ref.quote)}`);
    }
    const note = archive.workspace.notes[cue.cueId];
    if (note) lines.push('', `教师工作笔记（不改写讲授）：${safe(note.text)}`, `梳理不符标记：${note.mismatch ? '是' : '否'}`);
  }
  lines.push('', '## 过程（来源顺序；同片段内顺序未知）');
  for (const step of trace.sourceSteps) lines.push(`- ${actionLabels[step.kind]} · ${safe(step.cueId)} v${step.revision.revision} · ${safe(revisionText(step.revision))}`,
    `  来源：${step.basis.map(ref => `${safe(ref.evidenceId)} [${ref.start}, ${ref.end}) ${sourceInterval(lesson, ref)}`).join(' / ')}；系统接受 #${step.eventSequence}，${step.acceptedAt} ms（处理时钟）。`);
  lines.push('', '## 有依据的关系');
  for (const relation of trace.relations) lines.push(`- ${safe(relation.fromCueId)} → ${safe(relation.toCueId)} · ${safe(relation.kind)} · ${relation.status} · ${relation.family}`,
    ...relation.basisRefs.map(ref => `  来源：${safe(ref.evidenceId)} [${ref.start}, ${ref.end}) · ${safe(ref.quote)}`));
  lines.push('', '## 讲授原文与处理范围');
  for (const id of lesson.evidenceOrder) {
    const e = lesson.evidence[id]!;
    lines.push('', `### ${safe(id)} · ${sourceTime(e.startMs)}–${sourceTime(e.endMs)}`,
      `角色：${sourceRoles(lesson, { evidenceId: id, start: 0, end: e.text.length, quote: e.text }).join('、')}；说话人：${safe(e.speakerId ?? '未知')}`, safe(e.text));
    for (const range of lesson.processing[id]!.ranges) lines.push(`- [${range.start}, ${range.end}) ${processingLabels[range.status]} · ${safe(e.text.slice(range.start, range.end))}`);
  }
  for (const d of Object.values(lesson.deferred)) lines.push(`暂缓项：${d.status} · ${safe(d.reason)} · ${d.sourceRanges.map(ref => safe(ref.evidenceId)).join(' / ')}`);
  lines.push('', '## 记录问题与限制', '未保存的历史错误原因未知；未捕获的音频、板书与课件不在记录内。');
  for (const issue of archive.workspace.record.issues) lines.push(`- ${issue.kind === 'capture' ? '采集问题／可能缺口' : '处理问题'} · 在记录 #${issue.observedAtSequence} 观察到：${safe(issue.message)}`);
  if (archive.workspace.presentations.length) {
    lines.push('', '## 整理表达（派生呈现，不是原话或新增证据）');
    for (const p of archive.workspace.presentations) lines.push(`- ${safe(p.cueId)} v${p.revision} · ${safe(JSON.stringify(p.result))}`);
  }
  return lines.join('\n') + '\n';
}
