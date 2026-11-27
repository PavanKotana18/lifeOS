import { useRef } from 'react';
import { Download, FileUp, FileSpreadsheet, ShieldCheck, Trash2 } from 'lucide-react';
import { ProfileButton, ProfileGroup, ProfileStatus } from './ProfileSettings';

export default function ProfileData({ busy, stage, lastBackup, onBackup, onRestore, onCsv, onReset }: {
  busy: boolean; stage?: string; lastBackup?: string; onBackup: () => void; onRestore: (file: File) => void; onCsv: () => void; onReset: () => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  return <>
    {busy && <div className="profile-tone-sample" role="status"><strong>{stage || 'Working with your records…'}</strong>
      <p className="profile-description">Keep BusyDoo open until this step completes.</p></div>}
    <ProfileGroup title="Create encrypted backup" variant="feature" topic="Encrypted backups" icon={ShieldCheck}
      description="Save a protected copy outside this device. You’ll need the backup passphrase to restore it.">
      {lastBackup && <ProfileStatus title="Last confirmed backup" value={lastBackup} />}
      <div className="profile-actions"><ProfileButton tone="primary" disabled={busy} onClick={onBackup}>
        <Download size={18} aria-hidden="true" />Export encrypted backup</ProfileButton></div>
    </ProfileGroup>
    <ProfileGroup title="Restore a backup" variant="plain" icon={FileUp}
      description="Choose a file and validate it. BusyDoo asks before replacing records on this device.">
      <div className="profile-actions"><ProfileButton disabled={busy} onClick={() => picker.current?.click()}>Choose backup file</ProfileButton></div>
      <input ref={picker} type="file" accept="application/json,.json" hidden disabled={busy} onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) onRestore(file);
      }} />
    </ProfileGroup>
    <ProfileGroup title="Financial CSV" variant="plain" topic="Readable exports" icon={FileSpreadsheet}
      description="Save a spreadsheet copy of transactions. Anyone with the file can read it.">
      <div className="profile-actions"><ProfileButton disabled={busy} onClick={onCsv}>Export transactions CSV</ProfileButton></div>
    </ProfileGroup>
    <ProfileGroup title="Data management" destructive variant="plain" topic="Data reset" icon={Trash2}
      description="Review exactly what will be erased and which files or device protections remain.">
      <div className="profile-actions"><ProfileButton tone="danger" disabled={busy} onClick={onReset}>Erase local records</ProfileButton></div>
    </ProfileGroup>
  </>;
}
