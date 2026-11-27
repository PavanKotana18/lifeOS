import LifeDoodle from './LifeDoodle';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { BusyDooBrand } from './BusyDooBrand';
import RecoveryProgress from './RecoveryProgress';
import { ONBOARDING_NOTIFICATIONS_STEP } from '../services/onboardingJourney';
import { Bell, ShieldCheck } from 'lucide-react';

interface Props {
  initialName: string;
  step: number;
  protectionAvailable: boolean;
  deviceCredentialOnly?: boolean;
  protectionReady: boolean;
  recoveryReady: boolean;
  recoveryContent?: ReactNode;
  notificationsSupported: boolean;
  notificationsGranted: boolean;
  notificationsEnabled: boolean;
  preciseGranted: boolean;
  onNotifications: () => Promise<void>;
  onPrecise: () => Promise<void>;
  onNotificationSettings: () => Promise<void>;
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
  const [reviewDeferral, setReviewDeferral] = useState(false);
  const [displayDeclined, setDisplayDeclined] = useState(false);
  const displayComplete = props.notificationsGranted && props.notificationsEnabled;
  const canContinueNotifications = displayComplete || displayDeclined || !props.notificationsSupported;
  const step = props.step === 1 || props.step === 2 || props.step === ONBOARDING_NOTIFICATIONS_STEP ? props.step : 0;

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
      await props.onStep(ONBOARDING_NOTIFICATIONS_STEP);
    });
  };

  return <main className="onboarding-root lifeos-page initial-setup" aria-label="BusyDoo setup">
    <div className="initial-setup-inner">
      <header className="initial-setup-header" data-launch-destination={step === 0 ? true : undefined}><BusyDooBrand className="lifeos-onboarding-brand" markClassName="lifeos-onboarding-mark" /></header>
      <section className="initial-setup-content" aria-busy={busy}>
        {step === 0 && <>
          <h1>What should we call you?</h1>
          <form onSubmit={submitName}>
            <LifeDoodle kind="welcome" />
            <label>Your name<input autoCapitalize="words" value={name} maxLength={48} autoComplete="nickname" onChange={event => setName(event.target.value)} className="lifeos-input" /></label>
            <button type="submit" disabled={busy || !name.trim()} className="lifeos-accent-button">Continue</button>
          </form>
        </>}
        {step === ONBOARDING_NOTIFICATIONS_STEP && <>
          <div className="onboarding-emblem lifeos-tint"><Bell size={24} aria-hidden="true" /></div>
          <h1>Notifications</h1>
          <div className="onboarding-checklist">
            <section className="onboarding-step">
              <h2>1. Allow notifications</h2>
              {displayComplete ? <p className="onboarding-status" role="status">Notifications allowed</p> : <>
                <p>{props.notificationsSupported ? "Get alerts for tasks, habits and milestones." : "Device notifications are unavailable here."}</p>
                {props.notificationsSupported && !displayDeclined && <div className="onboarding-step-actions">
                  <button type="button" disabled={busy} className="lifeos-accent-button" onClick={() => void run(props.onNotifications)}>Allow notifications</button>
                  {message && <button type="button" disabled={busy} className="initial-setup-secondary" onClick={() => void run(props.onNotificationSettings)}>Android notification settings</button>}
                  <button type="button" disabled={busy} className="initial-setup-secondary" onClick={() => { setMessage(""); setDisplayDeclined(true); }}>Not now</button>
                </div>}
                {displayDeclined && <p className="onboarding-status">Notifications skipped</p>}
              </>}
            </section>
            {canContinueNotifications && <section className="onboarding-step recovery-stage">
              <h2>2. Enable precise reminders</h2>
              {props.preciseGranted ? <p className="onboarding-status" role="status">Precise reminders enabled</p> : <>
                <p>{props.notificationsSupported ? "Precise access helps Android deliver reminders on time. Without it, reminders may arrive late." : "You can review reminder timing in Profile on Android."}</p>
                {props.notificationsSupported && <button type="button" disabled={busy} className="lifeos-input" onClick={() => void run(props.onPrecise)}>Enable precise reminders</button>}
              </>}
            </section>}
          </div>
          {canContinueNotifications && <button type="button" disabled={busy} className="lifeos-accent-button" onClick={() => void run(() => props.onStep(1))}>{props.preciseGranted || !props.notificationsSupported ? "Continue" : "Continue without precise reminders"}</button>}
        </>}
        {step === 1 && <>
          <div className="onboarding-emblem lifeos-tint"><ShieldCheck size={25} aria-hidden="true" /></div>
          <h1>Biometric setup</h1>
          <p className="initial-setup-description">Protect your records with a supported biometric or the screen lock you already use.</p>
          {props.protectionReady ? <><p className="onboarding-status" role="status">Device protection enabled</p><button type="button" disabled={busy} className="lifeos-accent-button" onClick={() => void run(() => props.onStep(2))}>Continue</button></> : <>
            {props.protectionAvailable && <button type="button" disabled={busy} className="lifeos-accent-button" onClick={() => void run(async () => {
              const result = await props.onProtect();
              if (!result.success) throw new Error(result.message || 'Device protection was not enabled.');
              await props.onStep(2);
            })}>{props.deviceCredentialOnly ? 'Enable device protection' : 'Enable biometrics'}</button>}
            {!props.protectionAvailable && <p className="initial-setup-note">Set up a screen lock in Android to protect and save private records.</p>}
            <button type="button" disabled={busy} className="initial-setup-secondary" onClick={() => void run(() => props.onStep(2))}>Not now</button>
          </>}
        </>}
        {step === 2 && <div className="recovery-stage">
          <RecoveryProgress step={props.recoveryReady ? 3 : props.recoveryContent ? 2 : 1} />
          <h1>Recovery setup</h1>
          {props.recoveryContent || (props.recoveryReady ? <>
            <p className="initial-setup-description" role="status">Your recovery file is saved and confirmed.</p>
            <button type="button" disabled={busy} className="lifeos-accent-button" onClick={() => void run(props.onFinish)}>Continue to Today</button>
          </> : reviewDeferral ? <>
            <p className="initial-setup-description">Without a recovery file, losing access to this device can mean losing your saved records. You can set up recovery later in Privacy &amp; Security.</p>
            <button type="button" disabled={busy} className="lifeos-accent-button" onClick={() => void run(props.onFinish)}>Do this later</button>
            {props.protectionReady && <button type="button" disabled={busy} className="initial-setup-secondary" onClick={() => setReviewDeferral(false)}>Cancel</button>}
          </> : <>
            <p className="initial-setup-description">{props.protectionReady ? 'Prepare a recovery file to regain access if you lose this device.' : 'Device protection is needed before you can prepare a recovery file.'}</p>
            <button type="button" disabled={busy} className="lifeos-accent-button" onClick={() => props.protectionReady ? void run(async () => { await props.onRecover(); }) : setReviewDeferral(true)}>{props.protectionReady ? 'Prepare recovery' : 'Review deferral'}</button>
            {props.protectionReady && <button type="button" disabled={busy} className="initial-setup-secondary" onClick={() => setReviewDeferral(true)}>Set up later</button>}
          </>)}
        </div>}
        {message && <p role="alert" className="initial-setup-error">{message}</p>}
      </section>
    </div>
  </main>;
}
