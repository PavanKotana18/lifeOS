import { useState, useRef, useEffect } from 'react';

export default function RecoveryDialog({ onRecover, onClose }: {
  onRecover(kit: string): Promise<void>; onClose(): void;
}) {
  const [kit, setKit] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const fileGeneration = useRef(0);
  useEffect(() => () => { fileGeneration.current++; }, []);
  return <main className="lifeos-page fixed inset-0 z-[100] flex items-center justify-center p-6">
    <section role="dialog" aria-modal="true" aria-labelledby="recovery-dialog-title" className="lifeos-panel w-full max-w-md space-y-4 rounded-2xl border p-5 shadow-xl">
      <h1 id="recovery-dialog-title" className="text-xl font-semibold">Recover the existing encryption key</h1>
      <p className="text-sm text-secondary">Select your complete private recovery kit. LifeOS verifies it against an existing encrypted record before biometric re-binding. Database records are never replaced.</p>
      <label className="block text-sm">Private recovery kit<input type="file" accept="application/json,.json" disabled={busy}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; setMessage(''); setKit('');
          const generation = ++fileGeneration.current;
          if (!file) return; if (file.size > 8192) { setMessage('Recovery kit is too large.'); return; }
          void file.text().then(value => { if (generation === fileGeneration.current) setKit(value); },
            () => { if (generation === fileGeneration.current) setMessage('The file could not be read.'); });
        }} className="lifeos-input mt-2 block min-h-11 w-full rounded-xl p-2" /></label>
      {message && <p role="status" className="lifeos-warning text-sm">{message}</p>}
      <button disabled={busy || !kit} className="lifeos-accent-button min-h-11 rounded-xl px-4 py-3 font-semibold disabled:opacity-40"
        onClick={() => { if (inFlight.current) return; inFlight.current = true; setBusy(true); setMessage(''); void onRecover(kit).then(() => {
          setMessage('The existing key was verified and re-bound. Your encrypted records can now reopen after authentication.');
        }, error => setMessage(error instanceof Error ? error.message : 'Recovery failed; data remains locked.'))
          .finally(() => { setKit(''); setBusy(false); inFlight.current = false; }); }}> {busy ? 'Verifying recovery…' : 'Verify kit and authenticate'}</button>
      <button disabled={busy} onClick={() => { setKit(''); onClose(); }} className="lifeos-input ml-3 min-h-11 rounded-xl px-4 py-3">Close</button>
    </section>
  </main>;
}
