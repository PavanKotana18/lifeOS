import { Check } from 'lucide-react';

export default function RecoveryProgress({ step, profile = false, labels = ['Prepare', 'Save', 'Complete'] }: {
  step: 1 | 2 | 3; profile?: boolean; labels?: readonly string[];
}) {
  return <ol className={profile ? 'profile-steps' : 'initial-setup-progress mb-4 justify-start'} aria-label="Recovery progress">
    {(profile ? labels : labels.slice(0, step)).map((label, index) =>
      <li key={label} aria-current={index + 1 === step ? 'step' : undefined} data-complete={index + 1 < step}>
        <span>{index + 1 < step ? <Check size={13} aria-label="Done" /> : index + 1}</span>{label}
      </li>)}
  </ol>;
}
