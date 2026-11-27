import { useRef } from 'react';
import { ProfileGroup } from './ProfileSettings';

export default function ProfileData({ busy, onBackup, onRestore, onCsv, onReset }: {
  busy: boolean; onBackup: () => void; onRestore: (file: File) => void; onCsv: () => void; onReset: () => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  return <>
    <ProfileGroup title="Encrypted backup" description="Keep a protected copy outside this device. You will need its separate passphrase to restore it.">
      <button type="button" className="feather-primary" disabled={busy} onClick={onBackup}>Export encrypted backup</button>
    </ProfileGroup>
    <ProfileGroup title="Restore records" description="Choose a backup to validate it. BusyDoo asks before replacing your existing records.">
      <button type="button" className="feather-secondary" disabled={busy} onClick={() => picker.current?.click()}>Choose backup file</button>
      <input ref={picker} type="file" accept="application/json,.json" className="hidden" onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) onRestore(file);
      }} />
    </ProfileGroup>
    <ProfileGroup title="Transaction export" description="CSV is readable and unencrypted. Use an encrypted backup to make a protected copy.">
      <button type="button" className="feather-secondary" disabled={busy} onClick={onCsv}>Export transactions CSV</button>
    </ProfileGroup>
    {busy && <p role="status" className="profile-detail">A data operation is in progress...</p>}
    <ProfileGroup title="Data reset" destructive description="Erase local records and settings. Device protection and exported files stay in place. Already displayed Android notifications may remain.">
      <button type="button" className="lifeos-danger min-h-11 rounded-xl border px-4 text-sm font-semibold" disabled={busy} onClick={onReset}>Erase local records</button>
    </ProfileGroup>
  </>;
}
