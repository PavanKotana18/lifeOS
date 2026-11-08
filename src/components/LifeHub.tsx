import { ArrowRight, Check, ChevronRight, Lightbulb, Plus } from 'lucide-react';

type HabitItem = { id: string; name: string; completedToday: boolean; currentStreak: number };
type GoalItem = { id: string; title: string; progress: number; current: string; target: string; targetDate: string; completedMilestones: number; milestoneCount: number };
type Props = {
  habits: HabitItem[];
  goals: GoalItem[];
  completedRoutines: number;
  routinesDue: number;
  weeklyCompleted: number;
  weeklyTotal: number;
  onCheckIn: (habit: HabitItem) => void;
  onCreateHabit: () => void;
  onCreateGoal: () => void;
  onHabits: () => void;
  onGoals: () => void;
  onInsights: () => void;
};

export default function LifeHub({ habits, goals, completedRoutines, routinesDue, weeklyCompleted, weeklyTotal, onCheckIn, onCreateHabit, onCreateGoal, onHabits, onGoals, onInsights }: Props) {
  const hasRoutineSummary = routinesDue > 0 || weeklyTotal > 0;
  return <section className="life-hub" aria-labelledby="life-hub-title" data-testid="life-hub">
    <header className="life-hub-heading">
      <p className="type-eyebrow">YOUR LIFE</p>
      <h2 id="life-hub-title" className="type-page-title">Life</h2>
      <p className="type-body text-secondary">Habits are things you repeat. Goals are outcomes you build toward.</p>
    </header>

    {hasRoutineSummary && <dl className="life-routine-summary grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Routine progress">
      {routinesDue > 0 && <div className="lifeos-panel rounded-xl p-3"><dt className="type-caption text-secondary">Today</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{completedRoutines} of {routinesDue} check-ins</dd></div>}
      {weeklyTotal > 0 && <div className="lifeos-panel rounded-xl p-3"><dt className="type-caption text-secondary">This week</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{weeklyCompleted} of {weeklyTotal} routines</dd></div>}
    </dl>}

    <section className="life-routine-section" aria-labelledby="life-routines-title">
      <div className="life-section-heading">
        <div><p className="type-eyebrow">DAILY ROUTINES</p><h3 id="life-routines-title" className="type-section-title">Habits</h3><p className="type-caption text-secondary">Small actions you can check in on each day.</p></div>
        <button type="button" onClick={onCreateHabit} className="life-add-button" aria-label="Add a habit"><Plus size={17} aria-hidden="true" /><span>Add</span></button>
      </div>
      {habits.length ? <ul className="life-habit-list">{habits.slice(0, 4).map(habit => <li key={habit.id} className="life-habit-row">
        <button type="button" onClick={() => onCheckIn(habit)} aria-pressed={habit.completedToday} aria-label={`${habit.completedToday ? 'Mark' : 'Complete'} ${habit.name} ${habit.completedToday ? 'incomplete' : 'for today'}`} className={`life-habit-check${habit.completedToday ? ' is-complete' : ''}`}><Check size={17} aria-hidden="true" /></button>
        <span className="life-habit-copy"><strong className={habit.completedToday ? 'is-complete' : ''}>{habit.name}</strong><small>{habit.currentStreak ? `${habit.currentStreak} day streak` : 'Start with one check-in'}</small></span>
      </li>)}</ul> : <div className="life-empty-state"><p>No routines yet.</p><span>Create one that feels useful in your day with Add habit above.</span></div>}
      <button type="button" onClick={onHabits} className="life-section-more">View all habits <ArrowRight size={15} aria-hidden="true" /></button>
    </section>

    <section className="life-goal-section" aria-labelledby="life-goals-title">
      <div className="life-section-heading">
        <div><p className="type-eyebrow">LONGER-TERM OUTCOMES</p><h3 id="life-goals-title" className="type-section-title">Goals</h3><p className="type-caption text-secondary">A result you want to reach, one step at a time.</p></div>
        <button type="button" onClick={onCreateGoal} className="life-add-button" aria-label="Add a goal"><Plus size={17} aria-hidden="true" /><span>Add</span></button>
      </div>
      {goals.length ? <ul className="life-goal-list">{goals.slice(0, 3).map(goal => <li key={goal.id}>
        <button type="button" onClick={onGoals} className="life-goal-card">
          <span className="life-goal-heading"><strong>{goal.title}</strong><span>{goal.progress}%</span></span>
          <span className="life-goal-track" role="progressbar" aria-label={`${goal.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={goal.progress}><span style={{ width: `${goal.progress}%` }} /></span>
          <span className="life-goal-meta">{goal.current} / {goal.target}<span>{goal.completedMilestones} of {goal.milestoneCount} milestones</span></span>
          <span className="life-goal-date">Target · {goal.targetDate}</span>
        </button>
      </li>)}</ul> : <div className="life-empty-state"><p>No goals yet.</p><span>Add a longer-term outcome whenever you’re ready.</span></div>}
      <button type="button" onClick={onGoals} className="life-section-more">All goals and milestones <ArrowRight size={15} aria-hidden="true" /></button>
    </section>

    <button type="button" onClick={onInsights} className="life-insights-link"><Lightbulb size={17} aria-hidden="true" /><span><strong>Life insights</strong><small>Patterns from the records you’ve saved</small></span><ChevronRight size={17} aria-hidden="true" /></button>
  </section>;
}
