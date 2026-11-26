import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function FeatherHeader({ title, id, heading: Heading = 'h2', back, action, focusable }: {
  title: ReactNode;
  id?: string;
  heading?: 'h1' | 'h2' | 'h3';
  back?: { label: string; onClick: () => void; disabled?: boolean };
  action?: ReactNode;
  focusable?: boolean;
}) {
  return <header className="feather-header">
    <div className="feather-header-main">
      {back && <button type="button" aria-label={back.label} onClick={back.onClick} disabled={back.disabled} className="feather-icon-button">
        <ChevronLeft size={22} aria-hidden="true" />
      </button>}
      <Heading id={id} tabIndex={focusable ? -1 : undefined} className="type-page-title">{title}</Heading>
    </div>
    {action && <div className="feather-header-action">{action}</div>}
  </header>;
}
