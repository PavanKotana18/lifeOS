import { useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Bell, Palette, SlidersHorizontal, Shield, UserRound, Database, Info, Wallet, Camera, Crop, ImagePlus, PencilLine, Trash2, X, type LucideIcon } from 'lucide-react';
import { FeatherHeader } from './FeatherHeader';
import InfoTip from './InfoTip';
import { closeSheet, showSheet } from './sheetMotion';

export type ProfileSection = 'home' | 'appearance' | 'preferences' | 'notifications' | 'privacy' | 'data' | 'about' | 'developer' | 'themes' | 'accent' | 'motion' | 'app-lock' | 'recovery' | 'licenses' | 'money-imports' | 'legal';

export const PROFILE_TITLES: Record<ProfileSection, string> = {
  home: 'Profile', appearance: 'Appearance', preferences: 'Preferences', notifications: 'Notifications',
  privacy: 'Privacy & security', data: 'Backup & Restore', about: 'About BusyDoo', developer: 'Developer tools',
  themes: 'Themes', accent: 'Accent color', motion: 'Motion', 'app-lock': 'App lock', recovery: 'Recovery',
  licenses: 'Open-source licenses', 'money-imports': 'Money & Imports', legal: 'Legal & Privacy',
};

export function profileParent(section: ProfileSection): ProfileSection {
  if (section === 'themes' || section === 'accent' || section === 'motion') return 'appearance';
  if (section === 'app-lock' || section === 'recovery' || section === 'legal') return 'privacy';
  if (section === 'licenses') return 'about';
  return 'home';
}

export function ProfileButton({ tone = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  return <button type="button" {...props} className={('profile-button ' + className).trim()} data-tone={tone} />;
}

export function ProfileIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <span className="profile-icon" aria-hidden="true"><Icon size={21} strokeWidth={1.7} /></span>;
}

export function ProfileGroup({ title, description, children, destructive = false, topic, icon, variant = 'rows' }: {
  title: string; description?: string; children?: ReactNode; destructive?: boolean; topic?: string; icon?: LucideIcon;
  variant?: 'rows' | 'feature' | 'plain';
}) {
  const id = useId();
  return <section aria-labelledby={id} className="profile-group" data-variant={variant} data-destructive={destructive || undefined}>
    <header className="profile-group-header">
      {icon && <ProfileIcon icon={icon} />}
      <div><h2 id={id}>{title}</h2>{description && <p className="profile-description">{description}</p>}</div>
      {topic && <InfoTip label={topic} variant="profile" />}
    </header>
    {children && <div className="profile-group-content">{children}</div>}
  </section>;
}

export function ProfileToggle({ title, detail, checked, disabled, onChange }: {
  title: string; detail?: string; checked: boolean; disabled?: boolean; onChange: () => void;
}) {
  return <button type="button" role="switch" aria-label={title} aria-checked={checked}
    disabled={disabled} className="profile-row profile-toggle-row" onClick={onChange}>
    <span className="profile-row-copy"><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
    <span className="preference-toggle" aria-hidden="true" />
  </button>;
}

export function ProfileStatus({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return <div className="profile-row">
    <span className="profile-row-copy"><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
    <span className="profile-row-value">{value}</span>
  </div>;
}

export function ProfileSettingRow({ title, value, onClick, detail, icon, disabled }: {
  title: string; value?: string; onClick: () => void; detail?: string; icon?: LucideIcon; disabled?: boolean;
}) {
  const id = useId();
  return <button type="button" className="profile-row" disabled={disabled} aria-labelledby={id + '-title'}
    aria-describedby={[detail && id + '-detail', value && id + '-value'].filter(Boolean).join(' ') || undefined} onClick={onClick}>
    {icon && <ProfileIcon icon={icon} />}
    <span className="profile-row-copy"><strong id={id + '-title'}>{title}</strong>{detail && <small id={id + '-detail'}>{detail}</small>}</span>
    {value && <span className="profile-row-value" id={id + '-value'}>{value}</span>}
  </button>;
}

export function ProfileNavigationRow({ title, detail, icon, onClick, value }: {
  title: string; detail: string; icon: LucideIcon; onClick: () => void; value?: string;
}) {
  return <ProfileSettingRow title={title} detail={detail} icon={icon} value={value} onClick={onClick} />;
}

export function ProfileReader({ title, children, buttonTitle = title, detail, icon = Info }: {
  title: string; children: ReactNode; buttonTitle?: string; detail?: string; icon?: LucideIcon;
}) {
  const panel = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  return <div ref={opener}>
    <ProfileSettingRow title={buttonTitle} detail={detail} icon={icon} onClick={() => { setOpen(true); showSheet(panel.current); }} />
    <dialog ref={panel} className="profile-design profile-reader" data-profile-editor aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); closeSheet(panel.current); }}
      onClose={() => { setOpen(false); opener.current?.querySelector('button')?.focus({ preventScroll: true }); }}>
      <header className="profile-reader-header"><h2 id={titleId}>{title}</h2>
        <button className="profile-icon-button" autoFocus aria-label={'Close ' + title} onClick={() => closeSheet(panel.current)}><X size={21} aria-hidden="true" /></button>
      </header>
      {open && <div className="profile-reading" data-selectable-text>{children}</div>}
    </dialog>
  </div>;
}

const profileGroups = [
  { title: 'Personalize', entries: [
    ['appearance', 'Appearance', 'Theme, accent color and motion', Palette],
    ['preferences', 'Preferences', 'Formats, currency and measurements', SlidersHorizontal],
    ['notifications', 'Notifications', 'Reminders, delivery and inbox history', Bell],
  ] },
  { title: 'Your workspace', entries: [
    ['money-imports', 'Money & Imports', 'Paste or share a bank alert for review', Wallet],
    ['privacy', 'Privacy & Security', 'Device protection and recovery', Shield],
    ['data', 'Backup & Restore', 'Encrypted copies, exports and local data', Database],
  ] },
  { title: 'BusyDoo', entries: [
    ['about', 'About', 'Installed version, launch film and licenses', Info],
  ] },
] as const;

export function ProfileAvatar({ photo, initial }: { photo?: string | null; initial?: string }) {
  return photo ? <img className="profile-avatar-image" src={photo} alt="" draggable={false} /> :
    <span className="profile-avatar-placeholder" aria-hidden="true">{initial || <UserRound size="50%" strokeWidth={1.6} />}</span>;
}

type IdentityProps = {
  name: string; initial: string; photo?: string | null; photoBusy?: boolean; photoError?: string; securityStatus?: string;
  onPhotoChange?: (remove?: boolean) => Promise<void>; onEditPhoto?: () => void; onChange: (name: string) => Promise<void>;
};

export function ProfileIdentityCard({ name, initial, photo, photoBusy, photoError, securityStatus, onPhotoChange, onEditPhoto, onChange }: IdentityProps) {
  const photoSheet = useRef<HTMLDialogElement>(null);
  const nameSheet = useRef<HTMLDialogElement>(null);
  const avatar = useRef<HTMLButtonElement>(null);
  const pencil = useRef<HTMLButtonElement>(null);
  const remove = useRef(false);
  const [draft, setDraft] = useState('');
  const savingName = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <section className="profile-identity-card" aria-labelledby="profile-identity-title">
    <div className="profile-identity-row">
      {onPhotoChange ? <button type="button" ref={avatar} aria-label="Profile photo options" aria-haspopup="dialog"
        className="profile-avatar-trigger" disabled={photoBusy} onClick={() => showSheet(photoSheet.current)}>
        <span className="profile-avatar-picture"><ProfileAvatar photo={photo} initial={initial} /></span>
        <span className="profile-avatar-camera" aria-hidden="true"><Camera size={16} strokeWidth={1.75} /></span>
      </button> : <span className="profile-avatar-picture"><ProfileAvatar photo={photo} initial={initial} /></span>}
      <div className="profile-identity-copy">
        <h2 id="profile-identity-title">{name.trim() || 'Your profile'}</h2>
        {securityStatus && <p className="profile-security-label"><Shield size={15} aria-hidden="true" />{securityStatus}</p>}
        <button type="button" ref={pencil} aria-label="Edit name" aria-haspopup="dialog" className="profile-edit-name" onClick={() => {
          setDraft(name); setError(''); showSheet(nameSheet.current);
        }}><PencilLine size={17} aria-hidden="true" />Edit name</button>
      </div>
    </div>
    {photoBusy && <p role="status" className="profile-description">Preparing your profile photo…</p>}
    {photoError && <p role="alert" className="profile-error">{photoError}</p>}
    {onPhotoChange && <dialog ref={photoSheet} data-polish-sheet data-profile-editor aria-label="Profile photo"
      className="profile-design profile-editor-sheet" onCancel={event => { event.preventDefault(); closeSheet(photoSheet.current); }}
      onClick={event => { if (event.target === event.currentTarget) closeSheet(photoSheet.current); }}
      onClose={() => {
        avatar.current?.focus({ preventScroll: true });
        if (remove.current) { remove.current = false; void onPhotoChange(true); }
      }}>
      <div className="profile-sheet-body">
        <header className="profile-sheet-heading"><h2>Profile photo</h2><p>BusyDoo keeps a cropped, protected copy and discards the original photo metadata.</p></header>
        <div className="profile-row-list"><ProfileSettingRow title={photo ? 'Replace photo' : 'Choose photo'} icon={ImagePlus} onClick={() => { photoSheet.current?.close(); void onPhotoChange(); }} />
          {photo && <><ProfileSettingRow title="Edit photo" icon={Crop} onClick={() => { photoSheet.current?.close(); onEditPhoto?.(); }} />
            <ProfileSettingRow title="Remove photo" icon={Trash2} onClick={() => { remove.current = true; closeSheet(photoSheet.current); }} /></>}
        </div>
        <div className="profile-actions"><ProfileButton onClick={() => closeSheet(photoSheet.current)}>Cancel</ProfileButton></div>
      </div>
    </dialog>}
    <dialog ref={nameSheet} data-polish-sheet data-profile-editor aria-label="Edit name" className="profile-design profile-editor-sheet"
      onCancel={event => { event.preventDefault(); if (!savingName.current) closeSheet(nameSheet.current); }}
      onClick={event => { if (!savingName.current && event.target === event.currentTarget) closeSheet(nameSheet.current); }}
      onClose={() => pencil.current?.focus({ preventScroll: true })}>
      <form className="profile-sheet-body" onSubmit={async event => {
        event.preventDefault();
        if (!draft.trim() || savingName.current) return;
        savingName.current = true; setBusy(true); setError('');
        try { await onChange(draft); closeSheet(nameSheet.current); }
        catch { setError('Could not save your name. Your previous name is still saved.'); }
        finally { savingName.current = false; setBusy(false); }
      }}>
        <header className="profile-sheet-heading"><h2>Edit name</h2><p>BusyDoo uses this name in your greeting and profile.</p></header>
        <label className="profile-field">Display name<input autoFocus required maxLength={48} value={draft} disabled={busy} autoComplete="nickname"
          onChange={event => setDraft(event.target.value)} /></label>
        {error && <p role="alert" className="profile-error">{error}</p>}
        <div className="profile-actions"><ProfileButton disabled={busy} onClick={() => closeSheet(nameSheet.current)}>Cancel</ProfileButton>
          <ProfileButton type="submit" tone="primary" disabled={busy || !draft.trim()}>{busy ? 'Saving…' : 'Save name'}</ProfileButton></div>
      </form>
    </dialog>
  </section>;
}

export function ProfileHome({ onNameChange, onOpen, onBack, sharedHeader = false, developerAllowed = false, ...identity }: Omit<IdentityProps, 'onChange'> & {
  onNameChange: IdentityProps['onChange']; onOpen: (section: ProfileSection) => void; onBack: () => void;
  sharedHeader?: boolean; developerAllowed?: boolean;
}) {
  return <div className="profile-design profile-settings" data-testid="profile-settings-home">
    {!sharedHeader && <FeatherHeader title="Profile" heading="h1" back={{ label: 'Back from profile', onClick: onBack }} />}
    <ProfileIdentityCard {...identity} onChange={onNameChange} />
    <nav aria-label="Profile settings" className="profile-settings-list">
      {profileGroups.map(group => <ProfileGroup key={group.title} title={group.title}>
        {group.entries.map(([section, title, detail, icon]) => <ProfileNavigationRow key={section} title={title} detail={detail}
          icon={icon} onClick={() => onOpen(section)} />)}
      </ProfileGroup>)}
      {developerAllowed && <ProfileGroup title="Development">
        <ProfileNavigationRow title="Developer tools" detail="Diagnostics and isolated demonstration data" icon={Info} onClick={() => onOpen('developer')} />
      </ProfileGroup>}
    </nav>
  </div>;
}

export function ProfileSubpage({ title, description, onBack, backLabel = 'Back to Profile', embedded = false, children }: {
  title: string; description?: string; onBack: () => void; backLabel?: string; embedded?: boolean; children: ReactNode;
}) {
  return <section className="profile-design profile-settings profile-subpage" data-testid="profile-settings-subpage">
    {!embedded && <FeatherHeader title={title} heading="h2" back={{ label: backLabel, onClick: onBack }} />}
    {description && <p className="profile-intro">{description}</p>}
    {children}
  </section>;
}
