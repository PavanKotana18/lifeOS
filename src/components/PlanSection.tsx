import type { ComponentProps, ReactNode } from 'react';
import InfoTip from './InfoTip';
import LifeDoodle from './LifeDoodle';

export function PlanSectionHeader({ id, title, topic, action, onAdd }: {
  id: string; title: string; topic: string; action: string; onAdd: () => void;
}) {
  return <header className="feather-plan-header">
    <div className="feather-plan-title"><h2 id={id}>{title}</h2><InfoTip label={topic} /></div>
    <button type="button" className="feather-primary" onClick={onAdd}>{action}</button>
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
