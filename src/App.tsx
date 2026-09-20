import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { CueEngine } from './cue/cue-engine';
import { MockDecisionProvider } from './decision/mock-decision-provider';
import { replayFixtures, type ReplayFixture } from './replay/replay-fixtures';
import { ReplayEvidenceSource } from './replay/replay-source';
import { CueSurface } from './ui/CueSurface';

const DebugPanel = import.meta.env.DEV ? lazy(() => import('./ui/DebugPanel')) : null;
type Runtime = { engine: CueEngine; replay: ReplayEvidenceSource };

function ReplaySession({ fixture }: { fixture: ReplayFixture }) {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  useEffect(() => {
    const engine = new CueEngine(new MockDecisionProvider(fixture.script));
    const replay = new ReplayEvidenceSource(fixture.entries);
    engine.connect(replay);
    setRuntime({ engine, replay });
    return () => { engine.dispose(); replay.dispose(); };
  }, [fixture]);
  return runtime ? <ReplayView runtime={runtime} fixture={fixture} /> : <p role="status">Preparing replay…</p>;
}

function ReplayView({ runtime: { engine, replay }, fixture }: { runtime: Runtime; fixture: ReplayFixture }) {
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const status = useSyncExternalStore(replay.subscribeStatus, replay.getStatus);
  const [debugOpen, setDebugOpen] = useState(false);
  const reset = () => { replay.reset(); engine.reset(); };
  const statusLabel = { ready: 'Ready when you are', playing: 'Lesson in progress', paused: 'Take your time', finished: 'Replay complete' }[status];

  return (
    <>
      <div className="lesson-heading">
        <div><p className="eyebrow">{fixture.subject} / A short lesson</p><h2>{fixture.title}</h2><p>{fixture.description}</p></div>
        <p className={`replay-status ${status}`} role="status"><span />{statusLabel}</p>
      </div>
      <CueSurface cues={snapshot.cues} />
      <section className="replay-controls" aria-label="Replay controls">
        <div className="buttons">
          <button className="primary-button" onClick={() => status === 'playing' ? replay.pause() : replay.start()} disabled={status === 'finished'}>
            <span aria-hidden="true">{status === 'playing' ? 'Ⅱ' : '▷'}</span>
            {status === 'playing' ? 'Pause replay' : status === 'paused' ? 'Continue replay' : status === 'finished' ? 'Replay complete' : 'Start replay'}
          </button>
          <button className="reset-button" onClick={reset}>Reset</button>
        </div>
        <p>Text replay <span>·</span> 1× <span>·</span> Scripted demo</p>
      </section>
      {DebugPanel && <div className="debug-toggle"><button aria-expanded={debugOpen} onClick={() => setDebugOpen(open => !open)}>{debugOpen ? 'Hide diagnostics' : 'Show diagnostics'}</button></div>}
      {DebugPanel && debugOpen && <Suspense fallback={<p>Loading diagnostics…</p>}><DebugPanel snapshot={snapshot} /></Suspense>}
    </>
  );
}

export default function App() {
  const [fixtureId, setFixtureId] = useState(replayFixtures[0]!.id);
  const fixture = replayFixtures.find(item => item.id === fixtureId)!;
  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="CueLight home"><span className="brand-mark" aria-hidden="true"><i /></span>CueLight</a>
        <label className="lesson-picker"><span>Explore a lesson</span><select aria-label="Lesson" value={fixtureId} onChange={event => setFixtureId(event.target.value)}>{replayFixtures.map(item => <option key={item.id} value={item.id}>{item.subject}</option>)}</select></label>
      </header>
      <ReplaySession key={fixture.id} fixture={fixture} />
      <footer className="app-footer"><p>Keep the idea in view.</p><p>A teaching-attention experiment</p></footer>
    </main>
  );
}
