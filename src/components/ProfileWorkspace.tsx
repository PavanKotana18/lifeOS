import { Clipboard, FileText, KeyRound, LockKeyhole, Play, Share2, ShieldCheck } from 'lucide-react';
import { BusyDooBrand } from './BusyDooBrand';
import { ProfileButton, ProfileGroup, ProfileSettingRow, ProfileStatus, ProfileToggle, type ProfileSection } from './ProfileSettings';

export function ProfilePrivacy({ protectedStorage, biometric, recovery, legal, onOpen }: {
  protectedStorage: boolean; biometric: boolean; recovery: boolean; legal: boolean; onOpen: (section: ProfileSection) => void;
}) {
  return <>
    <ProfileGroup title={protectedStorage ? 'Encrypted workspace' : 'Device protection'} variant="feature" icon={ShieldCheck} topic="Encryption"
      description={protectedStorage ? 'Personal records are encrypted with a key protected by Android.' : 'BusyDoo sets up local encryption before saving your first private record.'} />
    <ProfileGroup title="Access and recovery">
      <ProfileSettingRow title="App lock" detail="Manage verification when reopening BusyDoo." icon={LockKeyhole} value={biometric ? 'On' : 'Off'} onClick={() => onOpen('app-lock')} />
      <ProfileSettingRow title="Recovery" detail="Prepare a private kit for this workspace." icon={KeyRound} value={recovery ? 'Confirmed' : 'Pending'} onClick={() => onOpen('recovery')} />
      {legal && <ProfileSettingRow title="Legal & Privacy" detail="Internal document library" icon={FileText} value="Draft" onClick={() => onOpen('legal')} />}
    </ProfileGroup>
  </>;
}

export function ProfileAppLock({ enabled, verified, availability, busy, onToggle }: {
  enabled: boolean; verified: boolean; availability: string; busy: boolean; onToggle: () => void;
}) {
  return <>
    <ProfileGroup title="App lock" variant="feature" icon={LockKeyhole} topic="App lock"
      description="Use your Android device credential or biometrics when BusyDoo requests verification.">
      <ProfileToggle title="App lock" checked={enabled} disabled={busy} onChange={onToggle} detail={busy ? 'Waiting for verification…' : 'Verify before reopening your workspace.'} />
    </ProfileGroup>
    <ProfileGroup title="Verification status">
      <ProfileStatus title="Device availability" value={availability} />
      <ProfileStatus title="Current session" value={verified && enabled ? 'Verified' : enabled ? 'Verification required' : 'App lock is off'} />
    </ProfileGroup>
  </>;
}

export function ProfileRecovery({ ready, deferred, label, busy, onSetup, onBackup }: {
  ready: boolean; deferred: boolean; label?: string; busy: boolean; onSetup(): void; onBackup(): void;
}) {
  return <>
    <ProfileGroup title={ready ? 'Recovery kit confirmed' : 'Recovery kit'} variant="feature" icon={KeyRound} topic="Recovery kit"
      description={ready ? 'Keep your saved recovery file somewhere safe and accessible.' : deferred ?
        'Prepare a private recovery kit to help regain access if the device key is lost.' : 'Set up device protection before creating a private recovery kit.'}>
      {label && <ProfileStatus title="Recovery label" value={label} />}
      {deferred && !ready && <div className="profile-actions"><ProfileButton tone="primary" disabled={busy} onClick={onSetup}>
        {busy ? 'Preparing…' : 'Set up recovery kit'}</ProfileButton></div>}
    </ProfileGroup>
    <ProfileGroup title="Recovery and backups">
      <ProfileStatus title="Recovery kit" detail="Helps unlock the matching encrypted workspace." value={ready ? 'Confirmed' : 'Pending'} />
      <ProfileSettingRow title="Encrypted backup" detail="Contains a separate copy of records and uses a separate passphrase." onClick={onBackup} />
    </ProfileGroup>
  </>;
}

export function ProfileMoneyImports({ onImport }: { onImport(): void }) {
  return <>
    <ProfileGroup title="Paste a bank alert" variant="feature" icon={Clipboard}
      description="Copy an alert, paste it into BusyDoo and check the extracted details before saving the transaction.">
      <div className="profile-actions"><ProfileButton tone="primary" onClick={onImport}>Import alert</ProfileButton></div>
    </ProfileGroup>
    <ProfileGroup title="Share from Android" variant="plain" icon={Share2}
      description="From a message or another app, use Share and choose BusyDoo. The alert opens in the same protected review." />
  </>;
}

export function ProfileAbout({ version, onReplay, onLicenses }: { version: string; onReplay(): void; onLicenses(): void }) {
  return <>
    <div className="profile-brand-hero profile-group" data-variant="feature">
      <BusyDooBrand assetRoot={import.meta.env.BASE_URL} />
      <p className="profile-description">Life, in one place.</p>
    </div>
    <ProfileGroup title="About this installation">
      <ProfileStatus title="Installed version" value={version} />
      <ProfileSettingRow title="Replay A Life in Harmony" icon={Play} detail="Watch the BusyDoo launch film." onClick={onReplay} />
      <ProfileSettingRow title="Open-source licenses" icon={FileText} detail="Browse the notices packaged with this app." onClick={onLicenses} />
    </ProfileGroup>
  </>;
}
