import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ProfileButton, ProfileGroup, ProfileReader } from './ProfileSettings';

const notices = [
  ['Web libraries and Inter font', 'Production web libraries and font attribution.', 'web-and-font.txt'],
  ['Motion', 'Animation library license.', 'motion.txt'],
  ['Android libraries', 'Native framework and dependency notices.', 'android.txt'],
  ['Capacitor Local Notifications', 'Android reminder bridge license.', 'capacitor-local-notifications.txt'],
] as const;

export default function LicenseLibrary() {
  return <>
    {['Web and typography', 'Android'].map((title, index) => <ProfileGroup key={title} title={title}>
      {notices.slice(index * 2, index * 2 + 2).map(([name, detail, path]) =>
        <ProfileReader key={path} title={name} icon={FileText} detail={detail}><LicenseText source={import.meta.env.BASE_URL + 'licenses/' + path} /></ProfileReader>)}
    </ProfileGroup>)}
  </>;
}

function LicenseText({ source }: { source: string }) {
  const [result, setResult] = useState<{ text: string } | { error: true }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(source, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('License unavailable'); return response.text(); })
      .then(text => {
        if (controller.signal.aborted) return;
        setResult(!text.trim() || /^\s*(?:<!doctype|<html)/i.test(text) ? { error: true } : { text });
      },
        () => { if (!controller.signal.aborted) setResult({ error: true }); });
    return () => controller.abort();
  }, [attempt, source]);
  if (!result) return <p role="status">Loading license…</p>;
  if ('error' in result) return <div role="alert"><p>The bundled license could not be opened.</p>
    <ProfileButton onClick={() => { setResult(undefined); setAttempt(value => value + 1); }}>Retry</ProfileButton></div>;
  return <pre>{result.text}</pre>;
}
