import React, { useEffect, useState, type ReactNode } from 'react';

type Props = {
  active: boolean;
  id: string;
  render: () => ReactNode;
};

/** Mount a destination on first visit, then keep it hidden instead of recreating it. */
function RetainedScreen({ active, id, render }: Props) {
  const [visited, setVisited] = useState(active);

  useEffect(() => {
    if (active && !visited) setVisited(true);
  }, [active, visited]);

  if (!active && !visited) return null;

  return <div id={id} data-lifeos-screen={id} hidden={!active} aria-hidden={!active}>
    {render()}
  </div>;
}

export default React.memo(RetainedScreen, (previous, next) =>
  previous.id === next.id && !previous.active && !next.active,
);
