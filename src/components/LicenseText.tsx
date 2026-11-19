import { useEffect, useState } from 'react';

export default function LicenseText() {
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('./licenses/capacitor-local-notifications.txt', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('License unavailable.');
        return response.text();
      })
      .then(setText, () => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  return <article className="lifeos-panel rounded-2xl border p-4" aria-labelledby="license-title">
    <h2 id="license-title" className="type-section-title">Capacitor Local Notifications</h2>
    {error ? <div role="alert" className="mt-3 text-sm"><p>The license could not be loaded.</p><button type="button" className="lifeos-raised mt-2 min-h-11 rounded-xl px-3" onClick={() => { setError(false); setAttempt(current => current + 1); }}>Retry</button></div>
      : text ? <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{text}</pre>
        : <p role="status" className="mt-3 text-sm text-secondary">Loading license…</p>}
  </article>;
}
