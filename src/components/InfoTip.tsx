import InfoSheet from './InfoSheet';
export type { InfoContent } from './InfoSheet';
import { infoTopics } from './infoTopics';

export default function InfoTip({ label, children, triggerText, variant }: { label: string; children?: string; triggerText?: string; variant?: 'profile' }) {
  const content = infoTopics[label];
  return <InfoSheet variant={variant} label={label} triggerText={triggerText} content={{
    example: '',
    use: '',
    ...content,
    definition: children || content?.definition || label,
  }} />;
}
