import InfoSheet from './InfoSheet';
export type { InfoContent } from './InfoSheet';
import { infoTopics } from './infoTopics';

export default function InfoTip({ label, children, triggerText }: { label: string; children?: string; triggerText?: string }) {
  const content = infoTopics[label];
  return <InfoSheet label={label} triggerText={triggerText} content={{
    example: '',
    use: '',
    ...content,
    definition: children || content?.definition || label,
  }} />;
}
