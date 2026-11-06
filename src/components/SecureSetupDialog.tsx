import { useState } from 'react';
import type { PreparedRecovery } from '../services/cryptoService.ts';

/** Recovery secrets live only in this mounted dialog and native pending state. */
export default function SecureSetupDialog({ prepared, onDecision }: {
  prepared?: PreparedRecovery;
  onDecision(accepted: boolean): void;
}) {
  const [code, setCode] = useState('');
  const [saved, setSaved] = useState(false);
  return <main className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950 p-6 text-white">
    <section className="mx-auto flex min-h-full max-w-md flex-col justify-center space-y-4">
      <h1 className="text-2xl font-semibold">{prepared ? 'Save your private recovery kit' : 'Protect your local LifeOS data'}</h1>
      {prepared ? <>
        <p className="text-sm text-slate-300">Keep this complete kit separate from this device. Anyone with it may recover your encryption key. LifeOS cannot replace a lost kit if the device key becomes unavailable.</p>
        <p className="text-sm text-amber-200">Record the complete kit below on paper or another trusted device while LifeOS stays open. Leaving the app cancels setup and clears the pending kit. A code alone is insufficient: keep the envelope too.</p>
        <details open><summary className="cursor-pointer text-sm">Complete kit for manual safekeeping</summary>
          <textarea readOnly aria-label="Complete private recovery kit" rows={10} autoComplete="off" spellCheck={false}
            className="mt-2 w-full rounded bg-slate-900 p-3 font-mono text-xs"
            value={JSON.stringify({ product: 'LifeOS', format: 'lifeos-recovery-kit', version: 1,
              recoveryCode: prepared.recoveryCode, envelope: prepared.envelope }, null, 2)} />
        </details>
        <label className="flex gap-3 text-sm"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} />I saved the complete recovery kit in a private location.</label>
        <label className="text-sm">Re-enter the recovery code from your saved kit
          <textarea value={code} onChange={event => setCode(event.target.value)} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
            aria-label="Confirm saved recovery code" className="mt-2 w-full rounded bg-slate-900 p-3 font-mono text-sm" rows={3} />
        </label>
        <button disabled={!saved || code.trim() !== prepared.recoveryCode} onClick={() => { setCode(''); onDecision(true); }}
          className="rounded bg-indigo-600 px-4 py-3 disabled:opacity-40">Confirm recovery kit and open encrypted storage</button>
      </> : <>
        <p className="text-sm text-slate-300">LifeOS encrypts your records on this device using an Android Keystore key protected by strong biometrics. Continue to authenticate and create your private recovery kit. Existing local records will be verified before encrypted copies replace them.</p>
        <button onClick={() => onDecision(true)} className="rounded bg-indigo-600 px-4 py-3">Set up secure storage</button>
      </>}
      <button onClick={() => { setCode(''); onDecision(false); }} className="rounded border border-slate-600 px-4 py-3">Cancel and keep data locked</button>
    </section>
  </main>;
}
