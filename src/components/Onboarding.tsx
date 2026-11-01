import { useState } from 'react';
import { Bell, Check, Fingerprint, Moon, ShieldCheck, Sun } from 'lucide-react';
import type { NotificationPreferences } from '../types';

export type AppearancePreference = 'dark' | 'light' | 'system';
type CategoryKey = keyof NotificationPreferences;

const categoryOptions: Array<[CategoryKey, string]> = [
  ['taskReminders', 'Task reminders'], ['upcomingDeadlines', 'Upcoming task deadlines'],
  ['overdueAlerts', 'Overdue task alerts'], ['habitReminders', 'Habit reminders'],
  ['milestoneReminders', 'Goal milestone reminders'],
];

interface Props {
  initialName: string;
  preferences: NotificationPreferences;
  appearance: AppearancePreference;
  initialStep: number;
  onStepChange: (step: number) => Promise<void>;
  onSaveIdentity: (name: string) => Promise<void>;
  onEnableBiometric: () => Promise<{ success: boolean; message?: string }>;
  onSkipBiometric: () => void;
  onAppearance: (preference: AppearancePreference) => Promise<void>;
  onEnableNotifications: (selected: NotificationPreferences) => Promise<{ granted: boolean; status: string; message?: string }>;
  onSkipNotifications: () => Promise<void>;
  onOpenNotificationSettings: () => Promise<void>;
  onFinish: () => Promise<void>;
}

export default function Onboarding(props: Props) {
  const [step, setStep] = useState(Math.max(0, Math.min(4, props.initialStep)));
  const [name, setName] = useState(props.initialName);
  const [selected, setSelected] = useState(props.preferences);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const advance = async (action: () => Promise<void>, next: number) => {
    setBusy(true); setMessage('');
    try { await action(); await props.onStepChange(next); setStep(next); } catch (error) { setMessage(error instanceof Error ? error.message : 'That action could not be completed.'); }
    finally { setBusy(false); }
  };

  return <div className="onboarding-root fixed inset-0 z-[70] overflow-y-auto bg-[#090d16] px-5 py-[max(1.25rem,env(safe-area-inset-top))] text-white" role="dialog" aria-modal="true" aria-label="LifeOS onboarding">
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center py-5">
      <div className="mb-8 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 font-black">L</div><div><div className="font-bold tracking-tight">LifeOS</div><div className="text-[11px] text-slate-400">A little more in sync, every day</div></div></div>
      <div className="mb-6 flex gap-1.5" aria-label={`Step ${step + 1} of 5`}>{Array.from({ length: 5 }, (_, index) => <span key={index} className={`h-1 flex-1 rounded-full ${index <= step ? 'bg-indigo-400' : 'bg-slate-800'}`} />)}</div>
      <div key={step} className="onboarding-step">
        {step === 0 && <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-indigo-300">A personal start</p><h1 className="text-3xl font-bold tracking-tight">Hey, what shall I call you?</h1><p className="mt-3 text-sm leading-6 text-slate-400">Your name stays on this device and helps make LifeOS feel like yours.</p>
          <label className="mt-8 block text-xs font-medium text-slate-300">Your name<input autoFocus value={name} maxLength={48} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && name.trim()) void advance(() => props.onSaveIdentity(name.trim()), 1); }} placeholder="Type your name" className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-base text-white outline-none focus:border-indigo-400" /></label>
          <button disabled={!name.trim() || busy} onClick={() => void advance(() => props.onSaveIdentity(name.trim()), 1)} className="mt-5 min-h-12 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold disabled:opacity-40">Continue</button>
        </section>}
        {step === 1 && <section>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300"><Fingerprint /></div><h1 className="text-3xl font-bold tracking-tight">Let's secure your LifeOS.</h1><p className="mt-3 text-sm leading-6 text-slate-400">LifeOS can use Android fingerprint or your device screen lock when you choose to protect the app. Your biometric data never enters LifeOS.</p>
          {message && <p role="status" className="mt-4 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">{message}</p>}
          <button disabled={busy} onClick={async () => { setBusy(true); setMessage(''); try { const result = await props.onEnableBiometric(); if (result.success) { await props.onStepChange(2); setStep(2); } else setMessage(result.message || 'Authentication was not completed. You can try again or skip for now.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Authentication could not be completed.'); } finally { setBusy(false); } }} className="mt-7 min-h-12 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold disabled:opacity-50">Enable Biometric</button>
          <button disabled={busy} onClick={() => void advance(async () => props.onSkipBiometric(), 2)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 px-4 text-sm font-medium text-slate-300">Skip for now</button>
        </section>}
        {step === 2 && <section>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300"><Sun /></div><h1 className="text-3xl font-bold tracking-tight">Choose your experience.</h1><p className="mt-3 text-sm leading-6 text-slate-400">Pick a look that feels comfortable. You can change it anytime in Profile.</p>
          <div className="mt-7 space-y-2">{([['dark', 'Dark theme', Moon], ['light', 'Light theme', Sun], ['system', 'Follow system theme', Check]] as const).map(([value, label, Icon]) => <button key={value} onClick={() => void props.onAppearance(value)} aria-pressed={props.appearance === value} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left text-sm ${props.appearance === value ? 'border-indigo-400 bg-indigo-500/10 text-white' : 'border-slate-800 bg-slate-900 text-slate-300'}`}><Icon size={18} /><span className="flex-1">{label}</span>{props.appearance === value && <Check size={17} className="text-indigo-300" />}</button>)}</div>
          <button onClick={() => void advance(async () => {}, 3)} className="mt-5 min-h-12 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold">Continue</button>
        </section>}
        {step === 3 && <section>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300"><Bell /></div><h1 className="text-3xl font-bold tracking-tight">Stay on top of what matters.</h1><p className="mt-3 text-sm leading-6 text-slate-400">Choose the reminders you want. Android notification permission is needed so LifeOS can show them, even when the app is closed.</p>
          <div className="mt-5 space-y-1 rounded-2xl border border-slate-800 bg-slate-900 p-3">{categoryOptions.map(([key, label]) => <label key={key} className="flex min-h-11 items-center justify-between gap-3 border-b border-slate-800/80 px-1 last:border-0"><span className="text-xs text-slate-200">{label}</span><input type="checkbox" checked={selected[key]} onChange={event => setSelected(previous => ({ ...previous, [key]: event.target.checked }))} className="h-5 w-5 accent-indigo-500" /></label>)}</div>
          {message && <div role="status" className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">{message}<button onClick={() => void props.onOpenNotificationSettings()} className="ml-2 font-semibold underline">Open notification settings</button></div>}
          <button disabled={busy || !Object.values(selected).some(Boolean)} onClick={async () => { setBusy(true); setMessage(''); try { const result = await props.onEnableNotifications(selected); if (result.granted) { await props.onStepChange(4); setStep(4); } else setMessage(result.message || `Android notification permission: ${result.status}. You can continue and enable it later in Profile.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Notification permission could not be checked.'); } finally { setBusy(false); } }} className="mt-5 min-h-12 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold disabled:opacity-40">Enable selected notifications</button>
          <button disabled={busy} onClick={() => void advance(props.onSkipNotifications, 4)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 px-4 text-sm font-medium text-slate-300">Continue without notifications</button>
        </section>}
        {step === 4 && <section className="onboarding-complete text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-300"><ShieldCheck size={32} /></div><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-emerald-300">Ready when you are</p><h1 className="text-3xl font-bold tracking-tight">You're all set, {name.trim()}!</h1><p className="mt-3 text-sm leading-6 text-slate-400">Your plans, goals and routines are ready for their first day together.</p>
          <button disabled={busy} onClick={() => { setBusy(true); void props.onFinish().catch(error => setMessage(error instanceof Error ? error.message : 'LifeOS could not finish setup.')).finally(() => setBusy(false)); }} className="mt-8 min-h-12 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold">Go to my dashboard</button>
        </section>}
      </div>
    </div>
  </div>;
}
