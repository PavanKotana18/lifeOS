import { useState } from 'react';
import type { PreparedRecovery } from '../services/cryptoService';

interface Props {
  recovery: PreparedRecovery;
  onConfirm: (enteredCode: string) => Promise<void>;
}

export default function RecoverySetup({ recovery, onConfirm }: Props) {
  const [enteredCode, setEnteredCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const recoveryKit = JSON.stringify({
    product: 'LifeOS',
    format: 'lifeos-recovery-kit',
    version: 1,
    recoveryCode: recovery.recoveryCode,
    envelope: recovery.envelope
  }, null, 2);

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm(enteredCode.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recovery confirmation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="fixed inset-0 z-[100] overflow-y-auto bg-[#090d16] px-5 py-8 text-white">
      <section className="mx-auto flex min-h-full max-w-lg flex-col justify-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
          <span className="text-2xl" aria-hidden="true">🔐</span>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-300">Encryption recovery setup</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Save your recovery kit</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          LifeOS is preparing encrypted local storage. Save this complete recovery kit somewhere
          private and separate from this device. It is required to recover your data if this
          device's Keystore key is lost.
        </p>

        <div className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-xs font-semibold text-amber-200">Keep this kit private</p>
          <p className="mt-1 text-xs leading-5 text-amber-100/80">
            Anyone with this kit may be able to recover your LifeOS encryption key.
            Do not share it or store it in a public location.
          </p>
        </div>

        <label className="mt-5 block text-xs font-semibold text-slate-300">Recovery code</label>
        <textarea
          readOnly
          value={recovery.recoveryCode}
          rows={3}
          className="mt-2 w-full select-all rounded-xl border border-slate-700 bg-slate-900 p-3 font-mono text-sm leading-6 text-emerald-200"
          onFocus={event => event.currentTarget.select()}
        />

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => { void navigator.clipboard?.writeText(recoveryKit).catch(() => setError('Clipboard access failed. Select and copy the recovery kit manually.')); }}
            className="min-h-11 flex-1 rounded-xl border border-slate-700 px-3 text-xs font-semibold"
          >
            Copy complete recovery kit
          </button>
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([recoveryKit], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = 'lifeos-recovery-kit.json';
              anchor.click();
              URL.revokeObjectURL(url);
            }}
            className="min-h-11 flex-1 rounded-xl border border-slate-700 px-3 text-xs font-semibold"
          >
            Save recovery file
          </button>
        </div>

        <label className="mt-6 block text-xs font-semibold text-slate-300">
          Re-enter the recovery code to confirm you saved it
          <textarea
            value={enteredCode}
            onChange={event => setEnteredCode(event.target.value)}
            rows={3}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 font-mono text-sm text-white"
            placeholder="Paste the saved recovery code here"
          />
        </label>

        {error && <p role="alert" className="mt-3 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}

        <button
          type="button"
          disabled={busy || enteredCode.trim() !== recovery.recoveryCode}
          onClick={() => void confirm()}
          className="mt-5 min-h-12 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Confirming recovery protection…' : 'Confirm and activate encrypted storage'}
        </button>

        <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
          LifeOS will not open personal records until recovery protection is confirmed and
          encrypted storage migration succeeds. Do not uninstall the app while setup is pending.
        </p>
      </section>
    </main>
  );
}
