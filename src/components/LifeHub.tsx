import { ArrowRight, Check, ChevronRight, Lightbulb, Plus } from 'lucide-react';

type HabitItem = { id: string; name: string; completedToday: boolean; currentStreak: number };
type GoalItem = { id: string; title: string; progress: number; current: string; target: string; targetDate: string; completedMilestones: number; milestoneCount: number };
type Props = {
  habits: HabitItem[]; goals: GoalItem[];
  completedRoutines: number; routinesDue: number; weeklyCompleted: number; weeklyTotal: number;
  onCheckIn: (habit: HabitItem) => void; onCreateHabit: () => void; onCreateGoal: () => void;
  onHabits: () => void; onGoals: () => void; onInsights: () => void;
  onOpenGoal?: (id: string) => void; onOpenHabit?: (id: string) => void;
};

export function displayGoalProgress(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

export default function LifeHub({ habits, goals, completedRoutines, routinesDue, weeklyCompleted, weeklyTotal, onCheckIn, onCreateHabit, onCreateGoal, onHabits, onGoals, onInsights, onOpenGoal, onOpenHabit }: Props) {
  const hasRoutineSummary = routinesDue > 0 || weeklyTotal > 0;
  const empty = !habits.length && !goals.length;
  return <section className="life-hub life-workspace" aria-labelledby="life-hub-title" data-testid="life-hub">
    <header className="life-hub-heading"><p className="type-eyebrow">YOUR LIFE</p><h2 id="life-hub-title" className="type-page-title">Life</h2><p className="type-body text-secondary">Habits are things you repeat. Goals are outcomes you build toward.</p></header>
    <nav className="life-context-nav" aria-label="Explore Life"><button type="button" onClick={onHabits}>Habits<span>{habits.length}</span></button><button type="button" onClick={onGoals}>Goals<span>{goals.length}</span></button><button type="button" onClick={onInsights}><Lightbulb size={15} aria-hidden="true" />Insights<ChevronRight size={15} aria-hidden="true" /></button></nav>
    {hasRoutineSummary && <section className="life-rhythm life-rhythm-compact" aria-labelledby="life-rhythm-title"><div><p className="type-eyebrow">YOUR RHYTHM</p><h3 id="life-rhythm-title">Your routine, at a glance</h3></div><dl className="life-rhythm-stats" aria-label="Routine progress">{routinesDue > 0 && <div><dt className="type-caption text-secondary">Today</dt><dd>{completedRoutines} of {routinesDue} check-ins</dd></div>}{weeklyTotal > 0 && <div><dt className="type-caption text-secondary">This week</dt><dd>{weeklyCompleted} of {weeklyTotal} routines</dd></div>}</dl></section>}
    {empty ? <section className="life-combined-empty" aria-labelledby="life-start-title"><span className="life-empty-symbol" aria-hidden="true"><Plus size={24} /></span><h3 id="life-start-title">Make room for what matters</h3><p>No routines yet. No goals yet.</p><p>Start with one small habit or a goal you want to work toward.</p><div><button type="button" onClick={onCreateHabit} className="lifeos-accent-button">Add a habit</button><button type="button" onClick={onCreateGoal} className="life-add-button">Add a goal</button></div><button type="button" onClick={onGoals} className="life-section-more">All goals and milestones<ArrowRight size={15} aria-hidden="true" /></button></section> : <div className="life-workspace-sections">
      <section className="life-routine-section" aria-labelledby="life-routines-title"><div className="life-section-heading"><div><p className="type-eyebrow">DAILY ROUTINES</p><h3 id="life-routines-title" className="type-section-title">Habits</h3></div><button type="button" onClick={onCreateHabit} className="life-add-button" aria-label="Add a habit"><Plus size={17} aria-hidden="true" /><span>Add</span></button></div>
        {habits.length ? <ul className="life-habit-list" aria-label="Your habits">{habits.slice(0, 4).map(habit => <li key={habit.id} className="life-habit-row"><button type="button" onClick={() => onCheckIn(habit)} aria-pressed={habit.completedToday} aria-label={`${habit.completedToday ? 'Mark' : 'Complete'} ${habit.name} ${habit.completedToday ? 'incomplete' : 'for today'}`} className={`life-habit-check${habit.completedToday ? ' is-complete' : ''}`}><Check size={17} aria-hidden="true" /></button><button type="button" onClick={() => onOpenHabit ? onOpenHabit(habit.id) : onHabits()} className="life-habit-copy life-habit-detail"><strong className={habit.completedToday ? 'is-complete' : ''}>{habit.name}</strong><small>{habit.currentStreak ? `${habit.currentStreak} day streak` : 'Start with one check-in'}</small><ChevronRight size={15} aria-hidden="true" /></button></li>)}</ul> : <div className="life-empty-state"><p>No routines yet.</p><span>Start with one small habit. Use Add above to create it.</span></div>}
        <button type="button" onClick={onHabits} className="life-section-more">View all habits <ArrowRight size={15} aria-hidden="true" /></button>
      </section>
      <section className="life-goal-section" aria-labelledby="life-goals-title"><div className="life-section-heading"><div><p className="type-eyebrow">LONGER-TERM OUTCOMES</p><h3 id="life-goals-title" className="type-section-title">Goals</h3></div><button type="button" onClick={onCreateGoal} className="life-add-button" aria-label="Add a goal"><Plus size={17} aria-hidden="true" /><span>Add</span></button></div>
        {goals.length ? <ul className="life-goal-list" aria-label="Goals in progress">{goals.slice(0, 3).map(goal => {
          const progress = displayGoalProgress(goal.progress);
          return <li key={goal.id}><button type="button" onClick={() => onOpenGoal ? onOpenGoal(goal.id) : onGoals()} className="life-goal-card"><span className="life-goal-heading"><strong>{goal.title}</strong><span>{progress}%</span></span><span className="life-goal-track" role="progressbar" aria-label={`${goal.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></span><span className="life-goal-meta"><span>{goal.current} of {goal.target}</span><span>{goal.milestoneCount ? `${goal.completedMilestones} of ${goal.milestoneCount} milestones` : 'No milestones yet'}</span></span>{goal.targetDate && <span className="life-goal-date">Target {goal.targetDate}</span>}</button></li>;
        })}</ul> : <div className="life-empty-state"><p>No goals yet.</p><span>Add a longer-term outcome whenever you are ready.</span></div>}
        <button type="button" onClick={onGoals} className="life-section-more">All goals and milestones <ArrowRight size={15} aria-hidden="true" /></button>
      </section>
    </div>}
    <button type="button" onClick={onInsights} className="life-insights-link"><Lightbulb size={17} aria-hidden="true" /><span><strong>Life insights</strong><small>{empty ? 'Patterns appear as you save check-ins and progress' : 'Explore your check-ins and goal progress'}</small></span><ChevronRight size={17} aria-hidden="true" /></button>
  </section>;
}
