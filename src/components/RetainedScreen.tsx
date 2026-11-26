import React, { useLayoutEffect, useRef, type ReactNode } from 'react';
import { retainedScreenTransitionState } from '../services/uiNavigation';

type Props = {
  active: boolean;
  retainInactive?: boolean;
  prepare?: boolean;
  outgoing?: { top: number; left: number; width: number };
  transitionPhase?: 'prepare' | 'running' | null;
  transitionDirection?: 'left' | 'right';
  id: string;
  render: () => ReactNode;
};

/** Mount destinations on first visit; inactive routes are never painted or interactive. */
function RetainedScreen({ active, retainInactive = false, prepare = false, transitionPhase = null, transitionDirection, outgoing, id, render }: Props) {
  const visited = useRef(false);
  const lastPaint = useRef<ReactNode>(null);
  const refresh = active || (prepare && !visited.current);
  const content = refresh ? render() : lastPaint.current;
  useLayoutEffect(() => {
    if (refresh) {
      visited.current = true;
      lastPaint.current = content;
    }
  }, [refresh, content]);
  if (!active && !outgoing && !refresh && (!retainInactive || !visited.current)) return null;

  const transitionState = retainedScreenTransitionState(active, transitionPhase);

  return <div
    id={id}
    data-lifeos-screen={id}
    data-transition-state={outgoing ? "outgoing" : transitionState}
    data-transition-direction={transitionDirection}
    className="ui-tab-screen alive-route"
    style={outgoing ? { position: "absolute", ...outgoing } : undefined}
    data-prepared={prepare && retainInactive || undefined}
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
  && previous.prepare === next.prepare
  && previous.transitionPhase === next.transitionPhase
  && previous.transitionDirection === next.transitionDirection
  && (!next.active || previous.render === next.render),
);
