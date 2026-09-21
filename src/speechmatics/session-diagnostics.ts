import type { CueEngine, DecisionRecord } from '../cue/cue-engine';
import type { CueState } from '../cue/types';
import type { DecisionInput } from '../decision/decision-provider';
import type { CueDecision } from '../decision/types';
import type { EvidenceFragment } from '../evidence/evidence-buffer';
import { TRANSCRIPTION_CONFIG } from './config';
import type { SourceObservation } from './speechmatics-source';

type DiagnosticEvent =
  | SourceObservation
  | { type: 'jev-request'; atMonoMs: number; requestId: number; input: DecisionInput }
  | { type: 'jev-return'; atMonoMs: number; requestId: number; decision: CueDecision | null; failed: boolean }
  | { type: 'cue-state'; atMonoMs: number; requestId: number | null; cues: CueState }
  | { type: 'decision-outcome'; atMonoMs: number; requestId: number | null; outcome: DecisionRecord['outcome']; discardReason: DecisionRecord['discardReason']; failed: boolean };

// No token, URL, arbitrary Error or raw HTTP object is accepted by this journal.
export class SessionDiagnostics {
  private events: DiagnosticEvent[] = [];
  private fragments: EvidenceFragment[] = [];
  private requestIds = new WeakMap<DecisionInput, number>();
  private requestSequence = 0;
  private recordingFailed = false;
  constructor(readonly sessionId: string) {}
  private now() { return performance.now(); }
  private safely(record: () => void) {
    try { record(); } catch { this.recordingFailed = true; }
  }
  recentEvents() { return this.events.slice(-20); }

  observe = (event: SourceObservation) => {
    this.safely(() => {
      this.events.push(event);
      if (event.type === 'final' && event.result.fragment) this.fragments.push(event.result.fragment);
    });
  };

  async decide(input: DecisionInput, run: () => Promise<CueDecision>) {
    const requestId = ++this.requestSequence;
    this.safely(() => {
      this.requestIds.set(input, requestId);
      this.events.push({ type: 'jev-request', atMonoMs: this.now(), requestId, input });
    });
    try {
      const decision = await run();
      this.safely(() => this.events.push({ type: 'jev-return', atMonoMs: this.now(), requestId, decision, failed: false }));
      return decision;
    } catch (error) {
      this.safely(() => this.events.push({ type: 'jev-return', atMonoMs: this.now(), requestId, decision: null, failed: true }));
      throw error;
    }
  }

  attach(engine: CueEngine) {
    let cues = engine.getSnapshot().cues;
    let decision = engine.getSnapshot().lastDecision;
    return engine.subscribe(() => this.safely(() => {
      const snapshot = engine.getSnapshot();
      if (snapshot.cues !== cues) {
        cues = snapshot.cues;
        this.events.push({ type: 'cue-state', atMonoMs: this.now(), cues,
          requestId: snapshot.request ? this.requestIds.get(snapshot.request) ?? null : null });
      }
      if (snapshot.lastDecision && snapshot.lastDecision !== decision) {
        decision = snapshot.lastDecision;
        this.events.push({ type: 'decision-outcome', atMonoMs: this.now(),
          requestId: this.requestIds.get(decision.input) ?? null, outcome: decision.outcome,
          discardReason: decision.discardReason, failed: decision.error !== null });
      }
    }));
  }

  export() {
    return {
      schemaVersion: 1, sessionId: this.sessionId, source: 'speechmatics-final', recordingFailed: this.recordingFailed,
      contextVersion: 'structured-v3', configuration: TRANSCRIPTION_CONFIG,
      sdkVersions: { audio: '2.0.4', realtime: '8.5.1' },
      timing: {
        local: 'atMonoMs: main-thread performance.now() milliseconds; Final time is delivery to the source adapter',
        source: 'startMs/endMs: Speechmatics audio timeline; raw startSeconds/endSeconds retained',
        limits: 'No audio-to-local-clock mapping, audio-end latency, browser paint measurement or teaching-point-end inference.',
      },
      fragments: [...this.fragments], events: [...this.events],
    };
  }

  download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(this.export(), null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `cuelight-${this.sessionId}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
