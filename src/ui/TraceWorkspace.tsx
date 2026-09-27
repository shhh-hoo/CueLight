import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CueEngine } from '../cue/cue-engine';
import { downloadText, serializeTrace, traceMarkdown } from '../trace/archive';
import type { TraceSession } from '../trace/session';
import type { LeaveGuard, OpenedTrace } from '../trace/types';
import { projectCue } from '../alive/projection';
import type { DisplayState } from '../refinement/types';
import { TraceView } from './TraceView';

export function TraceWorkspace({ engine, trace, guard, onDelete, display }: {
  engine: CueEngine; trace: TraceSession; guard: LeaveGuard; onDelete: () => void; display?: DisplayState;
}) {
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const workspace = useSyncExternalStore(trace.subscribe, trace.getSnapshot);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    guard.current = trace.confirmLeave;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (trace.hasUnexported()) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { guard.current = () => true; window.removeEventListener('beforeunload', beforeUnload); };
  }, [trace, guard]);
  const exportFile = (kind: 'json' | 'md') => {
    setError(''); setMessage('');
    try {
      const archive = trace.archive();
      const json = serializeTrace(archive);
      downloadText(kind === 'json' ? json : traceMarkdown({ archive, lesson: engine.getSnapshot().lesson }), `cuelight-trace.${kind}`, kind === 'json' ? 'application/json' : 'text/markdown');
      if (kind === 'json') trace.markExported();
      setMessage(kind === 'json' ? '已交给浏览器下载。请确认文件已保存；之后新增的记录和笔记需再次导出。' : '已交给浏览器下载 Markdown；可再次打开的完整记录请使用 TRACE 文件。');
    } catch (e) { setError(`导出失败，尚未保存：${e instanceof Error ? e.message : '未知错误'}`); }
  };
  return <TraceView history={engine.exportLesson()} lesson={snapshot.lesson} workspace={workspace} cues={snapshot.cues} display={display} onNote={(id, note) => trace.note(id, note)} actions={<>
    {(message || error || trace.storageError) && <p className="workspace-notice" role={error || trace.storageError ? "alert" : "status"}>{error || trace.storageError || message}</p>}
    <details className="trace-save"><summary>记录与导出</summary><div className="record-menu"><div className="buttons"><button className="primary-button" onClick={() => exportFile('json')}>导出 TRACE 文件</button>
      <button className="secondary-button" onClick={() => exportFile('md')}>导出 Markdown</button>
      <button className="reset-button" onClick={() => {
        if (!window.confirm('删除此会话在本标签页中的讲授记录和教师笔记，并停止相关在途任务？已下载的文件不会被删除。')) return;
        setMessage(''); setError('');
        try { onDelete(); } catch { setError('本地删除失败；相关采集与任务已停止。当前记录仍可查看和导出，请重试删除。'); }
      }}>删除当前本地记录</button></div>
      <p className="trace-help">文件包含原文、已接受历史、教师笔记和记录状态。运行期暂存使用 sessionStorage，尚非关闭标签页后自动恢复。</p>
    </div></details>
  </>} />;
}
export function ImportedTrace({ opened }: { opened: OpenedTrace }) {
  const [error, setError] = useState('');
  const cues = { currentCue: projectCue(opened.lesson, opened.lesson.attention.currentCueId),
    previousCue: projectCue(opened.lesson, opened.lesson.attention.previousCueId) };
  const saved = (cue: typeof cues.currentCue) => cue ? { ...cue, presentation: opened.archive.workspace.presentations.find(p => p.cueId === cue.id && p.revision === cue.sourceRevision)?.result ?? { kind: 'source' as const } } : null;
  return <TraceView history={opened.archive.history} lesson={opened.lesson} workspace={opened.archive.workspace} cues={cues}
    display={{ currentCue: saved(cues.currentCue), previousCue: saved(cues.previousCue) }} readOnly actions={
    <details className="trace-save"><summary>记录与导出</summary><div className="record-menu"><button className="secondary-button" onClick={() => {
      try { downloadText(traceMarkdown(opened), 'cuelight-trace.md', 'text/markdown'); setError(''); }
      catch { setError('Markdown 导出失败。'); }
    }}>导出 Markdown</button>{error && <p role="alert">{error}</p>}</div></details>} />;
}
