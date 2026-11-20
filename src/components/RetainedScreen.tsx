import React, { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { retainedScreenTransitionState } from '../services/uiNavigation';

type Props = {
  active: boolean;
  retainInactive?: boolean;
  outgoing?: { top: number; left: number; width: number };
  transitionPhase?: 'prepare' | 'running' | null;
  transitionDirection?: 'left' | 'right';
  id: string;
  render: () => ReactNode;
};

/** Mount destinations on first visit; inactive routes are never painted or interactive. */
function RetainedScreen({ active, retainInactive = false, transitionPhase = null, transitionDirection, outgoing, id, render }: Props) {
  const [visited, setVisited] = useState(active);
  const lastPaint = useRef<ReactNode>(null);
  const content = active ? render() : lastPaint.current;
  useLayoutEffect(() => { if (active) lastPaint.current = content; }, [active, content]);
  if (active && !visited) setVisited(true);
  if (!active && !outgoing && (!retainInactive || !visited)) return null;

  const transitionState = retainedScreenTransitionState(active, transitionPhase);

  return <div
    id={id}
    data-lifeos-screen={id}
    data-transition-state={outgoing ? "outgoing" : transitionState}
    data-transition-direction={transitionDirection}
    className="ui-tab-screen alive-route"
    style={outgoing ? { position: "fixed", ...outgoing } : undefined}
    hidden={!active && !outgoing}
    aria-hidden={!active}
    ref={element => element?.toggleAttribute('inert', !active)}
  >
    {content}
  </div>;
}

export default React.memo(RetainedScreen, (previous, next) =>
  previous.id === next.id
  && previous.active === next.active
  && previous.outgoing === next.outgoing
  && previous.retainInactive === next.retainInactive
  && previous.transitionPhase === next.transitionPhase
  && previous.transitionDirection === next.transitionDirection
  && (!next.active || previous.render === next.render),
);
