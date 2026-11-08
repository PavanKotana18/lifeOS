import { ArrowRight, Check, ChevronRight, Lightbulb, Plus, Target } from 'lucide-react';

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
  return <section className="life-hub" aria-labelledby="life-hub-title" data-testid="life-hub">
    <header className="life-hub-heading">
      <p className="type-eyebrow">YOUR LIFE</p>
      <h2 id="life-hub-title" className="type-page-title">Life</h2>
      <p className="type-body text-secondary">Daily routines and longer-term goals, together.</p>
    </header>

    <section className="life-routine-section" aria-labelledby="life-routines-title">
      <div className="life-section-heading">
        <div><p className="type-eyebrow">SMALL, REPEATABLE STEPS</p><h3 id="life-routines-title" className="type-section-title">Habits</h3><p className="type-caption text-secondary">{routinesDue ? `${completedRoutines} of ${routinesDue} checked today` : 'Pick up a routine when it fits your day.'}{weeklyTotal > 0 ? ` · ${weeklyCompleted} of ${weeklyTotal} this week` : ''}</p></div>
        <button type="button" onClick={onCreateHabit} className="life-add-button" aria-label="Add a habit"><Plus size={17} aria-hidden="true" /><span>Add</span></button>
      </div>
      {habits.length ? <ul className="life-habit-list">{habits.slice(0, 4).map(habit => <li key={habit.id} className="life-habit-row">
        <button type="button" onClick={() => onCheckIn(habit)} aria-pressed={habit.completedToday} aria-label={`${habit.completedToday ? 'Mark' : 'Complete'} ${habit.name} ${habit.completedToday ? 'incomplete' : 'for today'}`} className={`life-habit-check${habit.completedToday ? ' is-complete' : ''}`}><Check size={17} aria-hidden="true" /></button>
        <span className="life-habit-copy"><strong className={habit.completedToday ? 'is-complete' : ''}>{habit.name}</strong><small>{habit.currentStreak ? `${habit.currentStreak} day streak` : 'Start with one check-in'}</small></span>
        <ChevronRight size={16} aria-hidden="true" className="life-row-chevron" />
      </li>)}</ul> : <div className="life-empty-state"><p>No routines yet. Create one that feels useful in your day.</p><button type="button" onClick={onCreateHabit} className="lifeos-accent-button min-h-11 rounded-xl px-4 text-xs font-semibold">Create a habit</button></div>}
      {habits.length > 4 && <button type="button" onClick={onHabits} className="life-section-more">All habits <ArrowRight size={15} aria-hidden="true" /></button>}
    </section>

    <section className="life-goal-section" aria-labelledby="life-goals-title">
      <div className="life-section-heading">
        <div><p className="type-eyebrow">LONGER-TERM OUTCOMES</p><h3 id="life-goals-title" className="type-section-title">Goals</h3><p className="type-caption text-secondary">{goals.length ? `${goals.length} active ${goals.length === 1 ? 'goal' : 'goals'}` : 'Move forward at a pace that works for you.'}</p></div>
        <button type="button" onClick={onCreateGoal} className="life-add-button" aria-label="Add a goal"><Plus size={17} aria-hidden="true" /><span>Add</span></button>
      </div>
      {goals.length ? <ul className="life-goal-list">{goals.slice(0, 3).map(goal => <li key={goal.id}>
        <button type="button" onClick={onGoals} className="life-goal-card">
          <span className="life-goal-heading"><strong>{goal.title}</strong><span>{goal.progress}%</span></span>
          <span className="life-goal-track" role="progressbar" aria-label={`${goal.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={goal.progress}><span style={{ width: `${goal.progress}%` }} /></span>
          <span className="life-goal-meta">{goal.current} / {goal.target}<span>{goal.completedMilestones} of {goal.milestoneCount} milestones</span></span>
          <span className="life-goal-date">Target · {goal.targetDate}</span>
        </button>
      </li>)}</ul> : <div className="life-empty-state"><p>Keep a longer-term outcome here when you’re ready.</p><button type="button" onClick={onCreateGoal} className="lifeos-accent-button min-h-11 rounded-xl px-4 text-xs font-semibold">Create a goal</button></div>}
      <button type="button" onClick={onGoals} className="life-section-more">All goals and milestones <ArrowRight size={15} aria-hidden="true" /></button>
    </section>

    <button type="button" onClick={onInsights} className="life-insights-link"><Lightbulb size={17} aria-hidden="true" /><span><strong>Life insights</strong><small>Patterns from the records you’ve saved</small></span><ChevronRight size={17} aria-hidden="true" /></button>
  </section>;
}
