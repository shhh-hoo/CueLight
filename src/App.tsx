import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { CueEngine } from './cue/cue-engine';
import { MockDecisionProvider } from './decision/mock-decision-provider';
import { HttpDecisionProvider } from './decision/http-decision-provider';
import { replayFixtures, type ReplayFixture } from './replay/replay-fixtures';
import { ReplayEvidenceSource } from './replay/replay-source';
import { CueSurface } from './ui/CueSurface';
import { JevSetup } from './ui/JevSetup';
import { MicrophoneSession } from './ui/MicrophoneSession';

const DebugPanel = import.meta.env.DEV ? lazy(() => import('./ui/DebugPanel')) : null;
type ProviderName = 'mock' | 'jev';
type Runtime = { engine: CueEngine; replay: ReplayEvidenceSource; cancel: () => void };

function ReplaySession({ fixture, providerName }: { fixture: ReplayFixture; providerName: ProviderName }) {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  useEffect(() => {
    const provider = providerName === 'jev' ? new HttpDecisionProvider() : new MockDecisionProvider(fixture.script);
    const cancel = () => { if (provider instanceof HttpDecisionProvider) provider.cancel(); };
    const engine = new CueEngine(provider);
    const replay = new ReplayEvidenceSource(fixture.entries);
    engine.connect(replay);
    setRuntime({ engine, replay, cancel });
    return () => { engine.dispose(); replay.dispose(); cancel(); };
  }, [fixture, providerName]);
  return runtime ? <ReplayView runtime={runtime} fixture={fixture} providerName={providerName} /> : <p role="status">Preparing replay…</p>;
}

function ReplayView({ runtime: { engine, replay, cancel }, fixture, providerName }: { runtime: Runtime; fixture: ReplayFixture; providerName: ProviderName }) {
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const status = useSyncExternalStore(replay.subscribeStatus, replay.getStatus);
  const [debugOpen, setDebugOpen] = useState(false);
  const [jevReady, setJevReady] = useState(false);
  const reset = () => { replay.reset(); engine.reset(); cancel(); };
  const statusLabel = { ready: 'Ready when you are', playing: 'Lesson in progress', paused: 'Take your time', finished: 'Replay complete' }[status];

  return (
    <>
      <div className="lesson-heading">
        <div><p className="eyebrow">{fixture.subject} / A short lesson</p><h2>{fixture.title}</h2><p>{fixture.description}</p></div>
        <p className={`replay-status ${status}`} role="status"><span />{statusLabel}</p>
      </div>
      <CueSurface cues={snapshot.cues} />
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
      {DebugPanel && <div className="debug-toggle"><button aria-expanded={debugOpen} onClick={() => setDebugOpen(open => !open)}>{debugOpen ? 'Hide diagnostics' : 'Show diagnostics'}</button></div>}
      {DebugPanel && debugOpen && <Suspense fallback={<p>Loading diagnostics…</p>}><DebugPanel snapshot={snapshot} providerName={providerName} /></Suspense>}
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
