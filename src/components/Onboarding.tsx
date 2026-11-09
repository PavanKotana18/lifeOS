import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Fingerprint, KeyRound, ShieldCheck, Sprout } from 'lucide-react';
import { LifeOSBrand } from './LifeOSBrand';
import { INITIAL_ONBOARDING_JOURNEY, type OnboardingJourney } from '../services/onboardingJourney';

interface Props {
  initialName: string;
  initialJourney?: OnboardingJourney;
  onSaveIdentity: (name: string) => Promise<void>;
  onSaveJourney?: (journey: OnboardingJourney) => Promise<void>;
  onProvisionProtection: () => Promise<{ success: boolean; message?: string }>;
  onConfirmRecovery: (label: string) => Promise<boolean>;
  onFinish: () => Promise<void>;
}

/** Required new-user setup. Secret material is handled by the native secure-kit dialog, never stored in this component. */
export default function Onboarding({ initialName, initialJourney = INITIAL_ONBOARDING_JOURNEY, onSaveIdentity, onSaveJourney, onProvisionProtection, onConfirmRecovery, onFinish }: Props) {
  const [journey, setJourney] = useState(initialJourney);
  const [name, setName] = useState(initialName);
  const [recoveryLabel, setRecoveryLabel] = useState(initialJourney.recoveryName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const step = journey.stage === 'name' ? 1 : journey.stage === 'protection' ? 2 : 3;

  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Setup could not be completed. Your data is still protected. Please retry.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const advance = async (next: OnboardingJourney) => {
    await onSaveJourney?.(next);
    setJourney(next);
    requestAnimationFrame(() => heading.current?.focus());
  };
  const saveName = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    void run(async () => {
      await onSaveIdentity(name.trim());
      await advance({ ...journey, stage: 'protection' });
    });
  };
  const protect = () => void run(async () => {
    const result = await onProvisionProtection();
    if (!result.success) throw new Error(result.message || 'LifeOS could not verify secure protection. Please try again.');
    await advance({ ...journey, protection: 'enabled', recovery: 'pending', stage: 'recovery' });
  });
  const finish = () => void run(async () => {
    const label = recoveryLabel.trim().slice(0, 64);
    if (!(await onConfirmRecovery(label))) return;
    await advance({ ...journey, protection: 'enabled', recovery: 'confirmed', recoveryName: label, stage: 'recovery' });
    await onFinish();
  });

  return <main className="onboarding-root lifeos-page initial-setup" aria-label={step === 1 ? 'Welcome to LifeOS' : step === 2 ? 'Protect your LifeOS space' : 'Set up your recovery kit'}>
    <div className="initial-setup-inner">
      <header className="initial-setup-header"><LifeOSBrand className="lifeos-onboarding-brand" markClassName="lifeos-onboarding-mark" /><span className="initial-setup-count" aria-label={`Step ${step} of 3`}>{step} / 3</span></header>
      <ol className="initial-setup-progress" aria-label="Required setup steps">{['Your name', 'App protection', 'Recovery kit'].map((label, i) => <li key={label} aria-current={i === step - 1 ? 'step' : undefined} data-complete={i < step - 1}><span aria-hidden="true">{i < step - 1 ? <Check size={13} /> : i + 1}</span>{label}</li>)}</ol>
      <section className="initial-setup-content" key={journey.stage}>
        {step > 1 && <div className="initial-setup-illustration" aria-hidden="true">{step === 2 ? <Fingerprint strokeWidth={1.15} /> : <KeyRound strokeWidth={1.15} />}<span>{step === 2 ? <ShieldCheck size={21} /> : <Sprout size={21} />}</span></div>}
        <p className="initial-setup-eyebrow">{step === 1 ? 'A personal start' : step === 2 ? 'A private space' : 'A way back'}</p>
        <h1 ref={heading} tabIndex={-1}>{step === 1 ? 'Welcome. What should we call you?' : step === 2 ? 'Your space. Just yours.' : 'Keep a way back.'}</h1>
        <p className="initial-setup-description">{step === 1 ? 'Choose the name we’ll use to welcome you. You can change it any time.' : step === 2 ? 'Keep your personal information protected with a secure way to unlock LifeOS.' : 'Your recovery kit helps you regain access if your usual unlock method becomes unavailable.'}</p>
        {step === 1 ? <form onSubmit={saveName}>
          <label>Your name<input autoFocus autoCapitalize="words" value={name} maxLength={48} autoComplete="nickname" onChange={e => setName(e.target.value)} placeholder="Name" className="lifeos-input" /></label>
          <button type="submit" disabled={!name.trim() || busy} className="lifeos-accent-button">{busy ? 'Saving…' : 'Continue'}<ArrowRight size={18} aria-hidden="true" /></button>
        </form> : step === 2 ? <div className="initial-setup-actions">
          <div className="initial-setup-note"><p>LifeOS uses Android’s secure unlock and encrypts your records on this device.</p><p className="mt-2">Use an enrolled strong biometric or your phone’s secure screen lock. No custom LifeOS PIN is created.</p></div>
          <button type="button" disabled={busy} onClick={protect} className="lifeos-accent-button">{busy ? 'Securing your space…' : 'Continue with secure unlock'}<ArrowRight size={18} aria-hidden="true" /></button>
        </div> : <form onSubmit={e => { e.preventDefault(); finish(); }}>
          <label>Recovery name <span className="text-secondary">(optional)</span><input autoCapitalize="words" autoComplete="off" value={recoveryLabel} maxLength={64} onChange={e => setRecoveryLabel(e.target.value)} placeholder="My LifeOS recovery" className="lifeos-input" /></label>
          <p className="initial-setup-note">This is only a label. LifeOS will create a real recovery kit and ask you to confirm that you saved it. Without a kit, device loss may make encrypted records unrecoverable.</p>
          <button type="submit" disabled={busy} className="lifeos-accent-button">{busy ? 'Preparing recovery kit…' : 'Create and save recovery kit'}<ArrowRight size={18} aria-hidden="true" /></button>
        </form>}
        {message && <p role="alert" className="initial-setup-error">{message}</p>}
      </section>
      <footer className="initial-setup-footer">Your private workspace opens after protection and recovery are verified.</footer>
    </div>
  </main>;
}
