import { useState, type ReactNode } from 'react';
import { Bell, Palette, SlidersHorizontal, Shield, UserRound, Database, Info } from 'lucide-react';
import { FeatherHeader } from './FeatherHeader';
import type { LucideIcon } from 'lucide-react';

export type ProfileSection = 'home' | 'appearance' | 'preferences' | 'notifications' | 'privacy' | 'data' | 'about' | 'developer' | 'themes' | 'accent' | 'motion' | 'app-lock' | 'recovery' | 'licenses';

export const PROFILE_TITLES: Record<ProfileSection, string> = {
  home: 'Profile', appearance: 'Appearance', preferences: 'Preferences', notifications: 'Notifications',
  privacy: 'Privacy & security', data: 'Backup & Restore', about: 'About LifeOS', developer: 'Developer tools',
  themes: 'Themes', accent: 'Accent color', motion: 'Motion', 'app-lock': 'App lock', recovery: 'Recovery', licenses: 'Open-source licenses',
};

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

export function ProfileAvatar({ photo }: { photo?: string | null; initial?: string }) {
  return photo ? <img className="profile-avatar-image" src={photo} alt="" draggable={false} /> : <span className="profile-avatar-placeholder" aria-hidden="true"><UserRound size="56%" strokeWidth={1.55} /></span>;
}

export function ProfileIdentityCard({ name, initial, photo, photoBusy, photoError, onPhotoChange, onChange }: { name: string; initial: string; photo?: string | null; photoBusy?: boolean; photoError?: string; onPhotoChange?: (remove?: boolean) => Promise<void>; onChange: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <section className="profile-identity-card lifeos-panel rounded-2xl border" aria-labelledby="profile-identity-title">
    <div className="profile-identity-row flex items-center gap-3">
      <div className="profile-avatar lifeos-tint lifeos-accent-text flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-semibold" aria-hidden="true"><ProfileAvatar photo={photo} initial={initial} /></div>
      <h2 id="profile-identity-title" className="min-w-0 flex-1 safe-wrap text-xl font-semibold">{name.trim() || 'Your profile'}</h2>
      {!editing && <button type="button" className="min-h-11 text-sm lifeos-accent-text" onClick={() => { setDraft(name); setEditing(true); }}>Edit name</button>}
    </div>
    {onPhotoChange && <div className="profile-photo-actions" aria-busy={photoBusy}>
      <button type="button" disabled={photoBusy} onClick={() => void onPhotoChange()}>{photo ? "Replace photo" : "Choose photo"}</button>
      {photo && <button type="button" disabled={photoBusy} onClick={() => void onPhotoChange(true)}>Remove photo</button>}
      {photoBusy && <span role="status" className="text-secondary text-xs">Updating photo?</span>}
    </div>}
    {photoError && <p role="alert" className="mt-1 text-xs text-[var(--danger)]">{photoError}</p>}
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

export function ProfileNavigationRow({ title, icon: Icon, onClick, value }: { title: string; detail: string; value?: string; icon: LucideIcon; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="profile-navigation-row lifeos-panel group flex min-h-14 w-full items-center gap-3 border-b px-3 py-2 text-left transition-colors hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-color)] active:scale-[.995]">
    <span className="lifeos-tint flex h-9 w-9 shrink-0 items-center justify-center rounded-lg lifeos-accent-text" aria-hidden="true"><Icon size={17} strokeWidth={1.9} /></span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span>{value && <span className="block text-xs text-secondary">{value}</span>}</span>
  </button>;
}

export function ProfileHome({ name, initial, photo, photoBusy, photoError, onPhotoChange, onNameChange, onOpen, onBack, sharedHeader = false, developerAllowed = false, securityStatus }: {
  name: string;
  initial: string;
  photo?: string | null;
  photoBusy?: boolean;
  photoError?: string;
  onPhotoChange?: (remove?: boolean) => Promise<void>;
  onNameChange: (name: string) => Promise<void>;
  onOpen: (section: typeof profileLinks[number]['section'] | 'developer') => void;
  onBack: () => void;
  sharedHeader?: boolean;
  developerAllowed?: boolean;
  securityStatus?: string;
}) {
  return <div className="profile-settings mx-auto w-full max-w-xl space-y-5" data-testid="profile-settings-home">
    {!sharedHeader && <FeatherHeader title="Profile" heading="h1" back={{ label: 'Back from profile', onClick: onBack }} />}
    <ProfileIdentityCard name={name} initial={initial} photo={photo} photoBusy={photoBusy} photoError={photoError} onPhotoChange={onPhotoChange} onChange={onNameChange} />
    <nav aria-label="Profile settings" className="profile-settings-list space-y-4">
      {[profileLinks.slice(0, 3), profileLinks.slice(3)].map((group, index) =>
        <section key={index} aria-label={index === 0 ? "Personal preferences" : "Security and information"} className="profile-link-group lifeos-panel rounded-2xl border">
          {group.map(({ section, title, detail, Icon }) => <ProfileNavigationRow key={section} title={title} detail={detail} icon={Icon}
            value={section === "privacy" ? securityStatus : undefined} onClick={() => onOpen(section)} />)}
        </section>)}
      {developerAllowed && <section className="profile-link-group lifeos-panel rounded-2xl border"><ProfileNavigationRow title="Developer tools" detail="Diagnostics and isolated demonstration data" icon={Info} onClick={() => onOpen('developer')} /></section>}
    </nav>
  </div>;
}

export function ProfileSubpage({ title, onBack, backLabel = 'Back to Profile', embedded = false, children }: { title: string; description?: string; backLabel?: string; embedded?: boolean; onBack: () => void; children: ReactNode }) {
  return <section className="profile-settings profile-subpage mx-auto w-full max-w-xl space-y-4" data-testid="profile-settings-subpage">
    {!embedded && <FeatherHeader title={title} heading="h2" back={{ label: backLabel, onClick: onBack }} />}
    {children}
  </section>;
}
