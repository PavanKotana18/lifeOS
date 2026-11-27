import { useRef, useState } from 'react';
import { policy, previewReceipt, previewTerms } from '../legal/policyPreview';
import { ProfileSettingRow } from './ProfileSettings';

export default function LegalPrivacyCentre({ onData, onNotices }: { onData(): void; onNotices(): void }) {
  const [preview, setPreview] = useState(false);
  return <div className="space-y-4">
    <p className="text-sm text-secondary">Internal review draft {policy.version}. These documents have no effective date. Publisher: {policy.publisher}.</p>
    {policy.documents.map(document => <details key={document.id} className="lifeos-panel rounded-2xl p-4">
      <summary className="min-h-11 content-center cursor-pointer font-semibold">{document.title}</summary>
      <div data-selectable-text className="space-y-3 text-sm leading-6">
        {document.blocks.map((block, index) => block.heading
          ? <h3 key={index} className="font-semibold">{block.heading}</h3>
          : <p key={index}>{block.text}</p>)}
      </div>
    </details>)}
    <section className="lifeos-panel space-y-2 rounded-2xl p-4">
      <h3 className="type-section-title">Your records and privacy rights</h3>
      <p className="text-sm text-secondary">Open Backup &amp; Restore to export or erase supported records on this device. You can edit individual records and remove your profile photo in the app. Requests about any information previously shared with the developer are separate from local deletion.</p>
      <p data-selectable-text className="text-sm text-secondary">A support address is pending. When support opens, share the app version and a short description. Hide private details in screenshots and keep recovery codes, passwords, OTPs and backups private.</p>
      <ProfileSettingRow title="Backup & Restore" onClick={onData} />
      <ProfileSettingRow title="Open-source notices" onClick={onNotices} />
    </section>
    {preview ? <LegalPreview onClose={() => setPreview(false)} /> :
      <button className="feather-secondary" type="button" onClick={() => setPreview(true)}>Preview acceptance with sample data</button>}
  </div>;
}

function LegalPreview({ onClose }: { onClose(): void }) {
  const [step, setStep] = useState<'initial' | 'accepted' | 'updated' | 'declined'>('initial');
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [receipt, setReceipt] = useState<Awaited<ReturnType<typeof previewReceipt>>>();
  const [sample, setSample] = useState(true);
  const [sampleAccess, setSampleAccess] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [status, setStatus] = useState('');
  const pending = useRef(false);
  const requirement = step === 'updated' ? previewTerms.updated : previewTerms.initial;

  const accept = async () => {
    if (pending.current) return;
    pending.current = true;
    setStatus('');
    try {
      setReceipt(await previewReceipt(requirement, adult, terms));
      setStep('accepted');
    } catch { setStatus('The sample receipt could not be created. Try again.'); }
    finally { pending.current = false; }
  };

  return <section className="lifeos-panel space-y-3 rounded-2xl p-4" aria-label="Sample legal acceptance">
    <div className="flex items-center justify-between gap-3">
      <h3 className="type-section-title">Acceptance preview</h3>
      <button type="button" className="feather-secondary" onClick={onClose}>Close</button>
    </div>
    <p className="text-sm text-secondary">This uses invented records and keeps its sample receipt in memory. It cannot save an agreement or change your records.</p>
    {(step === 'initial' || step === 'updated') && <>
      <h4 className="font-semibold">{step === 'updated' ? 'Material update' : 'Before using BusyDoo'}</h4>
      <p className="text-sm text-secondary">{step === 'updated' ? 'Example change: the export section now explains which copies remain after reset. Sample records remain available if you decline.' : 'Review the draft Terms and privacy information above. The privacy notice is available without accepting the Terms.'}</p>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={adult} onChange={event => setAdult(event.target.checked)} />Sample person is 18 or older</label>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} />Sample person agrees to the Terms</label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="feather-primary" disabled={!adult || !terms} onClick={() => void accept()}>Create sample receipt</button>
        <button type="button" className="feather-secondary" onClick={() => { if (!pending.current) setStep('declined'); }}>Decline in preview</button>
      </div>
    </>}
    {step === 'accepted' && <button type="button" className="feather-secondary" onClick={() => {
      setAdult(false); setTerms(false); setStep('updated');
    }}>Preview a material update</button>}
    {receipt && <dl data-selectable-text className="space-y-1 break-all text-sm">
      <div><dt>Sample policy version</dt><dd>{receipt.version}</dd></div>
      <div><dt>Sample content SHA-256</dt><dd>{receipt.contentHash}</dd></div>
      <div><dt>Sample acceptance time</dt><dd>{receipt.acceptedAt}</dd></div>
    </dl>}
    {step === 'declined' && <>
      <p className="text-sm">Existing sample records stay in place. Sample export and deletion remain available after an example unlock.</p>
      {!sampleAccess && <button type="button" className="feather-secondary" onClick={() => setSampleAccess(true)}>Simulate unlock of sample records</button>}
      {sampleAccess && sample && <div className="flex flex-wrap gap-2">
        <button type="button" className="feather-secondary" onClick={() => setShowExport(true)}>Preview sample export</button>
        <button type="button" className="feather-secondary" onClick={() => { setSample(false); setShowExport(false); setStatus('Sample record removed.'); }}>Erase sample record</button>
      </div>}
      {showExport && <pre className="whitespace-pre-wrap text-sm">Sample expense,25.00,INR</pre>}
    </>}
    {status && <p role="status" className="text-sm">{status}</p>}
  </section>;
}
