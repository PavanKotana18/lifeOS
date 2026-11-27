import { closeSheet, showSheet } from './sheetMotion';
import { useRef, useState, type ReactNode } from 'react';
import { Bell, Palette, SlidersHorizontal, Shield, UserRound, Database, Info, Wallet, Camera, Crop, ImagePlus, PencilLine, Trash2 } from 'lucide-react';
import { FeatherHeader } from './FeatherHeader';
import type { LucideIcon } from 'lucide-react';

export type ProfileSection = 'home' | 'appearance' | 'preferences' | 'notifications' | 'privacy' | 'data' | 'about' | 'developer' | 'themes' | 'accent' | 'motion' | 'app-lock' | 'recovery' | 'licenses' | 'money-imports' | 'legal';

export const PROFILE_TITLES: Record<ProfileSection, string> = {
  home: 'Profile', appearance: 'Appearance', preferences: 'Preferences', notifications: 'Notifications',
  privacy: 'Privacy & security', data: 'Backup & Restore', about: 'About BusyDoo', developer: 'Developer tools',
  themes: 'Themes', accent: 'Accent color', motion: 'Motion', 'app-lock': 'App lock', recovery: 'Recovery', licenses: 'Open-source licenses', 'money-imports': 'Money & Imports', legal: 'Legal & Privacy',
};

export function profileParent(section: ProfileSection): ProfileSection {
  if (section === 'themes' || section === 'accent' || section === 'motion') return 'appearance';
  if (section === 'app-lock' || section === 'recovery') return 'privacy';
  if (section === 'legal') return 'privacy';
  if (section === 'licenses') return 'about';
  return 'home';
}

export function ProfileGroup({ title, description, children, destructive = false }: {
  title: string; description?: string; children: ReactNode; destructive?: boolean;
}) {
  return <section aria-label={title} className="profile-group" data-destructive={destructive || undefined}>
    <h3 className="type-section-title">{title}</h3>
    {description && <p className="profile-detail">{description}</p>}
    <div className="profile-group-content">{children}</div>
  </section>;
}

export function ProfileToggle({ title, detail, checked, disabled, onChange }: {
  title: string; detail?: string; checked: boolean; disabled?: boolean; onChange: () => void;
}) {
  return <button type="button" role="switch" aria-label={title} aria-checked={checked}
    disabled={disabled} className="preference-row profile-toggle-row" onClick={onChange}>
    <span><strong>{title}</strong>{detail && <small className="profile-detail">{detail}</small>}</span>
    <span className="preference-toggle" aria-hidden="true" />
  </button>;
}

export function ProfileStatus({ title, value }: { title: string; value: string }) {
  return <div className="preference-row profile-status-row"><span>{title}</span><span>{value}</span></div>;
}

export function ProfileSettingRow({ title, value, onClick }: { title: string; value?: string; onClick: () => void }) {
  return <button type="button" className="preference-row" onClick={onClick}><span>{title}</span>{value && <span className="text-secondary text-right">{value}</span>}</button>;
}

const profileLinks = [
  { section: 'appearance', title: 'Appearance', detail: 'Theme, color and display mode', Icon: Palette },
  { section: 'preferences', title: 'Preferences', detail: 'Currency, dates, time and units', Icon: SlidersHorizontal },
  { section: 'notifications', title: 'Notifications', detail: 'Choose which reminders BusyDoo sends', Icon: Bell },
  { section: 'money-imports', title: 'Money & Imports', detail: 'Review a pasted or shared bank alert', Icon: Wallet },
  { section: 'privacy', title: 'Privacy & Security', detail: 'App lock and recovery status', Icon: Shield },
  { section: 'data', title: 'Backup & Restore', detail: 'Encrypted backup and local records', Icon: Database },
  { section: 'about', title: 'About', detail: 'Version and privacy information', Icon: Info },
] as const;

export function ProfileAvatar({ photo }: { photo?: string | null; initial?: string }) {
  return photo ? <img className="profile-avatar-image" src={photo} alt="" draggable={false} /> : <span className="profile-avatar-placeholder" aria-hidden="true"><UserRound size="56%" strokeWidth={1.55} /></span>;
}

export function ProfileIdentityCard({ name, initial, photo, photoBusy, photoError, onPhotoChange, onEditPhoto, onChange }: { name: string; initial: string; photo?: string | null; photoBusy?: boolean; photoError?: string; onPhotoChange?: (remove?: boolean) => Promise<void>; onEditPhoto?: () => void; onChange: (name: string) => Promise<void> }) {
  const photoSheet = useRef<HTMLDialogElement>(null);
  const nameSheet = useRef<HTMLDialogElement>(null);
  const avatar = useRef<HTMLButtonElement>(null);
  const pencil = useRef<HTMLButtonElement>(null);
  const remove = useRef(false);
  const [draft, setDraft] = useState('');
  const savingName = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <section className="profile-identity-card lifeos-panel rounded-2xl border" aria-labelledby="profile-identity-title">
    <div className="profile-identity-row flex items-center gap-3">
      {onPhotoChange ? <button type="button" ref={avatar} aria-label="Profile photo options" aria-haspopup="dialog"
        className="profile-avatar profile-avatar-trigger lifeos-tint lifeos-accent-text flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
        disabled={photoBusy} onClick={() => showSheet(photoSheet.current)}>
        <span className="profile-avatar-picture"><ProfileAvatar photo={photo} initial={initial} /></span>
        <span className="profile-avatar-camera" aria-hidden="true"><Camera size={15} strokeWidth={1.8} /></span>
      </button> : <div className="profile-avatar lifeos-tint lifeos-accent-text flex h-14 w-14 shrink-0 items-center justify-center rounded-xl" aria-hidden="true"><ProfileAvatar photo={photo} initial={initial} /></div>}
      <h2 id="profile-identity-title" className="min-w-0 flex-1 safe-wrap text-xl font-semibold">{name.trim() || 'Your profile'}</h2>
      <button type="button" ref={pencil} aria-label="Edit name" aria-haspopup="dialog" className="feather-icon-button profile-name-edit" onClick={() => {
        setDraft(name); setError(''); showSheet(nameSheet.current);
      }}><PencilLine size={17} strokeWidth={1.8} aria-hidden="true" /></button>
    </div>
    {photoBusy && <p role="status" className="profile-detail">Working on your profile photo...</p>}
    {photoError && <p role="alert" className="text-xs text-[var(--danger)]">{photoError}</p>}
    {onPhotoChange && <dialog ref={photoSheet} data-polish-sheet data-profile-editor aria-label="Profile photo"
      className="profile-editor-sheet lifeos-page" onCancel={event => { event.preventDefault(); closeSheet(photoSheet.current); }}
      onClick={event => { if (event.target === event.currentTarget) closeSheet(photoSheet.current); }}
      onClose={() => {
        avatar.current?.focus({ preventScroll: true });
        if (remove.current) { remove.current = false; void onPhotoChange(true); }
      }}>
      <h3 className="type-section-title">Profile photo</h3>
      <p className="profile-detail">Choose and crop an image for your profile. BusyDoo saves a protected copy without the original photo metadata.</p>
      <button type="button" className="profile-editor-action" onClick={() => { photoSheet.current?.close(); void onPhotoChange(); }}>
        <ImagePlus size={19} aria-hidden="true" />{photo ? 'Replace photo' : 'Choose photo'}
      </button>
      {photo && <><button type="button" className="profile-editor-action" onClick={() => { photoSheet.current?.close(); onEditPhoto?.(); }}><Crop size={19} aria-hidden="true" />Edit photo</button>
        <button type="button" className="profile-editor-action is-destructive" onClick={() => { remove.current = true; closeSheet(photoSheet.current); }}><Trash2 size={19} aria-hidden="true" />Remove photo</button></>}
      <button type="button" className="feather-secondary" onClick={() => closeSheet(photoSheet.current)}>Cancel</button>
    </dialog>}
    <dialog ref={nameSheet} data-polish-sheet data-profile-editor aria-label="Edit name" className="profile-editor-sheet lifeos-page"
      onCancel={event => { event.preventDefault(); if (!busy) closeSheet(nameSheet.current); }}
      onClick={event => { if (!busy && event.target === event.currentTarget) closeSheet(nameSheet.current); }}
      onClose={() => pencil.current?.focus({ preventScroll: true })}>
      <form className="space-y-3" onSubmit={async event => {
        event.preventDefault();
        if (!draft.trim() || savingName.current) return;
        savingName.current = true;
        setBusy(true); setError('');
        try { await onChange(draft); closeSheet(nameSheet.current); }
        catch { setError('Could not save your name. Your previous name is still saved.'); }
        finally { savingName.current = false; setBusy(false); }
      }}>
        <h3 className="type-section-title">Edit name</h3>
        <label className="block text-sm font-medium">Display name<input autoFocus required maxLength={48} value={draft} disabled={busy} autoComplete="nickname"
          onChange={event => setDraft(event.target.value)} className="lifeos-input mt-1 min-h-11 w-full rounded-xl px-3" /></label>
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={busy} className="feather-secondary" onClick={() => closeSheet(nameSheet.current)}>Cancel</button>
          <button type="submit" disabled={busy || !draft.trim()} className="feather-primary">Save name</button></div>
      </form>
    </dialog>
  </section>;
}

export function ProfileNavigationRow({ title, detail, icon: Icon, onClick, value }: { title: string; detail: string; value?: string; icon: LucideIcon; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="profile-navigation-row lifeos-panel group flex min-h-14 w-full items-center gap-3 border-b px-3 py-2 text-left transition-colors hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-color)] active:scale-[.995]">
    <span className="lifeos-tint flex h-9 w-9 shrink-0 items-center justify-center rounded-lg lifeos-accent-text" aria-hidden="true"><Icon size={17} strokeWidth={1.9} /></span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><small className="profile-detail">{detail}</small></span>{value && <span className="profile-row-value">{value}</span>}
  </button>;
}

export function ProfileHome({ name, initial, photo, photoBusy, photoError, onPhotoChange, onEditPhoto, onNameChange, onOpen, onBack, sharedHeader = false, developerAllowed = false, securityStatus }: {
  name: string;
  initial: string;
  photo?: string | null;
  photoBusy?: boolean;
  photoError?: string;
  onPhotoChange?: (remove?: boolean) => Promise<void>; onEditPhoto?: () => void;
  onNameChange: (name: string) => Promise<void>;
  onOpen: (section: typeof profileLinks[number]['section'] | 'developer') => void;
  onBack: () => void;
  sharedHeader?: boolean;
  developerAllowed?: boolean;
  securityStatus?: string;
}) {
  return <div className="profile-settings mx-auto w-full max-w-xl space-y-5" data-testid="profile-settings-home">
    {!sharedHeader && <FeatherHeader title="Profile" heading="h1" back={{ label: 'Back from profile', onClick: onBack }} />}
    <ProfileIdentityCard name={name} initial={initial} photo={photo} photoBusy={photoBusy} photoError={photoError} onPhotoChange={onPhotoChange} onEditPhoto={onEditPhoto} onChange={onNameChange} />
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

export function ProfileSubpage({ title, description, onBack, backLabel = 'Back to Profile', embedded = false, children }: { title: string; description?: string; backLabel?: string; embedded?: boolean; onBack: () => void; children: ReactNode }) {
  return <section className="profile-settings profile-subpage mx-auto w-full max-w-xl space-y-4" data-testid="profile-settings-subpage">
    {!embedded && <FeatherHeader title={title} heading="h2" back={{ label: backLabel, onClick: onBack }} />}
    {description && <p className="profile-intro">{description}</p>}
    {children}
  </section>;
}
