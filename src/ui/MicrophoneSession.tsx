import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CueEngine } from '../cue/cue-engine';
import { HttpDecisionProvider } from '../decision/http-decision-provider';
import { DECISION_DRAIN_MS } from '../speechmatics/config';
import { SessionDiagnostics } from '../speechmatics/session-diagnostics';
import { SpeechmaticsEvidenceSource } from '../speechmatics/speechmatics-source';
import { CueSurface } from './CueSurface';
import { JevSetup } from './JevSetup';
import { CueRefinement } from '../refinement/cue-refinement';
import { RefinementControls } from './RefinementControls';

const DebugPanel = import.meta.env.DEV ? lazy(() => import('./DebugPanel')) : null;

function createRuntime() {
  const sessionId = crypto.randomUUID();
  const diagnostics = import.meta.env.DEV ? new SessionDiagnostics(sessionId) : undefined;
  const http = new HttpDecisionProvider(undefined, diagnostics?.observeJevConfiguration);
  const engine = new CueEngine({ decide: input => diagnostics
    ? diagnostics.decide(input, () => http.decide(input)) : http.decide(input) });
  const detach = diagnostics?.attach(engine);
  const refinement = new CueRefinement(sessionId, engine, diagnostics?.observeRefinement);
  const source = new SpeechmaticsEvidenceSource({
    sessionId, observe: diagnostics?.observe,
    drainDecisions: async () => { try { await engine.drain(DECISION_DRAIN_MS); } finally { refinement.finish(); } },
    abandonDecisions: () => { refinement.finish(); engine.dispose(); http.cancel(); },
  });
  engine.connect(source);
  return { sessionId, engine, source, diagnostics, refinement,
    dispose() { refinement.dispose(); source.dispose(); engine.dispose(); http.cancel(); detach?.(); } };
}
type Runtime = ReturnType<typeof createRuntime>;

export function MicrophoneSession() {
  const current = useRef<Runtime | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const reset = useCallback(() => {
    current.current?.dispose();
    const next = createRuntime();
    current.current = next;
    setRuntime(next);
    return next;
  }, []);
  useEffect(() => {
    reset();
    const leave = () => current.current?.dispose();
    const restore = (event: PageTransitionEvent) => { if (event.persisted) reset(); };
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', restore);
    return () => { leave(); window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', restore); };
  }, [reset]);
  return runtime ? <MicrophoneView key={runtime.sessionId}
    runtime={runtime} reset={reset} /> : <p role="status">Preparing microphone mode…</p>;
}

function MicrophoneView({ runtime, reset }: { runtime: Runtime; reset: () => Runtime }) {
  const { engine, source, diagnostics, refinement } = runtime;
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const input = useSyncExternalStore(source.subscribeStatus, source.getSnapshot);
  const refined = useSyncExternalStore(refinement.subscribe, refinement.getSnapshot);
  const [jevReady, setJevReady] = useState(false);
  const [speechmaticsReady, setSpeechmaticsReady] = useState(false);
  const [setupMessage, setSetupMessage] = useState('Checking Voice gateway…');
  const [attempt, setAttempt] = useState(0);
  const [debugOpen, setDebugOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    let active = true;
    setSpeechmaticsReady(false);
    void (async () => {
      try {
        const response = await fetch('/api/voice/status', { signal: controller.signal });
        const data: unknown = await response.json();
        if (!response.ok || !data || typeof data !== 'object' || !('configured' in data) || typeof data.configured !== 'boolean') throw new Error();
        if (!active) return;
        setSpeechmaticsReady(data.configured);
        setSetupMessage(data.configured
          ? 'Voice SDK ready · Mandarin / English. Starting uses your Speechmatics and TypeSafe accounts.'
          : 'Add SPEECHMATICS_API_KEY to .env.local and restart the Python Voice gateway. Your key stays on the server.');
      } catch { if (active) setSetupMessage('Python Voice gateway is unavailable. Run npm run voice alongside the local app.'); }
      finally { clearTimeout(timer); }
    })();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [attempt]);
  const statusLabel = {
    ready: 'Ready when you are', connecting: 'Connecting · please wait before speaking',
    running: 'Microphone live · you can speak now', stopping: 'Stopping · finishing the last audio and decision',
    stopped: 'Session stopped', error: 'Session interrupted',
  }[input.status];
  const busy = input.status === 'connecting' || input.status === 'stopping';
  const start = () => {
    const next = input.status === 'stopped' || input.status === 'error' ? reset() : runtime;
    void next.source.start();
  };
  return <>
    <div className="lesson-heading"><div><p className="eyebrow">Live teaching / Microphone</p><h2>Keep the teaching point in view</h2><p>Speak naturally. CueLight keeps selected teaching content on screen.</p></div>
      <p className={`replay-status ${input.status}`} role="status"><span />{statusLabel}</p></div>
    <CueSurface cues={snapshot.cues} display={refined.cues} />
    <JevSetup onReady={setJevReady} />
    <div className="provider-setup" role="status"><p>{setupMessage}</p>{!speechmaticsReady && <button onClick={() => setAttempt(value => value + 1)}>Check Voice gateway again</button>}</div>
    {(input.error || input.inputError || snapshot.inputError || snapshot.lastDecision?.error) &&
      <p className="provider-error" role="alert">{input.error ?? input.inputError ?? snapshot.inputError ?? snapshot.lastDecision?.error}</p>}
    <section className="replay-controls" aria-label="Microphone controls"><div className="buttons">
      <button className="primary-button" disabled={busy || (input.status !== 'running' && (!jevReady || !speechmaticsReady))}
        onClick={() => input.status === 'running' ? void source.stop() : start()}>
        {input.status === 'running' ? 'Stop microphone' : input.status === 'stopping' ? 'Finishing session…'
          : input.status === 'connecting' ? 'Connecting…' : input.status === 'error' ? 'Reconnect microphone'
            : input.status === 'stopped' ? 'Start new session' : 'Start microphone'}
      </button><button className="reset-button" onClick={() => reset()}>Reset</button>
    </div><p>Microphone <span>·</span> Mandarin / English <span>·</span> Jev</p></section>
    <RefinementControls refinement={refinement} />
    {DebugPanel && <div className="debug-toggle"><button aria-expanded={debugOpen} onClick={() => setDebugOpen(open => !open)}>{debugOpen ? 'Hide diagnostics' : 'Show diagnostics'}</button></div>}
    {DebugPanel && debugOpen && <Suspense fallback={<p>Loading diagnostics…</p>}><DebugPanel snapshot={snapshot} providerName="jev" diagnostics={diagnostics} refinement={refined} /></Suspense>}
  </>;
}
