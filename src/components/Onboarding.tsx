import { useRef, useState, type FormEvent } from 'react';
import { LifeOSBrand } from './LifeOSBrand';

interface Props {
  initialName: string;
  step: number;
  protectionAvailable: boolean;
  protectionReady: boolean;
  recoveryReady: boolean;
  onSaveIdentity: (name: string) => Promise<void>;
  onStep: (step: number) => Promise<void>;
  onProtect: () => Promise<{ success: boolean; message?: string }>;
  onRecover: () => Promise<boolean>;
  onFinish: () => Promise<void>;
}

export default function Onboarding(props: Props) {
  const [name, setName] = useState(props.initialName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const step = props.step === 1 || props.step === 2 ? props.step : 0;

  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Setup could not finish. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  };

  const submitName = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) void run(async () => {
      await props.onSaveIdentity(name.trim());
      await props.onStep(1);
    });
  };

  return <main className="onboarding-root lifeos-page initial-setup" aria-label="LifeOS setup">
    <div className="initial-setup-inner">
      <header className="initial-setup-header"><LifeOSBrand className="lifeos-onboarding-brand" markClassName="lifeos-onboarding-mark" /></header>
      <section className="initial-setup-content" aria-busy={busy}>
        {step === 0 && <>
          <h1>What should we call you?</h1>
          <form onSubmit={submitName}>
            <label>Your name<input autoCapitalize="words" value={name} maxLength={48} autoComplete="nickname" onChange={event => setName(event.target.value)} className="lifeos-input" /></label>
            <button type="submit" disabled={busy || !name.trim()} className="lifeos-accent-button">Continue</button>
          </form>
        </>}
        {step === 1 && <>
          <h1>Biometric setup</h1>
          <p className="initial-setup-description">Protect your records with biometrics or your device PIN.</p>
          {props.protectionReady ? <button type="button" disabled={busy} className="lifeos-accent-button" onClick={() => void run(() => props.onStep(2))}>Continue</button> : <>
            {props.protectionAvailable && <button type="button" disabled={busy} className="lifeos-accent-button" onClick={() => void run(async () => {
              const result = await props.onProtect();
              if (!result.success) throw new Error(result.message || 'Device protection was not enabled.');
              await props.onStep(2);
            })}>Enable biometrics</button>}
            {!props.protectionAvailable && <p className="initial-setup-note">Set up a screen lock in Android to protect and save private records.</p>}
            <button type="button" disabled={busy} className="initial-setup-secondary" onClick={() => void run(() => props.onStep(2))}>Not now</button>
          </>}
        </>}
        {step === 2 && <>
          <h1>Recovery setup</h1>
          <p className="initial-setup-description">{props.recoveryReady ? 'Your recovery kit is set up.' : props.protectionReady ? 'Without a recovery file, losing access to this device can mean losing your encrypted records.' : 'You can set up a recovery kit once device protection is enabled. LifeOS requires protection before saving private records.'}</p>
          {props.protectionReady && !props.recoveryReady && <button type="button" disabled={busy} className="lifeos-accent-button" onClick={() => void run(async () => {
            if (await props.onRecover()) await props.onFinish();
          })}>Save recovery file</button>}
          <button type="button" disabled={busy} className={props.protectionReady && !props.recoveryReady ? 'initial-setup-secondary' : 'lifeos-accent-button'} onClick={() => void run(props.onFinish)}>{props.recoveryReady ? 'Continue' : 'Do this later'}</button>
        </>}
        {message && <p role="alert" className="initial-setup-error">{message}</p>}
      </section>
    </div>
  </main>;
}
