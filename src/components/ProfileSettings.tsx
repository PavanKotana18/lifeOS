import { useId, useState, type ReactNode } from 'react';
import { Bell, ChevronLeft, ChevronRight, Palette, SlidersHorizontal, Shield, UserRound, Database, Info } from 'lucide-react';
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
  { section: 'notifications', title: 'Notifications', detail: 'Choose which reminders BusyDoo sends', Icon: Bell },
  { section: 'privacy', title: 'Privacy & Security', detail: 'App lock and recovery status', Icon: Shield },
  { section: 'data', title: 'Backup & Restore', detail: 'Encrypted backup and local records', Icon: Database },
  { section: 'about', title: 'About', detail: 'Version and privacy information', Icon: Info },
] as const;

export function ProfileAvatar({ photo, initial }: { photo?: string | null; initial: string }) {
  return photo ? <img className="profile-avatar-image" src={photo} alt="" draggable={false} />
    : initial || <UserRound size={18} aria-hidden="true" />;
}

type ProfilePhotoControls = {
  photo?: string | null;
  photoBusy?: boolean;
  photoError?: string;
  onPhotoChange?: (remove?: boolean) => Promise<void>;
};

export function ProfileIdentityCard({ name, initial, onChange, photo, photoBusy, photoError, onPhotoChange }: { name: string; initial: string; onChange: (name: string) => Promise<void> } & ProfilePhotoControls) {
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
      <button type="button" disabled={photoBusy} onClick={() => void onPhotoChange()}>{photo ? 'Replace photo' : 'Choose photo'}</button>
      {photo && <button type="button" disabled={photoBusy} onClick={() => void onPhotoChange(true)}>Remove photo</button>}
      {photoBusy && <span role="status" className="text-xs text-secondary">Updating photo?</span>}
    </div>}
    {photoError && <p role="alert" className="mt-1 text-xs text-[var(--danger)]">{photoError}</p>}
    {editing && <form data-no-tab-swipe className="mt-3 space-y-2" onSubmit={async event => {
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

export function ProfileNavigationRow({ title, detail, icon: Icon, onClick, value }: { title: string; detail: string; value?: string; icon: LucideIcon; onClick: () => void }) {
  const description = useId();
  return <button type="button" onClick={onClick} className="profile-navigation-row" aria-label={title} aria-describedby={description}>
    <span className="profile-navigation-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span>
    <span className="profile-navigation-copy">
      <span className="profile-navigation-title">{title}</span>
      <span id={description} className="profile-navigation-description">{detail}{value && <strong>{value}</strong>}</span>
    </span>
    <ChevronRight className="profile-navigation-chevron" size={15} aria-hidden="true" />
  </button>;
}

export function ProfileHome({ name, initial, onNameChange, onOpen, onBack, embedded = false, developerAllowed = false, securityStatus, ...photoControls }: {
  name: string;
  initial: string;
  onNameChange: (name: string) => Promise<void>;
  onOpen: (section: typeof profileLinks[number]['section'] | 'developer') => void;
  onBack: () => void;
  embedded?: boolean;
  developerAllowed?: boolean;
  securityStatus?: string;
} & ProfilePhotoControls) {
  return <div className="profile-settings mx-auto w-full max-w-xl space-y-5" data-testid="profile-settings-home">
    {!embedded && <ProfilePageHeader title="Profile" backLabel="Back from profile" onBack={onBack} />}
    <ProfileIdentityCard name={name} initial={initial} onChange={onNameChange} {...photoControls} />
    <nav aria-label="Profile settings" className="profile-settings-list space-y-4">
      {[profileLinks.slice(0, 3), profileLinks.slice(3)].map((group, index) =>
        <section key={index} aria-label={index === 0 ? "Personal preferences" : "Security and information"} className="profile-link-group">
          {group.map(({ section, title, detail, Icon }) => <ProfileNavigationRow key={section} title={title} detail={detail} icon={Icon}
            value={section === "privacy" ? securityStatus : undefined} onClick={() => onOpen(section)} />)}
        </section>)}
      {developerAllowed && <section className="profile-link-group"><ProfileNavigationRow title="Developer tools" detail="Diagnostics and isolated demonstration data" icon={Info} onClick={() => onOpen('developer')} /></section>}
    </nav>
  </div>;
}

export function ProfileSubpage({ title, onBack, backLabel = 'Profile', children }: { title: string; description?: string; backLabel?: string; onBack: () => void; children: ReactNode }) {
  return <section className="profile-settings profile-subpage mx-auto w-full max-w-xl space-y-4" data-testid="profile-settings-subpage">
    <ProfilePageHeader title={title} backLabel={backLabel} onBack={onBack} />
    {children}
  </section>;
}

function ProfilePageHeader({ title, backLabel, onBack }: { title: string; backLabel: string; onBack: () => void }) {
  return <header className="profile-page-heading">
    <button type="button" aria-label={backLabel} onClick={onBack}><ChevronLeft size={22} aria-hidden="true" /></button>
    <h1 className="type-page-title" tabIndex={-1}>{title}</h1>
  </header>;
}
