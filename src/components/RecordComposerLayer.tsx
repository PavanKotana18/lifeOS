import { useIsPresent } from 'motion/react';
import type { ReactNode } from 'react';

export function RecordComposerLayer({ full, dismiss, children }: {
  full: boolean;
  dismiss: () => void;
  children: ReactNode;
}) {
  const present = useIsPresent();
  return <div
    className="ui-sheet-backdrop record-composer-backdrop"
    data-full-composer={full}
    data-exiting={!present}
    aria-hidden={!present || undefined}
    ref={node => node?.toggleAttribute('inert', !present)}
    onMouseDown={event => { if (event.target === event.currentTarget) dismiss(); }}
  >{children}</div>;
}
