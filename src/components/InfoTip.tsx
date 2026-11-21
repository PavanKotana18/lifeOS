import InfoSheet from './InfoSheet';
import { infoTopics } from './infoTopics';

export default function InfoTip({ label, children }: { label: string; children?: string }) {
  const content = infoTopics[label];
  return <InfoSheet label={label} content={content ?? { definition: children || label, example: '', use: '' }} />;
}
