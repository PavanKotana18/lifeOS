import type { ComponentProps, ReactNode } from 'react';
import { CalendarPlus, ListPlus, Plus, Target } from 'lucide-react';
import InfoTip from './InfoTip';
import LifeDoodle from './LifeDoodle';

export function PlanSectionHeader({ id, title, topic, action, onAdd }: {
  id: string; title: string; topic: string; action: 'Add task' | 'Add habit' | 'Add goal'; onAdd: () => void;
}) {
  return <header className="feather-plan-header">
    <div className="feather-plan-title"><h2 id={id}>{title}</h2><InfoTip label={topic} /></div>
    <button type="button" className="feather-plan-create" aria-label={action} title={action} onClick={onAdd}>
      {action === 'Add task' ? <ListPlus size={23} strokeWidth={1.8} aria-hidden="true" />
        : action === 'Add habit' ? <CalendarPlus size={23} strokeWidth={1.8} aria-hidden="true" />
        : <span className="feather-plan-goal-icon" aria-hidden="true"><Target size={23} strokeWidth={1.8} /><Plus size={12} strokeWidth={2} /></span>}
    </button>
  </header>;
}

export function PlanSectionEmpty({ illustration, title, children }: {
  illustration: ComponentProps<typeof LifeDoodle>['kind']; title: string; children?: ReactNode;
}) {
  return <div className="feather-plan-empty">
    <LifeDoodle kind={illustration} />
    <div><strong>{title}</strong>{children}</div>
  </div>;
}
