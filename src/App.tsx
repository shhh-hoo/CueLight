import { LessonStore, browserJournal } from './alive/journal';
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CueEngine } from './cue/cue-engine';
import { MockDecisionProvider } from './decision/mock-decision-provider';
import { HttpSemanticProvider } from './decision/http-semantic-provider';
import { replayFixtures, type ReplayFixture } from './replay/replay-fixtures';
import { ReplayEvidenceSource } from './replay/replay-source';
import { TraceWorkspace, ImportedTrace } from './ui/TraceWorkspace';
import { TraceSession } from './trace/session';
import { readTraceFile } from './trace/archive';
import type { LeaveGuard, OpenedTrace } from './trace/types';
import { JevSetup } from './ui/JevSetup';
import { MicrophoneSession } from './ui/MicrophoneSession';
import { CueRefinement } from './refinement/cue-refinement';
import { SessionDiagnostics } from './speechmatics/session-diagnostics';
import { RefinementControls } from './ui/RefinementControls';

const DebugPanel = import.meta.env.DEV ? lazy(() => import('./ui/DebugPanel')) : null;
type ProviderName = 'mock' | 'jev';
type Runtime = { sessionId: string; engine: CueEngine; replay: ReplayEvidenceSource;
  trace: TraceSession; deleteLocal: () => void; refinement?: CueRefinement; diagnostics?: SessionDiagnostics; dispose: () => void };

function ReplaySession({ fixture, providerName, guard }: { fixture: ReplayFixture; providerName: ProviderName; guard: LeaveGuard }) {
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const sessionId = crypto.randomUUID();
    const diagnostics = import.meta.env.DEV && providerName === 'jev' ? new SessionDiagnostics(sessionId, 'text-replay') : undefined;
    const provider = providerName === 'jev' ? new HttpSemanticProvider(undefined, diagnostics?.observeJevConfiguration) : new MockDecisionProvider(fixture.script);
    const cancel = () => { if (provider instanceof HttpSemanticProvider) provider.cancel(); };
    const store = new LessonStore(browserJournal(sessionId));
    const engine = new CueEngine(provider, undefined, store);
    const trace = new TraceSession(engine, providerName === 'mock' ? 'demo' : 'text-replay');
    if (providerName === 'jev') engine.configureTeacherCapture(sessionId);
    const detach = diagnostics?.attach(engine);
    const refinement = providerName === 'jev' ? new CueRefinement(sessionId, engine, diagnostics?.observeRefinement) : undefined;
    const replay = new ReplayEvidenceSource(fixture.entries);
    engine.connect(replay);
    const detachPresentation = refinement?.subscribe(() => trace.presentation(refinement.getSnapshot().cues));
    const detachReplay = replay.subscribeStatus(() => {
      const status = replay.getStatus();
      trace.phase(status === 'playing' ? 'capturing' : status);
      if (replay.getStatus() === 'finished') {
        engine.stopOptionalInspections();
        void engine.drain().then(() => refinement?.finish(), error => { trace.issue('processing', error.message); refinement?.finish(); });
      }
    });
    const dispose = () => {
      const status = replay.getStatus();
      trace.phase(status === 'ready' || status === 'finished' ? status : 'interrupted');
      trace.dispose(); refinement?.dispose(); engine.dispose(); detachReplay(); replay.dispose(); cancel(); detach?.(); detachPresentation?.();
    };
    const deleteLocal = () => { dispose(); trace.deleteLocalMetadata(); store.delete(); };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) setCycle(value => value + 1); };
    window.addEventListener('pagehide', dispose);
    window.addEventListener('pageshow', restore);
    setRuntime({ sessionId, engine, replay, trace, deleteLocal, refinement, diagnostics, dispose });
    return () => { dispose(); window.removeEventListener('pagehide', dispose); window.removeEventListener('pageshow', restore); };
  }, [fixture, providerName, cycle]);
  return runtime ? <ReplayView key={runtime.sessionId} runtime={runtime} fixture={fixture} providerName={providerName}
    guard={guard} reset={() => { runtime.dispose(); setCycle(value => value + 1); }} /> : <p role="status">Preparing replay…</p>;
}

const noRefinement = () => undefined;
const noSubscribe = () => () => {};

function ReplayView({ runtime: { engine, replay, trace, deleteLocal, refinement, diagnostics }, fixture, providerName, reset, guard }: { runtime: Runtime; fixture: ReplayFixture; providerName: ProviderName; reset: () => void; guard: LeaveGuard }) {
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
      {providerName === 'jev' && <JevSetup onReady={setJevReady} />}
      {(snapshot.inputError || (snapshot.lastSemantic?.error ?? snapshot.lastDecision?.error)) && <p className="provider-error" role="alert">{snapshot.inputError ?? (snapshot.lastSemantic?.error ?? snapshot.lastDecision?.error)}</p>}
      <section className="replay-controls" aria-label="Replay controls">
        <div className="buttons">
          <button className="primary-button" onClick={() => status === 'playing' ? replay.pause() : replay.start()} disabled={status === 'finished' || (providerName === 'jev' && !jevReady)}>
            <span aria-hidden="true">{status === 'playing' ? 'Ⅱ' : '▷'}</span>
            {status === 'playing' ? 'Pause replay' : status === 'paused' ? 'Continue replay' : status === 'finished' ? 'Replay complete' : 'Start replay'}
          </button>
          <button className="reset-button" onClick={() => { if (guard.current()) reset(); }}>Reset</button>
        </div>
        <p>Text replay <span>·</span> 1× <span>·</span> {providerName === 'jev' ? 'Jev' : 'Scripted demo'}</p>
      </section>
      {refinement && <RefinementControls refinement={refinement} />}
      <TraceWorkspace engine={engine} trace={trace} guard={guard} display={refined?.cues} onDelete={() => { deleteLocal(); reset(); }} />
      {DebugPanel && <div className="debug-toggle"><button aria-expanded={debugOpen} onClick={() => setDebugOpen(open => !open)}>{debugOpen ? 'Hide diagnostics' : 'Show diagnostics'}</button></div>}
      {DebugPanel && debugOpen && <Suspense fallback={<p>Loading diagnostics…</p>}><DebugPanel snapshot={snapshot} providerName={providerName} diagnostics={diagnostics} refinement={refined} /></Suspense>}
    </>
  );
}

export default function App() {
  const development = location.pathname === '/dev';
  const [inputMode, setInputMode] = useState<'replay' | 'microphone'>(development ? 'replay' : 'microphone');
  const [fixtureId, setFixtureId] = useState(replayFixtures[0]!.id);
  const [providerName, setProviderName] = useState<ProviderName>('mock');
  const [opened, setOpened] = useState<OpenedTrace | null>(null);
  const [importError, setImportError] = useState('');
  const [openedVersion, setOpenedVersion] = useState(0);
  const [opening, setOpening] = useState(false);
  const guard = useRef(() => true);
  const importGeneration = useRef(0);
  const fixture = replayFixtures.find(item => item.id === fixtureId)!;
  return (
    <main className={`app-shell ${development ? 'development-workbench' : 'teacher-workbench'}`}>
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="CueLight home" onClick={e => { if (!guard.current()) e.preventDefault(); }}><span className="brand-mark" aria-hidden="true"><i /></span>CueLight</a>
        <label className="file-picker">{opening ? '正在验证文件…' : '打开 TRACE 文件'}<input aria-label="打开 TRACE 文件" type="file" accept=".json,application/json" onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = '';
          if (!file) return;
          const generation = ++importGeneration.current;
          setOpening(true); setImportError('');
          try { const result = await readTraceFile(file); if (generation === importGeneration.current) { setOpened(result); setOpenedVersion(generation); } }
          catch (error) { if (generation === importGeneration.current) setImportError(`文件未打开，当前会话未更改：${error instanceof Error ? error.message : '无法读取文件'}`); }
          finally { if (generation === importGeneration.current) setOpening(false); }
        }} /></label>
      </header>
      {importError && <p role="alert" className="provider-error">{importError}</p>}
      {opened && <><div className="archive-banner"><p>只读文件 · 不调用模型或麦克风。原会话保留；若正在采集，它仍继续运行。</p><button className="secondary-button" onClick={() => setOpened(null)}>返回当前会话</button></div><ImportedTrace key={openedVersion} opened={opened} /></>}
      <div className="session-content" hidden={!!opened}>
        {development && <div className="session-selectors trace-selectors">
          <label className="lesson-picker"><span>输入来源</span><select aria-label="Input source" value={inputMode} onChange={event => { if (guard.current()) setInputMode(event.target.value as 'replay' | 'microphone'); }}><option value="replay">文本回放</option><option value="microphone">麦克风</option></select></label>
          {inputMode === 'replay' && <>
          <label className="lesson-picker"><span>梳理方式</span><select aria-label="Decision provider" value={providerName} onChange={event => { if (guard.current()) setProviderName(event.target.value as ProviderName); }}><option value="mock">离线编写示例</option><option value="jev">Jev</option></select></label>
          <label className="lesson-picker"><span>示例</span><select aria-label="Lesson" value={fixtureId} onChange={event => { if (guard.current()) setFixtureId(event.target.value); }}>{replayFixtures.map(item => <option key={item.id} value={item.id}>{item.subject}</option>)}</select></label>
          </>}
        </div>}
        {inputMode === 'microphone' ? <MicrophoneSession guard={guard} development={development} /> : <ReplaySession key={`${fixture.id}-${providerName}`} fixture={fixture} providerName={providerName} guard={guard} />}
      </div>
    </main>
  );
}
