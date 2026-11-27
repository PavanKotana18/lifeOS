import { KeyRound } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { ProfileButton, ProfileIcon } from './ProfileSettings';
import RecoveryProgress from './RecoveryProgress';

export default function RecoveryDialog({ onRecover, onClose }: {
  onRecover(kit: string): Promise<void>; onClose(): void;
}) {
  const [kit, setKit] = useState('');
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const fileGeneration = useRef(0);
  useEffect(() => () => { fileGeneration.current++; }, []);
  const close = () => { if (!inFlight.current) { setKit(''); onClose(); } };
  return <main className="profile-design profile-overlay" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
  }}>
    <section role="dialog" aria-modal="true" aria-labelledby="recovery-dialog-title" className="profile-protected-form">
      <ProfileIcon icon={KeyRound} />
      <h1 id="recovery-dialog-title">Recover access</h1>
      <p className="profile-description">Choose the private recovery kit for this workspace, then confirm your identity using Android.</p>
      <RecoveryProgress profile step={busy ? 3 : kit ? 2 : 1} labels={['Choose file', 'Review', 'Verify']} />
      <label className="profile-field">Private recovery kit<input type="file" accept="application/json,.json" disabled={busy}
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = ''; setMessage(''); setKit(''); setReading(false);
          const generation = ++fileGeneration.current;
          if (!file) return;
          if (file.size > 8192) { setMessage('Recovery kit is too large.'); return; }
          setReading(true);
          void file.text().then(value => { if (generation === fileGeneration.current) setKit(value); },
            () => { if (generation === fileGeneration.current) setMessage('The file could not be read.'); })
            .finally(() => { if (generation === fileGeneration.current) setReading(false); });
        }} /></label>
      {reading && <p role="status" className="profile-description">Reading the selected file…</p>}
      {message && <p role="alert" className="profile-error">{message}</p>}
      <div className="profile-actions">
        <ProfileButton disabled={busy} data-profile-protected-close onClick={close}>Close</ProfileButton>
        <ProfileButton tone="primary" disabled={busy || reading || !kit}
          onClick={() => {
            if (inFlight.current) return;
            inFlight.current = true; setBusy(true); setMessage('');
            void onRecover(kit).catch(error => setMessage(error instanceof Error ? error.message : 'Recovery failed. Your data stays locked.'))
              .finally(() => { setKit(''); setBusy(false); inFlight.current = false; });
          }}>{busy ? 'Verifying recovery…' : 'Verify kit and authenticate'}</ProfileButton>
      </div>
    </section>
  </main>;
}
