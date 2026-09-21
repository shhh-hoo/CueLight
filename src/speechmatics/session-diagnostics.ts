import type { SemanticTrace } from '../alive/inspection';
import type { CueEngine, DecisionRecord } from '../cue/cue-engine';
import type { CueState } from '../cue/types';
import type { DecisionInput } from '../decision/decision-provider';
import type { CueDecision } from '../decision/types';
import type { JevChoiceDiagnostics } from '../decision/jev-choice';
import type { EvidenceFragment } from '../evidence/evidence-buffer';
import type { VoiceConfiguration } from './config';
import type { SourceObservation } from './speechmatics-source';
import type { RefinementObservation } from '../refinement/types';
import { jevConfiguration, type JevConfiguration, type RefinementConfiguration } from '../runtime-config';

type DiagnosticEvent =
  | { type: 'semantic-inspection'; atMonoMs: number; trace: SemanticTrace }
  | { type: 'jev-configuration'; atMonoMs: number; configuration: JevConfiguration }
  | SourceObservation
  | RefinementObservation
  | { type: 'jev-request'; atMonoMs: number; requestId: number; input: DecisionInput }
  | { type: 'jev-return'; atMonoMs: number; requestId: number; decision: CueDecision | null; diagnostics: JevChoiceDiagnostics | null; failed: boolean }
  | { type: 'cue-state'; atMonoMs: number; requestId: number | null; cues: CueState }
  | { type: 'decision-outcome'; atMonoMs: number; requestId: number | null; outcome: DecisionRecord['outcome']; discardReason: DecisionRecord['discardReason']; failed: boolean };

// No token, URL, arbitrary Error or raw HTTP object is accepted by this journal.
export class SessionDiagnostics {
  private events: DiagnosticEvent[] = [];
  private fragments: EvidenceFragment[] = [];
  private requestIds = new WeakMap<DecisionInput, number>();
  private requestSequence = 0;
  private choices = new WeakMap<DecisionInput, JevChoiceDiagnostics>();
  private configuration: VoiceConfiguration | undefined;
  private refinement: RefinementConfiguration | undefined;
  private jev: JevConfiguration | undefined;
  private recordingFailed = false;
  constructor(readonly sessionId: string, private readonly source: 'speechmatics-voice' | 'text-replay' = 'speechmatics-voice') {}
  private now() { return performance.now(); }
  private safely(record: () => void) {
    try { record(); } catch { this.recordingFailed = true; }
  }
  recentEvents() { return this.events.slice(-20); }

  observe = (event: SourceObservation) => {
    this.safely(() => {
      this.events.push(event);
      if (event.type === 'voice-segments') this.fragments.push(...event.result.fragments);
      if (event.type === 'voice-configuration') this.configuration = event.configuration;
    });
  };

  observeRefinement = (event: RefinementObservation) => {
    this.safely(() => {
      if (event.type === 'refinement-configuration') this.refinement = event.configuration;
      this.events.push(event);
    });
  };

  observeJevConfiguration = (value: JevConfiguration) => {
    this.safely(() => {
      this.jev = jevConfiguration(value);
      this.events.push({ type: 'jev-configuration', atMonoMs: this.now(), configuration: this.jev });
    });
  };

  observeJevChoice = (input: DecisionInput, diagnostics: JevChoiceDiagnostics) => {
    this.safely(() => this.choices.set(input, diagnostics));
  };

  async decide(input: DecisionInput, run: () => Promise<CueDecision>) {
    const requestId = ++this.requestSequence;
    this.safely(() => {
      this.requestIds.set(input, requestId);
      this.events.push({ type: 'jev-request', atMonoMs: this.now(), requestId, input });
    });
    try {
      const decision = await run();
      this.safely(() => this.events.push({ type: 'jev-return', atMonoMs: this.now(), requestId, decision, diagnostics: this.choices.get(input) ?? null, failed: false }));
      return decision;
    } catch (error) {
      this.safely(() => this.events.push({ type: 'jev-return', atMonoMs: this.now(), requestId, decision: null, diagnostics: null, failed: true }));
      throw error;
    }
  }

  attach(engine: CueEngine) {
    let cues = engine.getSnapshot().cues;
    let decision = engine.getSnapshot().lastDecision;
    let incoming = engine.getSnapshot().incoming;
    const detachSemantic = engine.observeSemantics(trace => this.safely(() => this.events.push({ type: 'semantic-inspection', atMonoMs: this.now(), trace })));
    const detach = engine.subscribe(() => this.safely(() => {
      const snapshot = engine.getSnapshot();
      if (this.source === 'text-replay' && snapshot.incoming && snapshot.incoming !== incoming) {
        incoming = snapshot.incoming;
        this.fragments.push(incoming);
      }
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
    return () => { detach(); detachSemantic(); };
  }

  export() {
    return {
      schemaVersion: 4, buildRevision: import.meta.env.VITE_BUILD_REVISION ?? 'unknown', sessionId: this.sessionId, source: this.source, recordingFailed: this.recordingFailed,
      contextVersion: this.jev?.contextVersion ?? 'alive-jev-v1',
      semanticAttempts: this.events.filter(e => e.type === 'semantic-inspection' && e.trace.outcome !== 'started'),
      uniqueSemanticProviderAttempts: new Set(this.events.filter(e => e.type === 'semantic-inspection' && e.trace.outcome === 'started').map(e => e.type === 'semantic-inspection' ? e.trace.input.inspectionId : '')).size,
      jev: this.jev ?? null,
      refinement: this.refinement ? { ...this.refinement, style: 'presentation-v1' } : null,
      ...(this.source === 'speechmatics-voice' ? { configuration: this.configuration,
        sdkVersions: { audio: '2.0.4', voice: this.configuration?.voiceVersion, rt: this.configuration?.rtVersion } } : {}),
      timing: {
        local: 'atMonoMs: main-thread performance.now() milliseconds; segment time is delivery to the source adapter',
        source: this.source === 'speechmatics-voice' ? 'startMs/endMs: Speechmatics audio timeline; Voice segment timestamps are converted from seconds'
          : 'startMs/endMs: text replay source timeline',
        limits: 'No audio-to-local-clock mapping, audio-end latency, browser paint measurement or teaching-point-end inference.',
      },
      // Explicit source→candidate→decision links, including cycles coalesced while busy.
      segmentDecisions: this.fragments.map(fragment => {
        const requests = this.events.filter((event): event is Extract<DiagnosticEvent, { type: 'jev-request' }> =>
          event.type === 'jev-request' && event.input.evidence.fragments.some(item => item.id === fragment.id));
        return { fragmentId: fragment.id, cycle: fragment.cycle,
          triggeredRequestIds: requests.filter(event => fragment.cycle === undefined
            ? event.input.evidence.fragments.at(-1)?.id === fragment.id
            : event.input.evidence.fragments.at(-1)?.cycle === fragment.cycle).map(event => event.requestId),
          requests: requests.map(event => ({ requestId: event.requestId,
            candidateIds: event.input.candidates.filter(candidate => candidate.sourceFragmentIds.includes(fragment.id)).map(candidate => candidate.id),
            result: this.events.find(result => result.type === 'jev-return' && result.requestId === event.requestId),
            outcome: this.events.find(result => result.type === 'decision-outcome' && result.requestId === event.requestId),
          })),
        };
      }),
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
