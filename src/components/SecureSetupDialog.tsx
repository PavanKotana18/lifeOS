import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, ShieldCheck } from 'lucide-react';
import { exportBackupFile } from '../services/backupExportService';
import { clearRecoveryCodeFromClipboard, copyRecoveryCode } from '../services/sensitiveClipboardService';
import { matchesRecoveryCode } from '../services/recoveryCodeConfirmation';
import RecoveryProgress from './RecoveryProgress';
import type { PreparedRecovery } from '../services/cryptoService.ts';

/** Recovery secrets live only in this mounted dialog and native pending state. */
export default function SecureSetupDialog({ inline = false, premium = false, cancelLabel, prepared, onDecision, onRecoveryExportStart, recoveryExportResumeReady = true, onRetryRecoveryExportResume }: {
  inline?: boolean;
  premium?: boolean;
  cancelLabel?: string;
  prepared?: PreparedRecovery;
  onDecision(accepted: boolean): void;
  onRecoveryExportStart?: () => () => void;
  recoveryExportResumeReady?: boolean;
  onRetryRecoveryExportResume?: () => void;
}) {
  const [code, setCode] = useState('');
  const [kitExportState, setKitExportState] = useState<'none' | 'saved' | 'started'>('none');
  const [exportBusy, setExportBusy] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // React state updates are asynchronous. A ref closes the rapid-tap window
  // before Android's document picker (or a test adapter) returns control.
  const exportInFlight = useRef(false);
  const exactMatch = Boolean(prepared && matchesRecoveryCode(code, prepared.recoveryCode));
  // Only the native file provider's completed write is proof of an exported kit.
  // A browser download click is merely an initiation and cannot be confirmed.
  const kitExported = kitExportState === 'saved';

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const finish = (accepted: boolean) => {
    const secret = prepared?.recoveryCode;
    setCode('');
    setFeedback('');
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (secret) void clearRecoveryCodeFromClipboard(secret);
    onDecision(accepted);
  };

  if (prepared && !recoveryExportResumeReady) return <main className={premium ? "profile-design profile-overlay" : "lifeos-page fixed inset-0 z-[110] overflow-y-auto p-4 sm:p-6"}>
    <section role="dialog" aria-modal="true" aria-labelledby="secure-setup-locked-title" className={premium ? "profile-protected-form" : "lifeos-panel mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 rounded-3xl border p-5 shadow-xl sm:p-6"}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-tint)] text-[var(--accent)]" aria-hidden="true"><ShieldCheck size={24} strokeWidth={1.8} /></div>
      <h1 id="secure-setup-locked-title" className="text-center text-2xl font-semibold">Unlock to continue</h1>
      <p className="text-center text-sm leading-6 text-secondary">{exportBusy ? 'Choose where to save your recovery file. Your recovery code stays hidden while you save it.' : 'Unlock BusyDoo to see your recovery code again.'}</p>
      {!exportBusy && onRetryRecoveryExportResume && <button type="button" onClick={onRetryRecoveryExportResume} className="lifeos-accent-button min-h-12 rounded-2xl px-4 py-3 font-semibold">Unlock and continue</button>}
      <button type="button" data-profile-protected-close={!inline || undefined} disabled={exportBusy} onClick={() => void finish(false)} className="lifeos-input min-h-12 rounded-2xl px-4 py-3 disabled:opacity-60">{cancelLabel || 'Cancel and keep data locked'}</button>
    </section>
  </main>;

  const announce = (message: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(message);
    if (message === 'Copied') {
      feedbackTimer.current = setTimeout(() => setFeedback(''), 1800);
    }
  };

  const saveKit = async () => {
    if (!prepared || exportInFlight.current) return;
    exportInFlight.current = true;
    setExportBusy(true);
    announce('');
    const releaseExportActivity = onRecoveryExportStart?.();
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
        mimeType: 'application/json',
        preservePendingRecovery: true
      });
      if (result.status === 'cancelled') {
        announce('Save cancelled. You can choose a file location again.');
      } else if (result.status === 'saved') {
        setKitExportState('saved');
        announce('Android confirmed the file save. BusyDoo cannot verify its location.');
      } else {
        setKitExportState(current => current === 'saved' ? current : 'started');
        announce('Download started, but BusyDoo cannot confirm it finished. Save the recovery file through Android to continue.');
      }
    } catch {
      // Export errors can come from the file provider. Never log recovery material.
      announce('Could not save the recovery kit. Try again or choose another location.');
    } finally {
      releaseExportActivity?.();
      exportInFlight.current = false;
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

  const content = <section role={inline ? undefined : "dialog"} aria-modal={inline ? undefined : true} aria-labelledby={inline ? undefined : "secure-setup-title"} className={inline ? "onboarding-step recovery-stage mt-4" : premium ? "profile-protected-form" : "lifeos-panel mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 rounded-3xl border p-5 shadow-xl sm:p-6"}>
      {!inline && <>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-tint)] text-[var(--accent)]" aria-hidden="true">
        <ShieldCheck size={24} strokeWidth={1.8} />
      </div>
      <p className="text-sm text-secondary">Keep your recovery file private. You may need it to open your records again.</p>
      <h1 id="secure-setup-title" className="text-center text-2xl font-semibold">{prepared ? 'Recovery setup' : 'Protect your local BusyDoo data'}</h1>
      </>}
      {prepared ? <>
        {!inline && <RecoveryProgress profile={premium} labels={premium ? ['Prepare', 'Save file', 'Confirm code'] : undefined} step={kitExported ? 3 : 2} />}
        {!kitExported ? <div className="recovery-stage space-y-3">
          <p className="text-sm text-secondary">Save your recovery file somewhere you can access if you lose this device.</p>
          <button type="button" data-testid="save-complete-recovery-kit" onClick={() => void saveKit()} disabled={exportBusy}
            className="lifeos-accent-button flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-60">
            <Download size={18} aria-hidden="true" />{exportBusy ? 'Saving recovery file…' : 'Save recovery file'}
          </button>
        </div> : <div className="recovery-stage space-y-4">
        <p role="status" className="text-sm font-medium">Recovery file saved. Confirm its code to finish.</p>
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
              if (prepared && matchesRecoveryCode(next, prepared.recoveryCode)) void clearRecoveryCodeFromClipboard(prepared.recoveryCode);
            }}
            autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} inputMode="text" enterKeyHint="done"
            aria-describedby={code && !exactMatch ? 'recovery-code-mismatch' : undefined}
            className="lifeos-input min-h-12 w-full rounded-2xl px-4 py-3 font-mono text-sm tracking-wide" />
        </label>
        {code && !exactMatch && <p id="recovery-code-mismatch" role="status" className="text-xs text-[var(--danger)]">That code does not match. Check it and try again.</p>}
        {exactMatch && <p role="status" className="text-xs font-medium text-[var(--accent)]">Recovery code confirmed.</p>}
        <button type="button" data-testid="continue-to-lifeos" disabled={!kitExported || !exactMatch || !recoveryExportResumeReady} onClick={() => void finish(true)}
          className="lifeos-accent-button min-h-12 rounded-2xl px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Confirm recovery file</button>
        </div>}
        <p data-testid="clipboard-feedback" role="status" aria-live="polite" className="min-h-5 text-center text-sm font-medium text-[var(--accent)]">{feedback}</p>

      </> : <>
        <p className="text-sm leading-6 text-secondary">BusyDoo encrypts your records on this device using an Android Keystore key protected by strong biometrics. Continue to authenticate and create your private recovery kit. Existing local records will be verified before encrypted copies replace them.</p>
        <button type="button" onClick={() => void finish(true)} className="lifeos-accent-button min-h-12 rounded-2xl px-4 py-3 font-semibold">Set up secure storage</button>
      </>}
      <button type="button" data-profile-protected-close={!inline || undefined} disabled={exportBusy} onClick={() => void finish(false)} className="lifeos-input min-h-12 rounded-2xl px-4 py-3 disabled:opacity-60">{inline ? 'Cancel recovery setup' : (premium ? 'Cancel recovery setup' : 'Cancel and keep data locked')}</button>
    </section>;
  return inline ? content : <main className={premium ? "profile-design profile-overlay" : "lifeos-page fixed inset-0 z-[110] overflow-y-auto p-4 sm:p-6"}>{content}</main>;
}
