import React, { useState, type ReactNode, type TransitionEvent } from 'react';
import { retainedScreenTransitionState } from '../services/uiNavigation';

type Props = {
  active: boolean;
  exiting?: boolean;
  transitionPhase?: 'prepare' | 'running' | null;
  exitStart?: { opacity: string; transform: string };
  id: string;
  render: () => ReactNode;
  onExitTransitionEnd?: (event: TransitionEvent<HTMLDivElement>) => void;
};

/** Mount a destination on first visit; keep only the active or exiting screen paintable. */
function RetainedScreen({ active, exiting = false, transitionPhase = null, exitStart, id, render, onExitTransitionEnd }: Props) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  if (!visited && !exiting) return null;

  const transitionState = retainedScreenTransitionState(active, exiting, transitionPhase);

  return <div
    id={id}
    data-lifeos-screen={id}
    data-transition-state={transitionState}
    className="ui-tab-screen"
    hidden={!active && !exiting}
    aria-hidden={!active}
    ref={element => element?.toggleAttribute('inert', !active)}
    style={exiting && transitionPhase === 'prepare' ? { opacity: exitStart?.opacity || 1, transform: exitStart?.transform || 'none' } : undefined}
    onTransitionEnd={exiting ? onExitTransitionEnd : undefined}
  >
    {render()}
  </div>;
}

export default React.memo(RetainedScreen, (previous, next) =>
  previous.id === next.id
  && previous.active === next.active
  && previous.exiting === next.exiting
  && previous.transitionPhase === next.transitionPhase
  && previous.exitStart?.opacity === next.exitStart?.opacity
  && previous.exitStart?.transform === next.exitStart?.transform
  && previous.onExitTransitionEnd === next.onExitTransitionEnd
  && (!next.active || previous.render === next.render),
);
