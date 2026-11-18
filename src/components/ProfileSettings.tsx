import type { ReactNode } from 'react';
import { Bell, ChevronLeft, Palette, SlidersHorizontal, Shield, UserRound, Database, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ProfileSection = 'home' | 'appearance' | 'preferences' | 'notifications' | 'privacy' | 'data' | 'about' | 'developer';

const profileLinks = [
  { section: 'appearance', title: 'Appearance', detail: 'Theme, color and display mode', Icon: Palette },
  { section: 'preferences', title: 'Preferences', detail: 'Currency, dates, time and units', Icon: SlidersHorizontal },
  { section: 'notifications', title: 'Notifications', detail: 'Choose which reminders LifeOS sends', Icon: Bell },
  { section: 'privacy', title: 'Privacy & Security', detail: 'App lock and recovery status', Icon: Shield },
  { section: 'data', title: 'Backup & Restore', detail: 'Encrypted backup and local records', Icon: Database },
  { section: 'about', title: 'About', detail: 'Version and privacy information', Icon: Info },
] as const;

export function ProfileIdentityCard({ name, initial, onChange }: { name: string; initial: string; onChange: (name: string) => void }) {
  return <section className="profile-identity pb-3" aria-labelledby="profile-identity-title">
    <div className="flex items-center gap-4">
      <div className="profile-avatar lifeos-accent-button flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold" aria-hidden="true">
        {initial || <UserRound size={25} />}
      </div>
      <div className="min-w-0"><h2 id="profile-identity-title" className="mt-1 truncate text-xl font-semibold tracking-tight">{name.trim() || 'Your profile'}</h2></div>
    </div>
    <label className="mt-5 block text-sm font-medium">Display name
      <input type="text" name="display-name" autoComplete="name" enterKeyHint="done" maxLength={48} value={name} onChange={event => onChange(event.target.value)} placeholder="What should LifeOS call you?" className="lifeos-input mt-2 min-h-12 w-full rounded-xl px-4 py-3 text-base" />
    </label>
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
  onNameChange: (name: string) => void;
  onOpen: (section: Exclude<ProfileSection, 'home'>) => void;
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

export function ProfileSubpage({ title, onBack, children }: { title: string; description: string; onBack: () => void; children: ReactNode }) {
  return <section className="profile-settings profile-subpage mx-auto w-full max-w-xl space-y-4" data-testid="profile-settings-subpage">
    <header className="flex items-center gap-2"><button type="button" aria-label="Profile" onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-semibold lifeos-accent-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-color)]"><ChevronLeft size={19} aria-hidden="true" /></button><h1 className="type-page-title">{title}</h1></header>
    {children}
  </section>;
}
