import { useState } from 'react';

export default function BackupPassphraseDialog({ purpose, onComplete }: {
  purpose: 'export' | 'import'; onComplete(value: string | null): void;
}) {
  const [value, setValue] = useState('');
  return <main className="lifeos-page fixed inset-0 z-[100] flex items-center justify-center p-6">
    <form className="w-full max-w-sm space-y-4" onSubmit={event => {
      event.preventDefault(); const result = value; setValue(''); onComplete(result);
    }}>
      <h1 className="text-xl font-semibold">{purpose === 'export' ? 'Protect your backup' : 'Unlock this backup'}</h1>
      <p className="text-sm text-slate-300">{purpose === 'export'
        ? 'Use at least 12 characters. Keep the passphrase separately; it is required to restore this file.'
        : 'Enter the passphrase used when this backup was exported.'}</p>
      <label className="block text-sm">Backup passphrase<input autoFocus required type="password"
        minLength={purpose === 'export' ? 12 : 1} maxLength={1024} autoComplete="off"
        value={value} onChange={event => setValue(event.target.value)}
        className="mt-2 w-full rounded border border-slate-600 bg-slate-900 p-3" /></label>
      <button type="submit" className="rounded bg-indigo-600 px-4 py-3">Continue</button>
      <button type="button" className="ml-3 rounded border px-4 py-3" onClick={() => {
        setValue(''); onComplete(null);
      }}>Cancel</button>
    </form>
  </main>;
}
