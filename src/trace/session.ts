import type { CueEngine } from '../cue/cue-engine';
import type { DisplayState } from '../refinement/types';
import type { RecordStatus, SavedPresentation, TeacherNote, TraceArchive } from './types';

// Workbench metadata only. It never writes evidence or submits semantic proposals.
export class TraceSession {
  private value: TraceArchive['workspace'];
  private listeners = new Set<() => void>();
  private revision = 0;
  private exported = '';
  private closed = false;
  private readonly key: string;
  private readonly detach: () => void;
  private readonly detachSemantics: () => void;
  private previousInputError: string | null = null;
  storageError: string | null = null;

  constructor(private readonly engine: CueEngine, source: RecordStatus['source'], private readonly storage: Storage = sessionStorage) {
    const s = engine.getSnapshot().lesson;
    this.key = `cuelight:trace:${s.sessionId}:${s.sessionEpoch}`;
    this.value = { notes: {}, record: { source, phase: 'ready', issues: [] }, presentations: [] };
    this.detach = engine.subscribe(() => {
      const error = engine.getSnapshot().inputError;
      if (error && error !== this.previousInputError) this.issue('capture', error);
      this.previousInputError = error;
    });
    this.detachSemantics = engine.observeSemantics(trace => {
      if (trace.error && ['provider_failure', 'coverage_blocked', 'invalid_judgment', 'host_rejection'].includes(trace.outcome)) this.issue('processing', trace.error);
    });
  }
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private save(value: TraceArchive['workspace']) {
    if (this.closed) return;
    this.value = value; this.revision++;
    try { this.storage.setItem(this.key, JSON.stringify({ format: 'cuelight-trace-workspace', version: 1, workspace: value })); this.storageError = null; }
    catch { this.storageError = '工作台本地暂存失败。记录仍在此页内存中，请导出 TRACE 文件后再离开。'; }
    for (const listener of this.listeners) listener();
  }
  note(cueId: string, note: TeacherNote) {
    if (!this.engine.getSnapshot().lesson.cues[cueId] || note.text.length > 10_000) return;
    this.save({ ...this.value, notes: { ...this.value.notes, [cueId]: note } });
  }
  phase(phase: RecordStatus['phase']) {
    if (phase !== this.value.record.phase) this.save({ ...this.value, record: { ...this.value.record, phase } });
  }
  issue(kind: 'capture' | 'processing', message: string) {
    const observedAtSequence = this.engine.getSnapshot().lesson.sequence;
    if (this.value.record.issues.some(i => i.kind === kind && i.message === message && i.observedAtSequence === observedAtSequence)) return;
    this.save({ ...this.value, record: { ...this.value.record,
      issues: [...this.value.record.issues, { kind, message, observedAtSequence }] } });
  }
  presentation(display: DisplayState) {
    let presentations = this.value.presentations;
    for (const cue of [display.currentCue, display.previousCue]) {
      if (!cue || cue.presentation.kind !== 'presentation') continue;
      const p: SavedPresentation = { cueId: cue.id, revision: cue.sourceRevision, result: cue.presentation };
      if (!presentations.some(old => old.cueId === p.cueId && old.revision === p.revision)) presentations = [...presentations, p];
    }
    if (presentations !== this.value.presentations) this.save({ ...this.value, presentations });
  }
  archive = (): TraceArchive => ({ format: 'cuelight-trace', version: 1, history: this.engine.exportLesson(), workspace: this.value });
  private token = () => `${this.engine.getSnapshot().lesson.sequence}/${this.revision}`;
  markExported() { this.exported = this.token(); }
  hasUnexported = () => {
    const meaningful = this.engine.getSnapshot().lesson.evidenceOrder.length > 0 || Object.keys(this.value.notes).length > 0 || this.value.record.issues.length > 0;
    return (meaningful && this.exported !== this.token()) || ['capturing', 'stopping'].includes(this.value.record.phase);
  };
  confirmLeave = () => !this.hasUnexported() || window.confirm('当前记录或教师笔记尚未导出，或采集仍在进行。离开将停止当前会话；此版本不支持关闭后自动恢复。仍要离开吗？');
  dispose() { this.closed = true; this.detach(); this.detachSemantics(); this.listeners.clear(); }
  deleteLocalMetadata() { this.storage.removeItem(this.key); }
}
