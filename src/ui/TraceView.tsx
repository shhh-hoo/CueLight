import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { EvidenceBinding, LessonHistory, LessonState } from '../alive/types';
import { actionLabels, processingLabels, projectTrace, relationLabels, revisionText, roleLabels, sourceInterval, sourceRoles, sourceTime, stanceLabels } from '../trace/projection';
import type { TeacherNote, TraceArchive } from '../trace/types';
import { CueContent, CueSurface } from './CueSurface';
import type { CueState } from '../cue/types';
import type { DisplayState } from '../refinement/types';

const phaseLabels = { ready: '尚未开始', capturing: '正在记录', paused: '已暂停', stopping: '正在结束并处理尾部', stopped: '采集已停止', finished: '文本回放已结束', interrupted: '记录中断', unknown: '结束状态未知' };
const sourceLabels = { demo: '离线编写示例 · 非真实课堂验证', 'text-replay': '文本回放', microphone: '麦克风采集', unknown: '来源类型未知' };
type SheetTask = 'cue' | 'note' | 'reference' | 'source';
type CueTarget = { cueId: string; revision: number };
type SheetContext = { task: SheetTask; target: CueTarget | null; evidenceRefs: readonly EvidenceBinding[] };

const statusLabels = { current: '当前关系', needs_review: '依赖已变化 · 需复核', withdrawn: '关系已撤回' };
function Highlight({ text, ranges }: { text: string; ranges: readonly { start: number; end: number }[] }) {
  const boundaries = [...new Set([0, text.length, ...ranges.flatMap(r => [r.start, r.end])])].sort((a, b) => a - b);
  return <>{boundaries.slice(0, -1).map((start, i) => {
    const end = boundaries[i + 1]!;
    return ranges.some(r => r.start <= start && r.end >= end)
      ? <mark key={start}>{text.slice(start, end)}</mark> : <span key={start}>{text.slice(start, end)}</span>;
  })}</>;
}

export function TraceView({ history, lesson, workspace, cues, display, actions, onNote, readOnly = false }: {
  history: LessonHistory; lesson: LessonState; workspace: TraceArchive['workspace'];
  cues: CueState; display?: DisplayState; actions?: ReactNode;
  onNote?: (cueId: string, note: TeacherNote) => void; readOnly?: boolean;
}) {
  const sheetRef = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const focusRequest = useRef<'sheet' | 'source' | null>(null);
  const [view, setView] = useState<'display' | 'flow'>('display');
  const [flowSelection, setFlowSelection] = useState<CueTarget | null>(null);
  const [sheetContext, setSheetContext] = useState<SheetContext | null>(null);
  const [order, setOrder] = useState<'source' | 'accepted'>('source');
  const trace = useMemo(() => projectTrace(history, lesson), [history, lesson]);
  const task = sheetContext?.task;
  const selected = lesson.cues[sheetContext?.target?.cueId ?? ''];
  const revision = selected?.revisions.find(r => r.revision === sheetContext?.target?.revision);
  const focusRefs = sheetContext?.evidenceRefs ?? [];
  const note = workspace.notes[selected?.cueId ?? ''] ?? { text: '', mismatch: false };
  const label = (id: string) => `Cue ${trace.cues.findIndex(c => c.cueId === id) + 1}`;
  const current = lesson.cues[cues.currentCue?.id ?? ''];
  const liveTarget = current ? { cueId: current.cueId, revision: current.currentSemanticRevision } : null;
  // Only the visible context can supply an implicit target. Closed sheets own nothing.
  const toolbarTarget = sheetContext ? sheetContext.target : view === 'flow' ? flowSelection : liveTarget;
  const evidenceFor = (target: CueTarget | null) => lesson.cues[target?.cueId ?? '']?.revisions
    .find(r => r.revision === target?.revision)?.establishmentEvidence ?? [];
  const open = (nextTask: SheetTask, target: CueTarget | null, evidenceRefs = evidenceFor(target)) => {
    if (!target && nextTask !== 'source') return;
    const opener = document.activeElement;
    if (opener instanceof HTMLElement && !sheetRef.current?.contains(opener)) returnFocus.current = opener;
    focusRequest.current = nextTask === 'source' ? 'source' : 'sheet';
    setSheetContext({ task: nextTask, target, evidenceRefs });
  };
  const browse = (target: CueTarget, evidenceRefs = evidenceFor(target)) => {
    setFlowSelection(target);
    open('cue', target, evidenceRefs);
  };
  const changeTask = (nextTask: SheetTask) => {
    if (sheetContext) setSheetContext({ ...sheetContext, task: nextTask });
  };
  const changeRevision = (version: number) => {
    if (!sheetContext?.target) return;
    const target = { ...sheetContext.target, revision: version };
    if (view === 'flow' && flowSelection?.cueId === target.cueId) setFlowSelection(target);
    setSheetContext({ ...sheetContext, target, evidenceRefs: evidenceFor(target) });
  };
  const close = () => {
    sheetRef.current?.close(); // Releases native modal inertness before returning focus.
    setSheetContext(null);
    if (returnFocus.current?.isConnected && returnFocus.current.getClientRects().length) returnFocus.current.focus({ preventScroll: true });
    else document.getElementById(`${readOnly ? 'file' : 'live'}-view-${view}`)?.focus({ preventScroll: true });
  };
  const references = (refs: readonly EvidenceBinding[], target: CueTarget | null) => refs.map((ref, i) => <button className="source-link" key={`${ref.evidenceId}/${ref.start}/${i}`}
    onClick={() => open('source', target, [ref])}>{sourceInterval(lesson, ref)} · 原文 {lesson.evidenceOrder.indexOf(ref.evidenceId) + 1} [{ref.start}, {ref.end})</button>);
  const focusIds = new Set(focusRefs.map(ref => ref.evidenceId));
  const sheetOpen = sheetContext !== null;
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheetOpen || !sheet) return;
    const narrow = window.matchMedia('(max-width: 800px)');
    const syncDialog = () => {
      // A live workspace can be hidden while an imported archive is being inspected.
      const visible = !sheet.closest('[hidden]');
      const modal = sheet.matches(':modal');
      const focused = document.activeElement;
      if (sheet.open && (!visible || modal !== narrow.matches)) sheet.close();
      if (visible && !sheet.open) {
        if (narrow.matches) sheet.showModal(); else sheet.show();
        if (focused instanceof HTMLElement && sheet.contains(focused)) focused.focus({ preventScroll: true });
      }
    };
    syncDialog();
    narrow.addEventListener('change', syncDialog);
    const visibility = new MutationObserver(syncDialog);
    for (let parent = sheet.parentElement; parent; parent = parent.parentElement) {
      visibility.observe(parent, { attributes: true, attributeFilter: ['hidden'] });
    }
    return () => { narrow.removeEventListener('change', syncDialog); visibility.disconnect(); };
  }, [sheetOpen]);
  useLayoutEffect(() => {
    if (!sheetContext) return;
    sheetRef.current?.querySelector('.sheet-body')?.scrollTo(0, 0);
    const requested = focusRequest.current;
    focusRequest.current = null;
    if (requested) {
      const target = requested === 'source' ? document.getElementById(`${readOnly ? 'file' : 'live'}-source`) : sheetRef.current;
      target?.focus({ preventScroll: true });
    }
  }, [sheetContext, readOnly]); // Incoming runtime/note updates cannot move focus or scroll; task tabs retain focus.
  const pending = trace.processing.filter(r => r.status !== 'accounted').length;
  return <section className="trace-workspace" aria-label="教师 TRACE">
    <div className="workbench-body">
      <div className="workbench-main">
        <div className="workbench-viewport" hidden={view !== 'display'} data-testid="display-view">
          <CueSurface cues={cues} display={display} onInspect={id => { const cue = lesson.cues[id]; if (cue) open('cue', { cueId: id, revision: cue.currentSemanticRevision }); }} />
        </div>
        <div className="workbench-viewport flow-viewport" hidden={view !== 'flow'} data-testid="flow-view">
          <div className="flow-heading"><div><p className="eyebrow">TRACE</p><h1>Lesson Flow</h1></div>
            <div className="buttons"><button className="plain-button" disabled title="整课建议服务尚未连接">REWORK</button><button className="plain-button" onClick={() => setView('display')}>返回当前 Display ↗</button></div></div>
      <div className="trace-overview"><section aria-label="全部 Cue"><h2>教学对象 <small>{trace.cues.length}</small></h2>
        {!trace.cues.length && <p className="trace-empty">还没有记录的教学对象。</p>}
        <div className="cue-index">{trace.cues.map((cue, index) => <button key={cue.cueId} className="cue-choice" data-testid="cue-choice" data-cue-id={cue.cueId}
          aria-pressed={flowSelection?.cueId === cue.cueId} onClick={() => browse({ cueId: cue.cueId, revision: cue.currentSemanticRevision })}>
          <span>{index + 1 < 10 ? `0${index + 1}` : index + 1} · {cue.revisions.at(-1)!.standing === 'withdrawn' ? '已撤回' : `版本 ${cue.currentSemanticRevision}`}{flowSelection?.cueId === cue.cueId && ` · 已选 v${flowSelection.revision}`}</span>
          <strong>{revisionText(cue.revisions[0]!)}</strong>
          {workspace.notes[cue.cueId]?.mismatch && <em>教师标记：梳理不符</em>}
        </button>)}</div></section>
        <section aria-label="讲授过程"><div className="trace-section-heading"><h2>发展过程</h2><label>排列依据<select aria-label="过程排列依据" value={order} onChange={e => setOrder(e.target.value as typeof order)}>
          <option value="source">来源时间</option><option value="accepted">系统接受顺序</option></select></label></div>
          <details className="trace-help"><summary>时间与记录范围</summary><p>同一来源片段内没有更细时间对齐；接受顺序可能晚于讲授。已记录提及不代表完整重复次数。</p></details>
          <ol className="trace-steps">{(order === 'source' ? trace.sourceSteps : trace.steps).map(step => <li key={step.key}>
            <button data-testid="trace-step" aria-pressed={flowSelection?.cueId === step.cueId && flowSelection.revision === step.revision.revision}
              onClick={() => browse({ cueId: step.cueId, revision: step.revision.revision }, step.basis)}>
              <span className="step-meta">{step.basis.map(ref => sourceInterval(lesson, ref)).filter((v, i, all) => all.indexOf(v) === i).join(' / ')} · {actionLabels[step.kind]}</span>
              <strong>{label(step.cueId)} · v{step.revision.revision}{step.toCueId ? ` → ${label(step.toCueId)}` : ''}</strong>
              <span>{step.relation ? `${relationLabels[step.relation.kind] ?? step.relation.kind} · 关系版本 ${step.relation.relationRevision}` : revisionText(step.revision)}</span><small>系统接受顺序 #{step.eventSequence}</small>
            </button><details className="step-acceptance"><summary>接受记录 #{step.eventSequence}</summary><p>{step.acceptedAt} ms · 系统处理时钟，不是讲授时间。</p></details></li>)}</ol>
        </section>
      </div>
    <details className="record-scope"><summary>记录范围、待续接与已知问题</summary>
      <p>{sourceLabels[workspace.record.source]} · {phaseLabels[workspace.record.phase]} · {pending} 个范围待处理／待上下文</p><p>原始音频未保存；未记录的历史错误原因未知。来源间隔不自动解释为采集缺口。</p>
      <p>已处理只表示系统已记账，不代表完整理解。WAIT 与暂缓范围仍可在停止后保留。</p>
      {Object.values(lesson.deferred).map(d => <div key={d.deferredId}><p>{d.status === 'open' ? '上下文不足 · 待续接' : d.status === 'closed_incomplete' ? '已结束但不完整' : '已续接'}：{d.reason}</p>{references(d.sourceRanges, null)}</div>)}
      {workspace.record.issues.length ? workspace.record.issues.map((issue, i) => <p key={i}>{issue.kind === 'capture' ? '采集问题／可能缺口（准确缺失区间未知）' : '处理问题'} · 在接受记录 #{issue.observedAtSequence} 观察到：{issue.message}</p>) : <p>此记录未记录具体问题；这不证明没有遗漏。</p>}
    </details>
        </div>
      </div>
      {sheetContext && <dialog className="context-sheet" aria-label="Cue 工作栏" ref={sheetRef} tabIndex={-1}
        onCancel={event => { event.preventDefault(); close(); }}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
        <header className="sheet-heading"><span>{selected ? `${label(selected.cueId)} · v${revision?.revision}` : '讲授原文'}{readOnly ? ' · 只读' : ''}</span>
          <button className="plain-button" aria-label="关闭工作栏" onClick={close}>×</button></header>
        <nav className="sheet-tabs" aria-label="Cue 工作"><button aria-pressed={task === 'cue'} disabled={!selected} onClick={() => changeTask('cue')}>Cue</button>
          <button aria-pressed={task === 'reference'} disabled={!selected} onClick={() => changeTask('reference')}>Reference</button>
          <button aria-pressed={task === 'note'} disabled={!selected} onClick={() => changeTask('note')}>Note</button>
          <button aria-pressed={task === 'source'} onClick={() => changeTask('source')}>Evidence</button></nav>
        <div className="sheet-body" data-testid="sheet-body">

        {task === 'cue' && selected && revision && <article tabIndex={-1} className="trace-detail" aria-label="Cue 详情" data-testid="cue-detail" data-cue-id={selected.cueId}>
          <div className="trace-section-heading"><h2>{label(selected.cueId)} <small>{selected.revisions.at(-1)!.standing === 'withdrawn' ? '已撤回' : selected.development === 'open' ? '仍在发展' : '暂时收束'}</small></h2>
            <label>查看版本<select aria-label="Cue 版本" value={revision?.revision} onChange={e => changeRevision(Number(e.target.value))}>
              {selected.revisions.map(r => <option key={r.revision} value={r.revision}>v{r.revision} · {r.standing === 'withdrawn' ? '已撤回' : r.revision === selected.currentSemanticRevision ? '最新记录' : '历史版本'}</option>)}</select></label></div>
          <p className="trace-badge">系统梳理 · {revision.standing === 'withdrawn' ? '已撤回，保留历史' : revision.revision < selected.currentSemanticRevision ? '历史版本，已被后续版本替代' : '当前版本'}</p>
          <div className="trace-parts">{revision.parts.map(part => <section key={part.partId}>
            <p className="eyebrow">{stanceLabels[part.stance] ?? part.stance} · {part.content === 'selected_asset' ? '实际使用的材料' : '基于原文的内容'}</p>
            <p className="trace-content">{part.content === 'source_spans' ? part.sourceBindings.map(ref => ref.quote).join(' ') : part.selectedText}</p>
            {part.content === 'selected_asset' && <p className="trace-help">材料：{part.assetRef.assetId} · {part.assetRef.assetVersion} · Pack {part.assetRef.packId} / {part.assetRef.releaseId} · {part.assetRef.digest}</p>}
            <div className="source-links"><span>内容引用</span>{references(part.content === 'source_spans' ? part.sourceBindings : part.establishmentEvidence, sheetContext.target)}</div>
          </section>)}</div>
          <section className="revision-basis"><h3>本版本的建立／变化依据</h3>{references(revision.establishmentEvidence, sheetContext.target)}</section>
          {workspace.presentations.filter(p => p.cueId === selected.cueId && p.revision === revision.revision).map(p => <section className="trace-presentation" key={`${p.cueId}/${p.revision}`}>
            <h3>整理表达 · 来源 {label(p.cueId)} v{p.revision}</h3><p className="trace-help">派生呈现，不是讲授原话或新的识别证据。</p><CueContent sourceText={revisionText(revision)} presentation={p.result} /></section>)}
          <section aria-label="Cue 关系"><h3>有依据的关系</h3>
            {trace.relations.filter(r => r.fromCueId === selected.cueId || r.toCueId === selected.cueId).map(r => <div className="trace-relation" key={r.relationId}>
              <p>{label(r.fromCueId)} → {label(r.toCueId)} · {relationLabels[r.kind] ?? r.kind}</p>
              <p className="trace-help">{statusLabels[r.status]} · {r.family === 'external_domain' ? '外部领域参考' : '讲授关系'} · 依赖版本 {Object.values(r.dependencyReadSet.cues ?? {}).join(' / ')}</p>{references(r.basisRefs, sheetContext.target)}
            </div>)}
            {!trace.relations.some(r => r.fromCueId === selected.cueId || r.toCueId === selected.cueId) && <p className="trace-help">暂无已记录的关系依据。</p>}
          </section>
          <details className="trace-identity"><summary>记录标识</summary><p>{selected.cueId} · 系统接受 {revision.acceptedEventId} · {revision.acceptedAt} ms（处理时钟，不是讲授时间）</p></details>
        </article>}
        {task === 'note' && selected && <article className="trace-detail" data-testid="note-detail" data-cue-id={selected.cueId}>
          <section className="teacher-notes"><h3>教师工作笔记</h3><p className="trace-help">独立保存，不属于原话或 Cue 修订；标记不会自动纠正系统梳理。</p>
            <label className="mismatch"><input type="checkbox" checked={note.mismatch} disabled={readOnly} onChange={e => onNote?.(selected.cueId, { ...note, mismatch: e.target.checked })} />梳理不符</label>
            <label>关于此 Cue 的备注<textarea aria-label="教师备注" value={note.text} maxLength={10_000} readOnly={readOnly} placeholder={readOnly ? '没有备注' : '留下核对意见或备课笔记…'} onChange={e => onNote?.(selected.cueId, { ...note, text: e.target.value })} /></label>
          </section>
        </article>}
        {task === 'reference' && selected && <section className="reference-empty" aria-label="Reference" data-cue-id={selected.cueId} data-revision={revision?.revision}><p className="eyebrow">ENRICH · {label(selected.cueId)}</p><h2>Reference</h2><p>尚未连接参考服务</p><button className="plain-button" disabled>获取参考</button><p className="trace-help">AI 批注与外部参考将分开列出。</p></section>}
        {task === 'source' && <section className="trace-sources" aria-label="讲授原文" id={`${readOnly ? 'file' : 'live'}-source`} tabIndex={-1}>
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
        </section>}
        </div>
      </dialog>}
    </div>
    <footer className="workbench-toolbar">
      <nav aria-label="工作区视图"><button id={`${readOnly ? 'file' : 'live'}-view-display`} aria-pressed={view === 'display'} onClick={() => setView('display')}>Display</button>
        <button id={`${readOnly ? 'file' : 'live'}-view-flow`} aria-pressed={view === 'flow'} onClick={() => setView('flow')}>Lesson Flow <small>{trace.cues.length}</small></button></nav>
      <div className="workbench-tools"><button disabled={!toolbarTarget} onClick={() => open('reference', toolbarTarget)}>Reference</button>
        <button disabled={!toolbarTarget} onClick={() => open('note', toolbarTarget)}>Note</button>
        <button disabled={!lesson.evidenceOrder.length} onClick={() => open('source', toolbarTarget, sheetContext?.evidenceRefs ?? evidenceFor(toolbarTarget))}>Evidence</button>
        {actions}
      </div>
    </footer>

  </section>;
}
