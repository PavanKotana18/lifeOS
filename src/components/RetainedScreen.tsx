import React, { useState, type ReactNode, type TransitionEvent } from 'react';
import { retainedScreenTransitionState } from '../services/uiNavigation';

type Props = {
  active: boolean;
  retainInactive?: boolean;
  transitionPhase?: 'prepare' | 'running' | null;
  transitionDirection?: 'left' | 'right';
  id: string;
  render: () => ReactNode;
  onTransitionEnd?: (event: TransitionEvent<HTMLDivElement>) => void;
};

/** Mount destinations on first visit; inactive routes are never painted or interactive. */
function RetainedScreen({ active, retainInactive = false, transitionPhase = null, transitionDirection, id, render, onTransitionEnd }: Props) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  if (!active && (!retainInactive || !visited)) return null;

  const transitionState = retainedScreenTransitionState(active, transitionPhase);

  return <div
    id={id}
    data-lifeos-screen={id}
    data-transition-state={transitionState}
    data-transition-direction={transitionDirection}
    className="ui-tab-screen"
    hidden={!active}
    aria-hidden={!active}
    ref={element => element?.toggleAttribute('inert', !active)}
    onTransitionEnd={active ? onTransitionEnd : undefined}
  >
    {render()}
  </div>;
}

export default React.memo(RetainedScreen, (previous, next) =>
  previous.id === next.id
  && previous.active === next.active
  && previous.retainInactive === next.retainInactive
  && previous.transitionPhase === next.transitionPhase
  && previous.transitionDirection === next.transitionDirection
  && previous.onTransitionEnd === next.onTransitionEnd
  && (!next.active || previous.render === next.render),
);
