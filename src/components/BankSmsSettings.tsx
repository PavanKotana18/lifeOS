import { useEffect, useState } from 'react';
import { bankSms, hasBankSms, type BankSmsStatus } from '../services/bankSms';
import type { Transaction } from '../types';

export function BankSmsSettings({ active, privateReady, onUnlock, onReview, onClear, history, onHistory }: {
  active: boolean;
  privateReady: boolean;
  onUnlock: () => Promise<void>;
  onReview: () => void;
  onClear: () => Promise<boolean>;
  history: Transaction[];
  onHistory: (row: Transaction) => void;
}) {
  const available = hasBankSms();
  const [status, setStatus] = useState<BankSmsStatus>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!available || !active) return;
    let cancelled = false;
    const refresh = () => {
      if (document.hidden) return;
      void bankSms.status().then(result => {
        if (!cancelled) { setStatus(result); setError(''); }
      }).catch(() => { if (!cancelled) setError('Could not read SMS monitoring status.'); });
    };
    refresh();
    const listener = bankSms.addListener('queueChanged', refresh);
    void listener.catch(() => undefined);
    window.addEventListener('lifeos:activity-resumed', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      void listener.then(handle => handle.remove()).catch(() => undefined);
      window.removeEventListener('lifeos:activity-resumed', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [active, available]);

  const change = async (operation: () => Promise<BankSmsStatus>) => {
    setBusy(true);
    setError('');
    try { setStatus(await operation()); }
    catch { setError('Could not change monitoring. Check Android permissions and try again.'); }
    finally { setBusy(false); }
  };
  const title = !available ? 'Unavailable in this build' : error ? 'Needs attention' :
    !status ? 'Checking permission' : !status.supported ? 'Unavailable on this device' : status.enabled && status.granted ? 'On' :
      status.requested && !status.granted ? 'Permission needed' : 'Off';

  return <>
    <section className="bank-sms-settings lifeos-panel" aria-labelledby="bank-sms-settings-title">
      <h2 className="type-section-title" id="bank-sms-settings-title">Automatic bank SMS monitoring</h2>
      <div className="preference-row"><span>Monitoring</span><strong role="status">{title}</strong></div>
      <div className="preference-row"><span>Android SMS permission</span><span>{available ? status?.granted ? 'Granted' : status ? 'Not granted' : 'Checking' : 'Unavailable'}</span></div>
      <p>Android’s permission grants access to newly received SMS. LifeOS filters for bank alerts on this device. It does not send SMS, upload messages, or post transactions automatically.</p>
      {available && status?.supported !== false && <>
        <p>Review suggestions before saving. Pending alerts are protected on this device and expire after three days.</p>
        {status?.requested && !status.granted && <p>Android or the app installer may restrict this permission. Check Permissions in Android app settings.</p>}
        {status?.granted && <p>To revoke access, open Android app settings and turn off SMS under Permissions.</p>}
        <div className="bank-sms-controls">
          <button type="button" className="feather-primary" disabled={busy || !status || !status.requestable} onClick={() => void change(async () => {
          if (status?.enabled) return bankSms.disable();
          if (!privateReady) { await onUnlock(); return bankSms.status(); }
            return bankSms.enable();
          })}>{status?.enabled ? 'Turn off monitoring' : privateReady ? 'Enable monitoring' : 'Set up protected storage'}</button>
          <button type="button" className="feather-secondary" onClick={() => void bankSms.openSettings().catch(() => setError('Could not open Android settings.'))}>Android app settings</button>
        </div>
        <div className="preference-row"><span>Waiting for review</span><strong>{status?.count ?? '—'}</strong></div>
        <div className="bank-sms-controls">
          <button type="button" className="feather-secondary" onClick={onReview}>Open review queue</button>
          <button type="button" className="feather-secondary" disabled={busy || status?.count === 0 && !error} onClick={() => void change(async () => {
            if (!await onClear()) return bankSms.status();
            return bankSms.clear();
          })}>Clear pending suggestions</button>
        </div>
      </>}
      {(!available || status?.supported === false) && <p>You can paste or share a bank alert to LifeOS for review.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
    {history.length > 0 && <section className="bank-sms-settings lifeos-panel" aria-label="Imported transactions">
      <h2 className="type-section-title">Recent imported transactions</h2>
      {history.slice(0, 8).map(row => <button type="button" className="preference-row" key={row.id} onClick={() => onHistory(row)}>
        <span>{row.description || row.category}</span><span>{row.date}</span>
      </button>)}
    </section>}
  </>;
}
