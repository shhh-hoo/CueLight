import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CueRefinement } from '../refinement/cue-refinement';

export function RefinementControls({ refinement }: { refinement: CueRefinement }) {
  const snapshot = useSyncExternalStore(refinement.subscribe, refinement.getSnapshot);
  const [configured, setConfigured] = useState(false);
  const [message, setMessage] = useState('Checking optional text refinement…');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3_000);
    void (async () => {
      try {
        const response = await fetch('/api/openai/status', { signal: controller.signal });
        const data: unknown = await response.json();
        if (!response.ok || !data || typeof data !== 'object' || !('configured' in data) || typeof data.configured !== 'boolean') throw new Error();
        if (!active) return;
        refinement.configure(data, data.configured);
        setConfigured(data.configured);
        setMessage(data.configured ? 'Optional · uses your OpenAI account. The original Cue appears first.'
          : 'Optional · set OPENAI_API_KEY in .env.local and restart the local server to enable.');
      } catch { if (active) { setConfigured(false); setMessage('Optional text refinement is unavailable. Teaching can continue.'); } }
      finally { clearTimeout(timer); }
    })();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [attempt, refinement]);
  return <section className="provider-setup" aria-label="Text refinement controls">
    <label><input type="checkbox" checked={snapshot.enabled} disabled={!configured || snapshot.stopped}
      onChange={event => refinement.setEnabled(event.target.checked)} /> Text refinement · preserve meaning, simplify wording</label>
    <p>{message}</p>
    {!configured && <button onClick={() => setAttempt(value => value + 1)}>Check OpenAI again</button>}
    {snapshot.busy && !snapshot.stopped && snapshot.enabled && <p role="status">Refining wording…</p>}
    {snapshot.error && <p role="status">{snapshot.error}</p>}
  </section>;
}
