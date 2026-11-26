type Doodle =
  | 'empty-tasks' | 'tasks-done'
  | 'first-habit' | 'habit-streak'
  | 'first-goal' | 'goal-milestone'
  | 'savings-milestone' | 'empty-scheduled' | 'welcome';

const artwork: Record<Doodle, { shape: string; ink: string; accent: string }> = {
  'empty-tasks': {
    shape: 'M30 15 Q25 15 25 21 L25 56 Q25 62 31 62 H66 Q72 62 72 56 V21 Q72 15 66 15 Z',
    ink: 'M35 29 H48 M35 38 H58 M35 47 H51 M56 57 L74 39 Q77 36 80 39 Q83 42 80 45 L62 63 L55 65 Z',
    accent: 'M80 19 L82 12 M85 24 L93 23',
  },
  'tasks-done': {
    shape: 'M35 18 Q48 9 61 18 L71 26 Q80 36 72 50 L64 61 Q51 76 36 62 L24 49 Q15 33 35 18 Z',
    ink: 'M32 41 Q39 44 44 52 Q54 38 68 31',
    accent: 'M75 19 L79 13 M81 26 L89 25 M21 59 L17 65',
  },
  'first-habit': {
    shape: 'M28 50 Q49 43 71 50 L66 65 Q62 72 49 72 Q36 72 33 64 Z',
    ink: 'M50 52 Q49 32 62 20 M51 38 Q37 35 35 25 Q47 23 51 36 M56 30 Q60 15 74 15 Q72 27 56 30',
    accent: 'M22 35 L18 31 M78 36 L85 32 M50 14 L49 9',
  },
  'habit-streak': {
    shape: 'M48 70 Q29 62 26 47 Q44 45 48 61 Q50 43 68 39 Q68 60 48 70 Z',
    ink: 'M49 70 Q50 48 50 28 M42 36 Q36 32 36 23 Q45 24 49 32 M52 39 Q58 30 66 31',
    accent: 'M50 7 V18 M44.5 12.5 H55.5 M72 20 L76 17 M25 30 L20 27',
  },
  'first-goal': {
    shape: 'M20 59 Q25 56 32 45 L41 33 Q46 25 51 32 L63 48 L69 42 Q73 39 78 46 L85 59 Q87 63 82 63 H24 Q18 63 20 59 Z',
    ink: 'M47 40 V14 Q52 11 61 15 L65 18 L61 22 Q54 18 47 22 M37 61 Q46 55 46 48',
    accent: 'M73 25 L78 23 M29 28 L24 25',
  },
  'goal-milestone': {
    shape: 'M47 13 C62 10 77 23 77 39 C76 56 66 66 50 68 C33 68 22 55 22 40 C22 24 33 16 47 13 Z',
    ink: 'M35 42 L44 50 L62 31 M52 19 Q59 20 65 25',
    accent: 'M16 24 L12 20 M83 24 L90 19 M85 45 H93 M18 56 L13 61',
  },
  'savings-milestone': {
    shape: 'M28 36 H72 L69 59 Q67 70 50 70 Q33 70 31 59 Z M27 35 Q50 28 73 35 Q50 43 27 35 Z',
    ink: 'M61 22 A11 11 0 1 1 39 22 A11 11 0 0 1 61 22 M50 17 V26 M44 55 Q50 59 56 55',
    accent: 'M75 21 L80 16 M22 22 L16 18 M79 38 H85',
  },
  'empty-scheduled': {
    shape: 'M27 20 Q22 20 22 26 V59 Q22 65 28 65 H71 Q77 65 77 59 V26 Q77 20 71 20 Z',
    ink: 'M22 33 H77 M35 15 V26 M64 15 V26 M34 44 H47 M34 52 H40 M62 47 V53 L66 56 M62 63 A11 11 0 1 0 62 41 A11 11 0 1 0 62 63',
    accent: 'M83 17 L88 13 M85 25 H92',
  },
  welcome: {
    shape: 'M22 56 Q21 40 29 31 Q38 21 49 21 Q62 21 70 34 Q77 42 76 56 Q75 66 65 66 H33 Q23 66 22 56 Z',
    ink: 'M32 61 Q42 49 50 51 Q57 52 67 62 M50 43 A9 9 0 1 0 50 25 A9 9 0 1 0 50 43 M50 11 V7',
    accent: 'M23 25 L16 20 M77 26 L84 21 M17 53 H10 M82 51 H90',
  },
};

export default function LifeDoodle({ kind, compact = false, animate = true }: {
  kind: Doodle;
  compact?: boolean;
  animate?: boolean;
}) {
  const { shape, ink, accent } = artwork[kind];
  return <svg className="alive-doodle" data-alive-doodle={kind} data-compact={compact} data-animate={animate}
    viewBox="0 0 100 80" width={compact ? 34 : 82} height={compact ? 28 : 66}
    aria-hidden="true" focusable="false">
    <path className="alive-doodle-wash" d={shape} />
    <path className="alive-doodle-ink" pathLength="1" d={ink} />
    <path className="alive-doodle-accent" d={accent} />
  </svg>;
}
