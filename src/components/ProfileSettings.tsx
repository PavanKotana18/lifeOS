import { useState, type ReactNode } from 'react';
import { Bell, ChevronLeft, Palette, SlidersHorizontal, Shield, UserRound, Database, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ProfileSection = 'home' | 'appearance' | 'preferences' | 'notifications' | 'privacy' | 'data' | 'about' | 'developer' | 'themes' | 'accent' | 'motion' | 'app-lock' | 'recovery' | 'licenses';

export function profileParent(section: ProfileSection): ProfileSection {
  if (section === 'themes' || section === 'accent' || section === 'motion') return 'appearance';
  if (section === 'app-lock' || section === 'recovery') return 'privacy';
  if (section === 'licenses') return 'about';
  return 'home';
}

export function ProfileSettingRow({ title, value, onClick }: { title: string; value?: string; onClick: () => void }) {
  return <button type="button" className="preference-row" onClick={onClick}><span>{title}</span>{value && <span className="text-secondary text-right">{value}</span>}</button>;
}

const profileLinks = [
  { section: 'appearance', title: 'Appearance', detail: 'Theme, color and display mode', Icon: Palette },
  { section: 'preferences', title: 'Preferences', detail: 'Currency, dates, time and units', Icon: SlidersHorizontal },
  { section: 'notifications', title: 'Notifications', detail: 'Choose which reminders LifeOS sends', Icon: Bell },
  { section: 'privacy', title: 'Privacy & Security', detail: 'App lock and recovery status', Icon: Shield },
  { section: 'data', title: 'Backup & Restore', detail: 'Encrypted backup and local records', Icon: Database },
  { section: 'about', title: 'About', detail: 'Version and privacy information', Icon: Info },
] as const;

export function ProfileIdentityCard({ name, initial, onChange }: { name: string; initial: string; onChange: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <section className="preference-group p-3" aria-labelledby="profile-identity-title">
    <div className="flex items-center gap-3">
      <div className="profile-avatar lifeos-tint lifeos-accent-text flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-semibold" aria-hidden="true">{initial || <UserRound size={21} />}</div>
      <h2 id="profile-identity-title" className="min-w-0 flex-1 truncate text-base font-semibold">{name.trim() || 'Your profile'}</h2>
      {!editing && <button type="button" className="min-h-11 text-sm lifeos-accent-text" onClick={() => { setDraft(name); setEditing(true); }}>Edit name</button>}
    </div>
    {editing && <form className="mt-3 space-y-2" onSubmit={async event => {
      event.preventDefault();
      if (!draft.trim() || busy) return;
      setBusy(true); setError('');
      try { await onChange(draft); setEditing(false); }
      catch { setError('Could not save your name.'); }
      finally { setBusy(false); }
    }}><label className="block text-sm font-medium">Display name<input autoFocus required maxLength={48} value={draft} onChange={event => setDraft(event.target.value)} className="lifeos-input mt-1 min-h-11 w-full rounded-xl px-3" /></label>
      {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={busy} className="min-h-11 px-3" onClick={() => { setEditing(false); setError(''); }}>Cancel</button><button type="submit" disabled={busy || !draft.trim()} className="lifeos-accent-button min-h-11 rounded-xl px-3">Save name</button></div>
    </form>}
  </section>;
}

export function ProfileNavigationRow({ title, icon: Icon, onClick }: { title: string; detail: string; icon: LucideIcon; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="profile-navigation-row lifeos-panel group flex min-h-14 w-full items-center gap-3 border-b px-3 py-2 text-left transition-colors hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-color)] active:scale-[.995]">
    <span className="lifeos-tint flex h-9 w-9 shrink-0 items-center justify-center rounded-lg lifeos-accent-text" aria-hidden="true"><Icon size={17} strokeWidth={1.9} /></span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span></span>
  </button>;
}

export function ProfileHome({ name, initial, onNameChange, onOpen, developerAllowed = false }: {
  name: string;
  initial: string;
  onNameChange: (name: string) => Promise<void>;
  onOpen: (section: typeof profileLinks[number]['section'] | 'developer') => void;
  developerAllowed?: boolean;
}) {
  return <div className="profile-settings mx-auto w-full max-w-xl space-y-5" data-testid="profile-settings-home">
    <header><h1 className="type-page-title">Profile</h1></header>
    <ProfileIdentityCard name={name} initial={initial} onChange={onNameChange} />
    <nav aria-label="Profile settings" className="profile-settings-list grid overflow-hidden rounded-xl border border-[var(--stroke)]">
      {profileLinks.map(({ section, title, detail, Icon }) => <ProfileNavigationRow key={section} title={title} detail={detail} icon={Icon} onClick={() => onOpen(section)} />)}
      {developerAllowed && <ProfileNavigationRow title="Developer tools" detail="Diagnostics and isolated demonstration data" icon={Info} onClick={() => onOpen('developer')} />}
    </nav>
  </div>;
}

export function ProfileSubpage({ title, onBack, backLabel = 'Profile', children }: { title: string; description?: string; backLabel?: string; onBack: () => void; children: ReactNode }) {
  return <section className="profile-settings profile-subpage mx-auto w-full max-w-xl space-y-4" data-testid="profile-settings-subpage">
    <header className="flex items-center gap-2"><button type="button" aria-label={backLabel} onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-semibold lifeos-accent-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-color)]"><ChevronLeft size={19} aria-hidden="true" /></button><h1 className="type-page-title">{title}</h1></header>
    {children}
  </section>;
}
