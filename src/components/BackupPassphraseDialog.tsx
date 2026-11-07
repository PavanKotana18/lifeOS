import { useState } from 'react';

export default function BackupPassphraseDialog({ purpose, onComplete }: {
  purpose: 'export' | 'import'; onComplete(value: string | null): void;
}) {
  const [value, setValue] = useState('');
  return <main className="lifeos-page fixed inset-0 z-[100] flex items-center justify-center p-6">
    <form role="dialog" aria-modal="true" aria-labelledby="backup-passphrase-title" className="lifeos-panel w-full max-w-sm space-y-4 rounded-2xl border p-5 shadow-xl" onSubmit={event => {
      event.preventDefault(); const result = value; setValue(''); onComplete(result);
    }}>
      <h1 id="backup-passphrase-title" className="text-xl font-semibold">{purpose === 'export' ? 'Protect your backup' : 'Unlock this backup'}</h1>
      <p className="text-sm text-secondary">{purpose === 'export'
        ? 'Use at least 12 characters. Keep the passphrase separately; it is required to restore this file.'
        : 'Enter the passphrase used when this backup was exported.'}</p>
      <label className="block text-sm">Backup passphrase<input autoFocus required type="password"
        minLength={purpose === 'export' ? 12 : 1} maxLength={1024} autoComplete="off"
        value={value} onChange={event => setValue(event.target.value)}
        className="lifeos-input mt-2 min-h-11 w-full rounded-xl p-3" /></label>
      <button type="submit" className="lifeos-accent-button min-h-11 rounded-xl px-4 py-3 font-semibold">Continue</button>
      <button type="button" className="lifeos-input ml-3 min-h-11 rounded-xl px-4 py-3" onClick={() => {
        setValue(''); onComplete(null);
      }}>Cancel</button>
    </form>
  </main>;
}
