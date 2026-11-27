import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { ProfileButton, ProfileIcon } from './ProfileSettings';

export default function BackupPassphraseDialog({ purpose, onComplete }: {
  purpose: 'export' | 'import'; onComplete(value: string | null): void;
}) {
  const [value, setValue] = useState('');
  const exportMode = purpose === 'export';
  const finish = (result: string | null) => { setValue(''); onComplete(result); };
  return <main className="profile-design profile-overlay" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); finish(null); }
  }}>
    <form role="dialog" aria-modal="true" aria-labelledby="backup-passphrase-title" className="profile-protected-form" onSubmit={event => {
      event.preventDefault(); finish(value);
    }}>
      <ProfileIcon icon={KeyRound} />
      <h1 id="backup-passphrase-title">{exportMode ? 'Protect your backup' : 'Unlock this backup'}</h1>
      <p className="profile-description">{exportMode
        ? 'Use at least 12 characters. Store the passphrase separately from the file. You’ll need it to restore this backup.'
        : 'Enter the passphrase used when this file was exported. BusyDoo checks the file before you can replace any records.'}</p>
      <label className="profile-field">Backup passphrase<input autoFocus required type="password"
        minLength={exportMode ? 12 : 1} maxLength={1024} autoComplete={exportMode ? 'new-password' : 'off'}
        value={value} onChange={event => setValue(event.target.value)} /></label>
      <div className="profile-actions">
        <ProfileButton data-profile-protected-close onClick={() => finish(null)}>Cancel</ProfileButton>
        <ProfileButton tone="primary" type="submit" disabled={value.length < (exportMode ? 12 : 1)}>{exportMode ? 'Continue to export' : 'Validate backup'}</ProfileButton>
      </div>
    </form>
  </main>;
}
