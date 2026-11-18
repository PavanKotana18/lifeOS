import { useState, type FormEvent } from 'react';
import { LifeOSBrand } from './LifeOSBrand';

interface Props {
  initialName: string;
  onSaveIdentity: (name: string) => Promise<void>;
  onFinish: () => Promise<void>;
}

/** A calm, one-step welcome; security and notification choices stay contextual. */
export default function Onboarding({ initialName, onSaveIdentity, onFinish }: Props) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const openLifeOS = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await onSaveIdentity(trimmed);
      await onFinish();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'LifeOS could not finish opening. Your information remains on this screen.');
    } finally {
      setBusy(false);
    }
  };
  return <main className="onboarding-root lifeos-page fixed inset-0 z-[70] overflow-y-auto px-5 py-[max(1.25rem,env(safe-area-inset-top))]" aria-label="Welcome to LifeOS">
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center py-8">
      <div className="mb-10"><LifeOSBrand className="lifeos-onboarding-brand" markClassName="lifeos-onboarding-mark" /><p className="ml-[3.75rem] -mt-1 text-[11px] text-secondary">A little more in sync, every day</p></div>
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] lifeos-accent-text">A personal start</p>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome. What should we call you?</h1>
        <p className="mt-3 text-sm leading-6 text-secondary">Choose a name for your greetings. You can explore LifeOS before setting up reminders or device protection.</p>
        <form onSubmit={event => { void openLifeOS(event); }}>
          <label className="mt-8 block text-xs font-medium text-secondary">Your name
            <input autoCapitalize="words" value={name} maxLength={48} autoComplete="nickname" onChange={event => setName(event.target.value)} placeholder="Name" className="lifeos-input mt-2 min-h-12 w-full rounded-xl px-4 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-color)]" />
          </label>
          {message && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{message}</p>}
          <button type="submit" disabled={!name.trim() || busy} className="lifeos-accent-button mt-5 min-h-12 w-full rounded-xl px-4 text-sm font-semibold disabled:opacity-50">{busy ? 'Opening LifeOS…' : 'Open LifeOS'}</button>
        </form>
      </section>
    </div>
  </main>;
}
