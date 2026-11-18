import { Check } from 'lucide-react';

export default function RecoveryProgress({ step }: { step: 1 | 2 | 3 }) {
  const labels = ['Prepare', 'Save', 'Complete'];
  return <ol className="initial-setup-progress mb-4 justify-start" aria-label="Recovery progress">
    {labels.slice(0, step).map((label, index) => <li key={label} aria-current={index + 1 === step ? 'step' : undefined} data-complete={index + 1 < step}>
      <span>{index + 1 < step ? <Check size={12} aria-label="Done" /> : index + 1}</span>{label}
    </li>)}
  </ol>;
}
