import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { LifeOSBrand } from './LifeOSBrand';
import type { OnboardingJourney } from '../services/onboardingJourney';

interface Props {
  initialName: string;
  initialJourney?: OnboardingJourney;
  onSaveIdentity: (name: string) => Promise<void>;
  onSaveJourney?: (journey: OnboardingJourney) => Promise<void>;
  onProvisionProtection: () => Promise<{ success: boolean; message?: string }>;
  onConfirmRecovery: (label: string) => Promise<boolean>;
  onFinish: () => Promise<void>;
}

/** Welcome and identity only. Device protection is offered contextually before the first private save. */
export default function Onboarding({ initialName, onSaveIdentity, onFinish }: Props) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef(false);

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized || pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage('');
    void (async () => {
      try {
        await onSaveIdentity(normalized);
        await onFinish();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'LifeOS could not finish setup. Your records remain protected. Please retry.');
      } finally {
        pending.current = false;
        setBusy(false);
      }
    })();
  };

  return <main className="onboarding-root lifeos-page initial-setup" aria-label="Welcome to LifeOS">
    <div className="initial-setup-inner">
      <header className="initial-setup-header"><LifeOSBrand className="lifeos-onboarding-brand" markClassName="lifeos-onboarding-mark" /><span className="initial-setup-count">Welcome</span></header>
      <section className="initial-setup-content">
        <p className="initial-setup-eyebrow">A personal start</p>
        <h1>Welcome. What should we call you?</h1>
        <p className="initial-setup-description">Choose the name we’ll use to welcome you. You can change it any time.</p>
        <form onSubmit={saveName}>
          <label>Your name<input autoFocus autoCapitalize="words" value={name} maxLength={48} autoComplete="nickname" onChange={event => setName(event.target.value)} placeholder="Name" className="lifeos-input" /></label>
          <button type="submit" disabled={!name.trim() || busy} className="lifeos-accent-button">{busy ? 'Opening your space…' : 'Continue'}<ArrowRight size={18} aria-hidden="true" /></button>
        </form>
        <p className="mt-4 text-xs leading-5 text-secondary">Your records are encrypted before the first private save. You can set up recovery later in Settings.</p>
        {message && <p role="alert" className="initial-setup-error">{message}</p>}
      </section>
      <footer className="initial-setup-footer">Your space stays on this device.</footer>
    </div>
  </main>;
}
