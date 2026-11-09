import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, ShieldCheck } from 'lucide-react';
import { exportBackupFile } from '../services/backupExportService';
import { clearRecoveryCodeFromClipboard, copyRecoveryCode } from '../services/sensitiveClipboardService';
import type { PreparedRecovery } from '../services/cryptoService.ts';

/** Recovery secrets live only in this mounted dialog and native pending state. */
export default function SecureSetupDialog({ prepared, onDecision }: {
  prepared?: PreparedRecovery;
  onDecision(accepted: boolean): void;
}) {
  const [code, setCode] = useState('');
  const [kitExportState, setKitExportState] = useState<'none' | 'saved' | 'started'>('none');
  const [exportBusy, setExportBusy] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exactMatch = Boolean(prepared && code === prepared.recoveryCode);
  const kitExported = kitExportState !== 'none';

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const announce = (message: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(message);
    if (message === 'Copied') {
      feedbackTimer.current = setTimeout(() => setFeedback(''), 1800);
    }
  };

  const saveKit = async () => {
    if (!prepared || exportBusy) return;
    setExportBusy(true);
    announce('');
    try {
      const file = {
        product: 'LifeOS',
        format: 'lifeos-recovery-kit',
        version: 1,
        recoveryCode: prepared.recoveryCode,
        envelope: prepared.envelope
      };
      const result = await exportBackupFile({
        contents: JSON.stringify(file),
        fileName: `lifeos-recovery-kit-${new Date().toISOString().slice(0, 10)}.json`,
        mimeType: 'application/json'
      });
      if (result.status === 'cancelled') {
        announce('Save cancelled. Save the complete kit to continue.');
      } else if (result.status === 'saved') {
        setKitExportState('saved');
        announce('Android confirmed the file save. LifeOS cannot verify its location.');
      } else {
        setKitExportState('started');
        announce('Download started. Check it finished; LifeOS cannot verify the saved file.');
      }
    } catch {
      // Export errors can come from the file provider. Never log recovery material.
      announce('Could not save the recovery kit. Try again or choose another location.');
    } finally {
      setExportBusy(false);
    }
  };

  const copyCode = async () => {
    if (!prepared || copyBusy) return;
    setCopyBusy(true);
    announce('');
    try {
      await copyRecoveryCode(prepared.recoveryCode);
      announce('Copied');
    } catch {
      announce('Copy failed. You can select and copy the code manually.');
    } finally {
      setCopyBusy(false);
    }
  };

  const finish = async (accepted: boolean) => {
    const secret = prepared?.recoveryCode;
    setCode('');
    announce('');
    if (secret) void clearRecoveryCodeFromClipboard(secret);
    onDecision(accepted);
  };

  return <main className="lifeos-page fixed inset-0 z-[110] overflow-y-auto p-4 sm:p-6">
    <section role="dialog" aria-modal="true" aria-labelledby="secure-setup-title" className="lifeos-panel mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 rounded-3xl border p-5 shadow-xl sm:p-6">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-tint)] text-[var(--accent)]" aria-hidden="true">
        <ShieldCheck size={24} strokeWidth={1.8} />
      </div>
      <h1 id="secure-setup-title" className="text-center text-2xl font-semibold">{prepared ? 'Keep a way back' : 'Protect your local LifeOS data'}</h1>
      {prepared ? <>
        <p className="text-center text-sm leading-6 text-secondary">Save your complete recovery kit, copy its code and paste it below to confirm.</p>

        <button type="button" data-testid="save-complete-recovery-kit" onClick={() => void saveKit()} disabled={exportBusy}
          className="lifeos-raised flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60">
          {exportBusy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
          {exportBusy ? 'Opening secure save…' : kitExported ? 'Save complete recovery kit again' : 'Save complete recovery kit'}
        </button>
        <p className="-mt-2 text-xs leading-5 text-secondary">The file contains both your recovery code and encrypted key envelope. Store it somewhere safe. LifeOS cannot verify the location you choose.</p>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Your recovery code</p>
          <button type="button" data-testid="copy-recovery-code" onClick={() => void copyCode()} disabled={copyBusy}
            aria-describedby="recovery-copy-help" className="lifeos-raised group flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70">
            <span data-sensitive-recovery-code style={{ userSelect: 'text', WebkitUserSelect: 'text' }} className="break-all font-mono text-base font-semibold tracking-[0.08em] tabular-nums">{prepared.recoveryCode}</span>
            <span className="shrink-0 text-[var(--accent)]" aria-hidden="true">{feedback === 'Copied' ? <Check size={20} /> : <Copy size={18} />}</span>
          </button>
          <p id="recovery-copy-help" className="text-xs leading-5 text-secondary">Tap the code to copy it. Android hides its clipboard preview where supported.</p>
        </div>

        <label htmlFor="recovery-code-confirmation" className="space-y-2 text-sm font-medium">
          <span>Paste your recovery code to confirm.</span>
          <input id="recovery-code-confirmation" data-testid="recovery-code-confirmation" type="text" value={code}
            onChange={event => {
              const next = event.currentTarget.value;
              setCode(next);
              if (prepared && next === prepared.recoveryCode) void clearRecoveryCodeFromClipboard(prepared.recoveryCode);
            }}
            autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} inputMode="text" enterKeyHint="done"
            aria-describedby={code && !exactMatch ? 'recovery-code-mismatch' : undefined}
            className="lifeos-input min-h-12 w-full rounded-2xl px-4 py-3 font-mono text-sm tracking-wide" />
        </label>
        {code && !exactMatch && <p id="recovery-code-mismatch" role="status" className="text-xs text-[var(--danger)]">That code does not match. Check it and try again.</p>}
        {kitExported && <p role="status" className="rounded-xl bg-[var(--accent-tint)] px-3 py-2 text-xs leading-5 text-secondary">{kitExportState === 'saved' ? 'Android confirmed the complete kit file was saved. Keep it in a safe place separate from this device when possible.' : 'The download was started. Check that the complete kit file finished downloading and store it somewhere safe.'}</p>}
        <p className="text-xs leading-5 text-secondary">Copying or pasting only confirms the code. It does not prove the exported kit is stored safely.</p>
        <p data-testid="clipboard-feedback" role="status" aria-live="polite" className="min-h-5 text-center text-sm font-medium text-[var(--accent)]">{feedback}</p>
        <button type="button" data-testid="continue-to-lifeos" disabled={!kitExported || !exactMatch} onClick={() => void finish(true)}
          className="lifeos-accent-button min-h-12 rounded-2xl px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Continue to LifeOS</button>
      </> : <>
        <p className="text-sm leading-6 text-secondary">LifeOS encrypts your records on this device using an Android Keystore key protected by strong biometrics. Continue to authenticate and create your private recovery kit. Existing local records will be verified before encrypted copies replace them.</p>
        <button type="button" onClick={() => void finish(true)} className="lifeos-accent-button min-h-12 rounded-2xl px-4 py-3 font-semibold">Set up secure storage</button>
      </>}
      <button type="button" onClick={() => void finish(false)} className="lifeos-input min-h-12 rounded-2xl px-4 py-3">Cancel and keep data locked</button>
    </section>
  </main>;
}
