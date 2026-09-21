import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { CueEngine } from './cue/cue-engine';
import { MockDecisionProvider } from './decision/mock-decision-provider';
import { HttpDecisionProvider } from './decision/http-decision-provider';
import { replayFixtures, type ReplayFixture } from './replay/replay-fixtures';
import { ReplayEvidenceSource } from './replay/replay-source';
import { CueSurface } from './ui/CueSurface';
import { JevSetup } from './ui/JevSetup';
import { MicrophoneSession } from './ui/MicrophoneSession';
import { CueRefinement } from './refinement/cue-refinement';
import { SessionDiagnostics } from './speechmatics/session-diagnostics';
import { RefinementControls } from './ui/RefinementControls';

const DebugPanel = import.meta.env.DEV ? lazy(() => import('./ui/DebugPanel')) : null;
type ProviderName = 'mock' | 'jev';
type Runtime = { sessionId: string; engine: CueEngine; replay: ReplayEvidenceSource;
  refinement?: CueRefinement; diagnostics?: SessionDiagnostics; dispose: () => void };

function ReplaySession({ fixture, providerName }: { fixture: ReplayFixture; providerName: ProviderName }) {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const sessionId = crypto.randomUUID();
    const diagnostics = import.meta.env.DEV && providerName === 'jev' ? new SessionDiagnostics(sessionId, 'text-replay') : undefined;
    const provider = providerName === 'jev' ? new HttpDecisionProvider(undefined, diagnostics?.observeJevConfiguration) : new MockDecisionProvider(fixture.script);
    const cancel = () => { if (provider instanceof HttpDecisionProvider) provider.cancel(); };
    const engine = new CueEngine({ decide: input => diagnostics
      ? diagnostics.decide(input, () => provider.decide(input)) : provider.decide(input) });
    const detach = diagnostics?.attach(engine);
    const refinement = providerName === 'jev' ? new CueRefinement(sessionId, engine, diagnostics?.observeRefinement) : undefined;
    const replay = new ReplayEvidenceSource(fixture.entries);
    engine.connect(replay);
    const detachReplay = replay.subscribeStatus(() => {
      if (refinement && replay.getStatus() === 'finished') {
        void engine.drain().then(() => refinement.finish(), () => refinement.finish());
      }
    });
    const dispose = () => { refinement?.dispose(); engine.dispose(); replay.dispose(); cancel(); detach?.(); detachReplay(); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) setCycle(value => value + 1); };
    window.addEventListener('pagehide', dispose);
    window.addEventListener('pageshow', restore);
    setRuntime({ sessionId, engine, replay, refinement, diagnostics, dispose });
    return () => { dispose(); window.removeEventListener('pagehide', dispose); window.removeEventListener('pageshow', restore); };
  }, [fixture, providerName, cycle]);
  return runtime ? <ReplayView key={runtime.sessionId} runtime={runtime} fixture={fixture} providerName={providerName}
    reset={() => { runtime.dispose(); setCycle(value => value + 1); }} /> : <p role="status">Preparing replay…</p>;
}

const noRefinement = () => undefined;
const noSubscribe = () => () => {};

function ReplayView({ runtime: { engine, replay, refinement, diagnostics }, fixture, providerName, reset }: { runtime: Runtime; fixture: ReplayFixture; providerName: ProviderName; reset: () => void }) {
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const status = useSyncExternalStore(replay.subscribeStatus, replay.getStatus);
  const refined = useSyncExternalStore(refinement?.subscribe ?? noSubscribe, refinement?.getSnapshot ?? noRefinement);
  const [debugOpen, setDebugOpen] = useState(false);
  const [jevReady, setJevReady] = useState(false);
  const statusLabel = { ready: 'Ready when you are', playing: 'Lesson in progress', paused: 'Take your time', finished: 'Replay complete' }[status];

  return (
    <>
      <div className="lesson-heading">
        <div><p className="eyebrow">{fixture.subject} / A short lesson</p><h2>{fixture.title}</h2><p>{fixture.description}</p></div>
        <p className={`replay-status ${status}`} role="status"><span />{statusLabel}</p>
      </div>
      <CueSurface cues={snapshot.cues} display={refined?.cues} />
      {providerName === 'jev' && <JevSetup onReady={setJevReady} />}
      {providerName === 'jev' && snapshot.lastDecision?.error && <p className="provider-error" role="alert">{snapshot.lastDecision.error}</p>}
      <section className="replay-controls" aria-label="Replay controls">
        <div className="buttons">
          <button className="primary-button" onClick={() => status === 'playing' ? replay.pause() : replay.start()} disabled={status === 'finished' || (providerName === 'jev' && !jevReady)}>
            <span aria-hidden="true">{status === 'playing' ? 'Ⅱ' : '▷'}</span>
            {status === 'playing' ? 'Pause replay' : status === 'paused' ? 'Continue replay' : status === 'finished' ? 'Replay complete' : 'Start replay'}
          </button>
          <button className="reset-button" onClick={reset}>Reset</button>
        </div>
        <p>Text replay <span>·</span> 1× <span>·</span> {providerName === 'jev' ? 'Jev' : 'Scripted demo'}</p>
      </section>
      {refinement && <RefinementControls refinement={refinement} />}
      {DebugPanel && <div className="debug-toggle"><button aria-expanded={debugOpen} onClick={() => setDebugOpen(open => !open)}>{debugOpen ? 'Hide diagnostics' : 'Show diagnostics'}</button></div>}
      {DebugPanel && debugOpen && <Suspense fallback={<p>Loading diagnostics…</p>}><DebugPanel snapshot={snapshot} providerName={providerName} diagnostics={diagnostics} refinement={refined} /></Suspense>}
    </>
  );
}

export default function App() {
  const [inputMode, setInputMode] = useState<'replay' | 'microphone'>('replay');
  const [fixtureId, setFixtureId] = useState(replayFixtures[0]!.id);
  const [providerName, setProviderName] = useState<ProviderName>('mock');
  const fixture = replayFixtures.find(item => item.id === fixtureId)!;
  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="CueLight home"><span className="brand-mark" aria-hidden="true"><i /></span>CueLight</a>
        <div className="session-selectors">
          <label className="lesson-picker"><span>Input source</span><select aria-label="Input source" value={inputMode} onChange={event => setInputMode(event.target.value as 'replay' | 'microphone')}><option value="replay">Text replay</option><option value="microphone">Microphone</option></select></label>
          {inputMode === 'replay' && <>
          <label className="lesson-picker"><span>Decision provider</span><select aria-label="Decision provider" value={providerName} onChange={event => setProviderName(event.target.value as ProviderName)}><option value="mock">Scripted demo</option><option value="jev">Jev</option></select></label>
          <label className="lesson-picker"><span>Explore a lesson</span><select aria-label="Lesson" value={fixtureId} onChange={event => setFixtureId(event.target.value)}>{replayFixtures.map(item => <option key={item.id} value={item.id}>{item.subject}</option>)}</select></label>
          </>}
        </div>
      </header>
      {inputMode === 'microphone' ? <MicrophoneSession /> : <ReplaySession key={`${fixture.id}-${providerName}`} fixture={fixture} providerName={providerName} />}
      <footer className="app-footer"><p>Keep the idea in view.</p><p>A teaching-attention experiment</p></footer>
    </main>
  );
}
