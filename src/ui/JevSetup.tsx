import { useEffect, useState } from 'react';

export function JevSetup({ onReady }: { onReady: (ready: boolean) => void }) {
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState('Checking Jev configuration…');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    let active = true;
    setMessage('Checking Jev configuration…');
    onReady(false);
    setReady(false);
    void (async () => {
      try {
        const response = await fetch('/api/jev/status', { signal: controller.signal });
        const value: unknown = await response.json();
        if (!response.ok || !value || typeof value !== 'object' || !('configured' in value) ||
            typeof value.configured !== 'boolean' || !('model' in value) || typeof value.model !== 'string') {
          throw new Error('Unavailable');
        }
        if (!active) return;
        setReady(value.configured);
        onReady(value.configured);
        setMessage(value.configured
          ? `Jev ready · ${value.model}. Starting a replay uses your TypeSafe account.`
          : 'Add TYPESAFE_API_KEY to .env.local, restart the local server, then check again. Your key stays on the server.');
      } catch {
        if (active) setMessage('Jev is unavailable. Run CueLight with npm run dev or npm run preview, then check again.');
      } finally { clearTimeout(timer); }
    })();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [attempt, onReady]);

  return <div className="provider-setup" role="status"><p>{message}</p>{!ready && <button onClick={() => setAttempt(value => value + 1)}>Check again</button>}</div>;
}
