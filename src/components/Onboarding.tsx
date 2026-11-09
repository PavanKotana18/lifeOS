import { useRef, useState, type FormEvent } from 'react';
import { Fingerprint, Sprout, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { LifeOSBrand } from './LifeOSBrand';
import { INITIAL_ONBOARDING_JOURNEY, type OnboardingJourney } from '../services/onboardingJourney';

interface Props {
  initialName: string;
  initialJourney?: OnboardingJourney;
  onSaveIdentity: (name: string) => Promise<void>;
  onSaveJourney?: (journey: OnboardingJourney) => Promise<void>;
  onEnableProtection?: () => Promise<{ success: boolean; message?: string }>;
  onFinish: () => Promise<void>;
}

/** Optional protection and a non-secret recovery label; neither provisions storage. */
export default function Onboarding({ initialName, initialJourney = INITIAL_ONBOARDING_JOURNEY, onSaveIdentity, onSaveJourney, onEnableProtection, onFinish }: Props) {
  const [journey, setJourney] = useState(initialJourney);
  const [name, setName] = useState(initialName);
  const [recoveryName, setRecoveryName] = useState(initialJourney.recoveryName);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState('');
  const step = journey.stage === 'name' ? 1 : journey.stage === 'protection' ? 2 : 3;
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Your progress could not be saved. Please try again.'); }
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
  const protection = (enable: boolean) => void run(async () => {
    if (enable) {
      const result = await onEnableProtection?.();
      if (!result?.success) { setMessage(result?.message || 'Secure unlock is unavailable here. You can continue without the optional app lock.'); return; }
    }
    await advance({ ...journey, protection: enable ? 'enabled' : 'skipped', stage: 'recovery' });
  });
  const finish = (named: boolean) => void run(async () => {
    if (named && !recoveryName.trim()) return;
    await advance({ ...journey, recovery: named ? 'named' : 'skipped', recoveryName: named ? recoveryName.trim() : '' });
    await onFinish();
  });
  return <main className="onboarding-root lifeos-page initial-setup" aria-label={step === 1 ? 'Welcome to LifeOS' : step === 2 ? 'Set up app protection' : 'Name your recovery setup'}>
    <div className="initial-setup-inner">
      <header className="initial-setup-header"><LifeOSBrand className="lifeos-onboarding-brand" markClassName="lifeos-onboarding-mark" /><span className="initial-setup-count" aria-label={`Step ${step} of 3`}>{step} / 3</span></header>
      <ol className="initial-setup-progress" aria-label="Your personal setup">{['Welcome', 'Protection', 'Recovery name'].map((label, i) => <li key={label} aria-current={i === step - 1 ? 'step' : undefined} data-complete={i < step - 1}><span aria-hidden="true">{i < step - 1 ? <Check size={13} /> : i + 1}</span>{label}</li>)}</ol>
      <section className="initial-setup-content" key={journey.stage}>
        {step > 1 && <div className="initial-setup-illustration" aria-hidden="true">{step === 2 ? <Fingerprint strokeWidth={1.15} /> : <Sprout strokeWidth={1.15} />}<span>{step === 2 ? <ShieldCheck size={21} /> : <Check size={21} />}</span></div>}
        <p className="initial-setup-eyebrow">{step === 1 ? 'A personal start' : step === 2 ? 'Your space, your choice' : 'A familiar signpost'}</p>
        <h1 ref={heading} tabIndex={-1}>{step === 1 ? 'Welcome. What should we call you?' : step === 2 ? 'A little privacy, just for you.' : 'A name to help you find your way back.'}</h1>
        <p className="initial-setup-description">{step === 1 ? 'Choose a name for your greetings. A little more in sync, every day.' : step === 2 ? "Keep your personal space protected with your phone’s secure unlock." : "Choose a name you’ll recognize if you ever need to identify your recovery setup."}</p>
        {step === 1 ? <form onSubmit={saveName}>
          <label>Your name<input autoCapitalize="words" value={name} maxLength={48} autoComplete="nickname" onChange={e => setName(e.target.value)} placeholder="Name" className="lifeos-input" /></label>
          <button type="submit" disabled={!name.trim() || busy} className="lifeos-accent-button">{busy ? 'Saving…' : 'Continue'}<ArrowRight size={18} aria-hidden="true" /></button>
        </form> : step === 2 ? <div className="initial-setup-actions">
          <p className="initial-setup-note">Optional. Use your fingerprint or device screen lock. You can change this later in Privacy &amp; Security.</p>
          <button type="button" disabled={busy} onClick={() => protection(true)} className="lifeos-accent-button">{busy ? 'Please wait…' : 'Set up protection'}<ArrowRight size={18} aria-hidden="true" /></button>
          <button type="button" disabled={busy} onClick={() => protection(false)} className="initial-setup-secondary">Not now</button>
        </div> : <form onSubmit={e => { e.preventDefault(); finish(true); }}>
          <label>Recovery name<input autoCapitalize="words" autoComplete="off" aria-describedby="recovery-name-note" value={recoveryName} maxLength={64} onChange={e => setRecoveryName(e.target.value)} placeholder="My personal space" className="lifeos-input" /></label>
          <p id="recovery-name-note" className="initial-setup-note">This is a non-secret identifier, not a password or recovery secret. The name alone cannot restore your data. A separate recovery kit can be set up later in Privacy &amp; Security.</p>
          <button type="submit" disabled={!recoveryName.trim() || busy} className="lifeos-accent-button">{busy ? 'Opening LifeOS…' : 'Continue'}<ArrowRight size={18} aria-hidden="true" /></button>
          <button type="button" disabled={busy} onClick={() => finish(false)} className="initial-setup-secondary">Set this up later</button>
        </form>}
        {message && <p role="alert" className="initial-setup-error">{message}</p>}
      </section>
      <footer className="initial-setup-footer">Your records stay on your device. Private saves still require secure encrypted storage.</footer>
    </div>
  </main>;
}
