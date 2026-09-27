import { useMemo, useRef, useState } from 'react';
import type { EvidenceBinding, LessonHistory, LessonState } from '../alive/types';
import { actionLabels, processingLabels, projectTrace, relationLabels, revisionText, roleLabels, sourceInterval, sourceRoles, sourceTime, stanceLabels } from '../trace/projection';
import type { TeacherNote, TraceArchive } from '../trace/types';
import { CueContent } from './CueSurface';

const phaseLabels = { ready: '尚未开始', capturing: '正在记录', paused: '已暂停', stopping: '正在结束并处理尾部', stopped: '采集已停止', finished: '文本回放已结束', interrupted: '记录中断', unknown: '结束状态未知' };
const sourceLabels = { demo: '离线编写示例 · 非真实课堂验证', 'text-replay': '文本回放', microphone: '麦克风采集', unknown: '来源类型未知' };
const statusLabels = { current: '当前关系', needs_review: '依赖已变化 · 需复核', withdrawn: '关系已撤回' };
function Highlight({ text, ranges }: { text: string; ranges: readonly { start: number; end: number }[] }) {
  const boundaries = [...new Set([0, text.length, ...ranges.flatMap(r => [r.start, r.end])])].sort((a, b) => a - b);
  return <>{boundaries.slice(0, -1).map((start, i) => {
    const end = boundaries[i + 1]!;
    return ranges.some(r => r.start <= start && r.end >= end)
      ? <mark key={start}>{text.slice(start, end)}</mark> : <span key={start}>{text.slice(start, end)}</span>;
  })}</>;
}

export function TraceView({ history, lesson, workspace, onNote, readOnly = false }: {
  history: LessonHistory; lesson: LessonState; workspace: TraceArchive['workspace'];
  onNote?: (cueId: string, note: TeacherNote) => void; readOnly?: boolean;
}) {
  const detailRef = useRef<HTMLElement>(null);
  const trace = useMemo(() => projectTrace(history, lesson), [history, lesson]);
  const [selection, setSelection] = useState<string | null>(null);
  const [revisionNumber, setRevisionNumber] = useState<number | null>(null);
  const [order, setOrder] = useState<'source' | 'accepted'>('source');
  const [focusRefs, setFocusRefs] = useState<readonly EvidenceBinding[]>([]);
  const selected = lesson.cues[selection ?? ''] ?? trace.cues[0];
  const revision = selected?.revisions.find(r => r.revision === revisionNumber) ?? selected?.revisions.at(-1);
  const note = workspace.notes[selected?.cueId ?? ''] ?? { text: '', mismatch: false };
  const label = (id: string) => `Cue ${trace.cues.findIndex(c => c.cueId === id) + 1}`;
  const navigateSource = (refs: readonly EvidenceBinding[]) => {
    setFocusRefs(refs);
    // A local navigation action only; no semantic owner or provider is reachable.
    requestAnimationFrame(() => document.getElementById(`${readOnly ? 'file' : 'live'}-source`)?.focus());
  };
  const focusDetail = () => {
    if (window.matchMedia('(max-width: 800px)').matches) requestAnimationFrame(() => detailRef.current?.focus());
  };
  const references = (refs: readonly EvidenceBinding[]) => refs.map((ref, i) => <button className="source-link" key={`${ref.evidenceId}/${ref.start}/${i}`}
    onClick={() => navigateSource([ref])}>{sourceInterval(lesson, ref)} · 原文 {lesson.evidenceOrder.indexOf(ref.evidenceId) + 1} [{ref.start}, {ref.end})</button>);
  const focusIds = new Set(focusRefs.map(ref => ref.evidenceId));
  const pending = trace.processing.filter(r => r.status !== 'accounted').length;
  return <section className="trace-workspace" aria-label="教师 TRACE">
    <div className="trace-intro"><div><p className="eyebrow">教师工作台 / TRACE V0</p><h1>看清这次讲授的脉络</h1>
      <p>系统梳理与原话对照。浏览、笔记与标记不会改写讲授记录。</p></div>
      <span className="trace-badge">{readOnly ? '文件 · 只读查看' : sourceLabels[workspace.record.source]}</span></div>
    <div className="trace-summary" role="status"><span>{trace.cues.length} 个 Cue</span><span>{lesson.evidenceOrder.length} 段原文</span>
      <span>{phaseLabels[workspace.record.phase]}</span><span>{pending ? `${pending} 个范围待处理／待上下文` : '当前已记录范围无待处理项'}</span></div>
    <p className="trace-help">停止采集、处理队列空闲或文件导出，均不代表整课已完整理解。未捕获的音频、板书和课件不在记录内。</p>
    <div className="trace-columns">
      <div className="trace-overview"><section aria-label="全部 Cue"><h2>教学对象 <small>{trace.cues.length}</small></h2>
        {!trace.cues.length && <p className="trace-empty">开始离线示例或讲授后，有来源的 Cue 会留在这里。结束后仍可查看。</p>}
        <div className="cue-index">{trace.cues.map((cue, index) => <button key={cue.cueId} className="cue-choice" data-testid="cue-choice" data-cue-id={cue.cueId}
          aria-pressed={selected?.cueId === cue.cueId} onClick={() => { setSelection(cue.cueId); setRevisionNumber(null); setFocusRefs([]); focusDetail(); }}>
          <span>{index + 1 < 10 ? `0${index + 1}` : index + 1} · {cue.revisions.at(-1)!.standing === 'withdrawn' ? '已撤回' : `版本 ${cue.currentSemanticRevision}`}</span>
          <strong>{revisionText(cue.revisions[0]!)}</strong>
          {workspace.notes[cue.cueId]?.mismatch && <em>教师标记：梳理不符</em>}
        </button>)}</div></section>
        <section aria-label="讲授过程"><div className="trace-section-heading"><h2>发展过程</h2><label>排列依据<select aria-label="过程排列依据" value={order} onChange={e => setOrder(e.target.value as typeof order)}>
          <option value="source">来源时间</option><option value="accepted">系统接受顺序</option></select></label></div>
          <p className="trace-help">同一来源片段内没有更细时间对齐；接受顺序可能晚于讲授。已记录提及不代表完整重复次数。</p>
          <ol className="trace-steps">{(order === 'source' ? trace.sourceSteps : trace.steps).map(step => <li key={step.key}>
            <button data-testid="trace-step" onClick={() => { setSelection(step.cueId); setRevisionNumber(step.revision.revision); setFocusRefs(step.basis); focusDetail(); }}>
              <span className="step-meta">{step.basis.map(ref => sourceInterval(lesson, ref)).filter((v, i, all) => all.indexOf(v) === i).join(' / ')} · {actionLabels[step.kind]}</span>
              <strong>{label(step.cueId)} · v{step.revision.revision}{step.toCueId ? ` → ${label(step.toCueId)}` : ''}</strong>
              <span>{step.relation ? `${relationLabels[step.relation.kind] ?? step.relation.kind} · 关系版本 ${step.relation.relationRevision}` : revisionText(step.revision)}</span><small>系统接受顺序 #{step.eventSequence}</small>
            </button><details className="step-acceptance"><summary>接受记录 #{step.eventSequence}</summary><p>{step.acceptedAt} ms · 系统处理时钟，不是讲授时间。</p></details></li>)}</ol>
        </section>
      </div>
      <div className="trace-detail-column">
        {selected && revision ? <article ref={detailRef} tabIndex={-1} className="trace-detail" aria-label="Cue 详情" data-testid="cue-detail" data-cue-id={selected.cueId}>
          <div className="trace-section-heading"><h2>{label(selected.cueId)} <small>{selected.revisions.at(-1)!.standing === 'withdrawn' ? '已撤回' : selected.development === 'open' ? '仍在发展' : '暂时收束'}</small></h2>
            <label>查看版本<select aria-label="Cue 版本" value={revisionNumber ?? 'current'} onChange={e => setRevisionNumber(e.target.value === 'current' ? null : Number(e.target.value))}>
              <option value="current">当前 v{selected.currentSemanticRevision}</option>{selected.revisions.map(r => <option key={r.revision} value={r.revision}>v{r.revision} · {r.standing === 'withdrawn' ? '已撤回' : r.revision === selected.currentSemanticRevision ? '最新记录' : '历史版本'}</option>)}</select></label></div>
          <p className="trace-badge">系统梳理 · {revision.standing === 'withdrawn' ? '已撤回，保留历史' : revision.revision < selected.currentSemanticRevision ? '历史版本，已被后续版本替代' : '当前版本'}</p>
          <div className="trace-parts">{revision.parts.map(part => <section key={part.partId}>
            <p className="eyebrow">{stanceLabels[part.stance] ?? part.stance} · {part.content === 'selected_asset' ? '实际使用的材料' : '基于原文的内容'}</p>
            <p className="trace-content">{part.content === 'source_spans' ? part.sourceBindings.map(ref => ref.quote).join(' ') : part.selectedText}</p>
            {part.content === 'selected_asset' && <p className="trace-help">材料：{part.assetRef.assetId} · {part.assetRef.assetVersion} · Pack {part.assetRef.packId} / {part.assetRef.releaseId} · {part.assetRef.digest}</p>}
            <div className="source-links"><span>内容引用</span>{references(part.content === 'source_spans' ? part.sourceBindings : part.establishmentEvidence)}</div>
          </section>)}</div>
          <section className="revision-basis"><h3>本版本的建立／变化依据</h3><p className="trace-help">保留的早期内容与促成本次变化的原话分开列出。</p>{references(revision.establishmentEvidence)}</section>
          {workspace.presentations.filter(p => p.cueId === selected.cueId && p.revision === revision.revision).map(p => <section className="trace-presentation" key={`${p.cueId}/${p.revision}`}>
            <h3>整理表达 · 来源 {label(p.cueId)} v{p.revision}</h3><p className="trace-help">派生呈现，不是讲授原话或新的识别证据。</p><CueContent sourceText={revisionText(revision)} presentation={p.result} /></section>)}
          <section aria-label="Cue 关系"><h3>有依据的关系</h3>
            {trace.relations.filter(r => r.fromCueId === selected.cueId || r.toCueId === selected.cueId).map(r => <div className="trace-relation" key={r.relationId}>
              <p>{label(r.fromCueId)} → {label(r.toCueId)} · {relationLabels[r.kind] ?? r.kind}</p>
              <p className="trace-help">{statusLabels[r.status]} · {r.family === 'external_domain' ? '外部领域参考' : '讲授关系'} · 依赖版本 {Object.values(r.dependencyReadSet.cues ?? {}).join(' / ')}</p>{references(r.basisRefs)}
            </div>)}
            {!trace.relations.some(r => r.fromCueId === selected.cueId || r.toCueId === selected.cueId) && <p className="trace-help">当前没有已记录的关系依据。这不表示教师逻辑有缺陷。</p>}
          </section>
          <section className="teacher-notes"><h3>教师工作笔记</h3><p className="trace-help">独立保存，不属于原话或 Cue 修订；标记不会自动纠正系统梳理。</p>
            <label className="mismatch"><input type="checkbox" checked={note.mismatch} disabled={readOnly} onChange={e => onNote?.(selected.cueId, { ...note, mismatch: e.target.checked })} />梳理不符</label>
            <label>关于此 Cue 的备注<textarea aria-label="教师备注" value={note.text} maxLength={10_000} readOnly={readOnly} placeholder={readOnly ? '没有备注' : '留下核对意见或备课笔记…'} onChange={e => onNote?.(selected.cueId, { ...note, text: e.target.value })} /></label>
          </section>
          <details className="trace-identity"><summary>记录标识</summary><p>{selected.cueId} · 系统接受 {revision.acceptedEventId} · {revision.acceptedAt} ms（处理时钟，不是讲授时间）</p></details>
        </article> : <div className="trace-detail trace-empty"><h2>从一个教学点开始</h2><p>在左侧选中 Cue，核对其内容、版本和原话。新 Cue 出现时不会抢走你的选择。</p></div>}
        <section className="trace-sources" aria-label="讲授原文" id={`${readOnly ? 'file' : 'live'}-source`} tabIndex={-1}>
          <h2>讲授原文</h2><p className="trace-help">{focusRefs.length ? '高亮为准确引用范围，全文保留上下文。时间仅精确到所属来源片段。' : '从内容引用或过程行定位原文。也可展开全部已捕获片段。'}</p>
          {lesson.evidenceOrder.filter(id => focusIds.has(id)).map(id => {
            const e = lesson.evidence[id]!; const index = lesson.evidenceOrder.indexOf(id);
            return <article key={id} className="source-original"><h3>原文 {index + 1} · {sourceTime(e.startMs)}–{sourceTime(e.endMs)}</h3>
              <p className="trace-help">{sourceRoles(lesson, { evidenceId: id, start: 0, end: e.text.length, quote: e.text }).join('、')} · 说话人 {e.speakerId ?? '未知'} · {e.language ?? '语言未记录'}</p>
              <blockquote><Highlight text={e.text} ranges={focusRefs.filter(ref => ref.evidenceId === id)} /></blockquote>
              <details><summary>相邻来源与角色依据</summary>{[lesson.evidenceOrder[index - 1], lesson.evidenceOrder[index + 1]].filter(Boolean).map(contextId => {
                const context = lesson.evidence[contextId!]!; return <p className="source-context" key={contextId}>{sourceTime(context.startMs)}–{sourceTime(context.endMs)} · {sourceRoles(lesson, { evidenceId: context.id, start: 0, end: context.text.length, quote: context.text }).join('、')}<br />{context.text}</p>;
              })}{Object.values(lesson.roles).map(role => <p key={role.bindingId}>{roleLabels[role.role]} · {role.basis} · {role.sourceRanges.length ? role.sourceRanges.map(ref => `${ref.evidenceId} [${ref.start}, ${ref.end})`).join(' / ') : '配置的来源通道'}</p>)}</details>
            </article>;
          })}
          <details><summary>全部原文与处理范围（{lesson.evidenceOrder.length} 段）</summary>
            {lesson.evidenceOrder.map((id, index) => { const e = lesson.evidence[id]!; return <article className="source-original" key={id}>
              <h3>原文 {index + 1} · {sourceTime(e.startMs)}–{sourceTime(e.endMs)}</h3><p className="trace-help">{sourceRoles(lesson, { evidenceId: id, start: 0, end: e.text.length, quote: e.text }).join('、')} · 说话人 {e.speakerId ?? '未知'}</p><blockquote>{e.text}</blockquote>
              {lesson.processing[id]!.ranges.map((r, i) => <p className="processing-range" key={i}>{processingLabels[r.status]} · [{r.start}, {r.end})<br />{e.text.slice(r.start, r.end)}</p>)}
            </article>; })}
          </details>
        </section>
      </div>
    </div>
    <details className="record-scope"><summary>记录范围、待续接与已知问题</summary>
      <p>原始音频未保存；未记录的历史错误原因未知。来源间隔不自动解释为采集缺口。</p>
      <p>已处理只表示系统已记账，不代表完整理解。WAIT 与暂缓范围仍可在停止后保留。</p>
      {Object.values(lesson.deferred).map(d => <div key={d.deferredId}><p>{d.status === 'open' ? '上下文不足 · 待续接' : d.status === 'closed_incomplete' ? '已结束但不完整' : '已续接'}：{d.reason}</p>{references(d.sourceRanges)}</div>)}
      {workspace.record.issues.length ? workspace.record.issues.map((issue, i) => <p key={i}>{issue.kind === 'capture' ? '采集问题／可能缺口（准确缺失区间未知）' : '处理问题'} · 在接受记录 #{issue.observedAtSequence} 观察到：{issue.message}</p>) : <p>此记录未记录具体问题；这不证明没有遗漏。</p>}
    </details>
  </section>;
}
