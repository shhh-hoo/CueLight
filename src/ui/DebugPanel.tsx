import type { EngineSnapshot } from '../cue/cue-engine';
import type { SessionDiagnostics } from '../speechmatics/session-diagnostics';
import type { RefinementSnapshot } from '../refinement/cue-refinement';

export default function DebugPanel({ snapshot, providerName, diagnostics, refinement }: { snapshot: EngineSnapshot; providerName: 'mock' | 'jev'; diagnostics?: SessionDiagnostics; refinement?: RefinementSnapshot }) {
  const last = snapshot.lastDecision;
  const decision = last?.decision;
  const selected = decision && decision.action !== 'QUIET'
    ? last?.input.candidates.find(candidate => candidate.id === decision.candidateId)
    : null;
  return (
    <aside className="debug-panel" aria-label="Developer diagnostics">
      <header><h2>Behind the Cue</h2><span className="eyebrow">Development only</span></header>
      {diagnostics && <div><button onClick={() => diagnostics.download()}>Export session diagnostics</button><p>Final delivery → adapter → candidates → Jev → Cue-state. Source audio time is separate; browser paint and speech-to-screen latency are not measured.</p><details><summary>Last 20 session events · export includes all recorded events</summary><pre>{JSON.stringify(diagnostics.recentEvents(), null, 2)}</pre></details></div>}
      <p>{providerName === 'jev' ? 'Jev provider · inspect decisions against the teaching evidence.' : 'Scripted provider · deterministic behavior, not a semantic quality evaluation.'}</p>
      <dl className="debug-summary">
        <div><dt>Evidence version</dt><dd data-testid="evidence-version">{snapshot.evidence.version}</dd></div>
        <div><dt>Request status</dt><dd>{snapshot.status}</dd></div>
        <div><dt>Request version</dt><dd>{snapshot.request?.evidence.version ?? '—'}</dd></div>
        <div><dt>Returned action</dt><dd data-testid="returned-action">{last?.decision.action ?? '—'}</dd></div>
        <div><dt>Outcome</dt><dd>{last?.outcome ?? '—'}</dd></div>
        <div><dt>Decision latency</dt><dd>{last ? `${last.durationMs} ms` : '—'}</dd></div>
      </dl>
      {(snapshot.inputError || last?.error) && <p role="alert">{snapshot.inputError ?? last?.error}</p>}
      <h3>Incoming fragment</h3>
      <pre>{snapshot.incoming ? JSON.stringify(snapshot.incoming, null, 2) : 'Waiting for input.'}</pre>
      <h3>Rolling evidence · {snapshot.evidence.fragments.length} / 32 fragments</h3>
      <ol>{snapshot.evidence.fragments.map(fragment => <li key={fragment.id}><code>{fragment.id}</code> {fragment.text}</li>)}</ol>
      <h3>Generated candidates</h3>
      <ol>{snapshot.candidates.map(candidate => <li key={candidate.id}><code>{candidate.id}</code><p>{candidate.text}</p></li>)}</ol>
      <h3>Selected candidate</h3><pre>{selected ? JSON.stringify(selected, null, 2) : 'None'}</pre>
      <h3>Current Cue</h3><pre>{JSON.stringify(snapshot.cues.currentCue, null, 2)}</pre>
      <h3>Previous Cue</h3><pre>{JSON.stringify(snapshot.cues.previousCue, null, 2)}</pre>
      {refinement && <><h3>Optional refinement · source versus display</h3><pre>{JSON.stringify(refinement, null, 2)}</pre><p>Refinement timings and outcomes are recorded separately from the first Cue-state update. Neither measures browser paint.</p></>}
      <details><summary>Last request snapshot</summary><pre>{last ? JSON.stringify(last.input, null, 2) : 'No completed request.'}</pre></details>
    </aside>
  );
}
