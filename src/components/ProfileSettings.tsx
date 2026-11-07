import type { ReactNode } from 'react';
import { ArrowRight, Bell, ChevronLeft, Palette, SlidersHorizontal, Shield, UserRound, Database, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ProfileSection = 'home' | 'appearance' | 'preferences' | 'notifications' | 'privacy' | 'data' | 'about';

const profileLinks = [
  { section: 'appearance', title: 'Appearance', detail: 'Theme, color and display mode', Icon: Palette },
  { section: 'preferences', title: 'Preferences', detail: 'Currency, dates, time and units', Icon: SlidersHorizontal },
  { section: 'notifications', title: 'Notifications', detail: 'Choose which reminders LifeOS sends', Icon: Bell },
  { section: 'privacy', title: 'Privacy & security', detail: 'App lock and recovery status', Icon: Shield },
  { section: 'data', title: 'Data & backup', detail: 'Encrypted backup and local records', Icon: Database },
  { section: 'about', title: 'About LifeOS', detail: 'Version and privacy information', Icon: Info },
] as const;

export function ProfileIdentityCard({ name, initial, onChange }: { name: string; initial: string; onChange: (name: string) => void }) {
  return <section className="profile-identity lifeos-panel rounded-3xl border p-5 sm:p-6" aria-labelledby="profile-identity-title">
    <div className="flex items-center gap-4">
      <div className="profile-avatar lifeos-accent-button flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-semibold" aria-hidden="true">
        {initial || <UserRound size={25} />}
      </div>
      <div className="min-w-0"><p className="type-eyebrow">YOUR LIFEOS</p><h2 id="profile-identity-title" className="mt-1 truncate text-xl font-semibold tracking-tight">{name.trim() || 'Your profile'}</h2><p className="mt-1 text-sm text-secondary">Your information stays on this device.</p></div>
    </div>
    <label className="mt-5 block text-sm font-medium">Display name
      <input type="text" name="display-name" autoComplete="name" enterKeyHint="done" maxLength={48} value={name} onChange={event => onChange(event.target.value)} placeholder="What should LifeOS call you?" className="lifeos-input mt-2 min-h-12 w-full rounded-xl px-4 py-3 text-base" />
    </label>
  </section>;
}

export function ProfileNavigationRow({ title, detail, icon: Icon, onClick }: { title: string; detail: string; icon: LucideIcon; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="profile-navigation-row lifeos-panel group flex min-h-[76px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-color)] active:scale-[.995]">
    <span className="lifeos-tint flex h-11 w-11 shrink-0 items-center justify-center rounded-xl lifeos-accent-text" aria-hidden="true"><Icon size={19} strokeWidth={1.9} /></span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-secondary">{detail}</span></span>
    <ArrowRight size={17} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
  </button>;
}

export function ProfileHome({ name, initial, onNameChange, onOpen }: {
  name: string;
  initial: string;
  onNameChange: (name: string) => void;
  onOpen: (section: Exclude<ProfileSection, 'home'>) => void;
}) {
  return <div className="profile-settings mx-auto w-full max-w-xl space-y-5" data-testid="profile-settings-home">
    <header className="px-1"><p className="type-eyebrow">PROFILE</p><h1 className="type-page-title mt-1">Your space</h1><p className="type-body mt-1 text-secondary">Make LifeOS feel right for you.</p></header>
    <ProfileIdentityCard name={name} initial={initial} onChange={onNameChange} />
    <nav aria-label="Profile settings" className="grid gap-2">
      {profileLinks.map(({ section, title, detail, Icon }) => <ProfileNavigationRow key={section} title={title} detail={detail} icon={Icon} onClick={() => onOpen(section)} />)}
    </nav>
    <p className="px-1 text-xs leading-5 text-muted">LifeOS works offline. Your personal records are stored in encrypted local app storage.</p>
  </div>;
}

export function ProfileSubpage({ title, description, onBack, children }: { title: string; description: string; onBack: () => void; children: ReactNode }) {
  return <section className="profile-settings mx-auto w-full max-w-xl space-y-5" data-testid="profile-settings-subpage">
    <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-semibold lifeos-accent-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-color)]"><ChevronLeft size={19} aria-hidden="true" />Profile</button>
    <header className="px-1"><p className="type-eyebrow">SETTINGS</p><h1 className="type-page-title mt-1">{title}</h1><p className="type-body mt-1 text-secondary">{description}</p></header>
    {children}
  </section>;
}
