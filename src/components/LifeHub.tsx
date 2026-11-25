import { Check, Lightbulb, Plus } from 'lucide-react';

import { formatHabitQuantity } from '../services/userPreferences';
import InfoTip from './InfoTip';

type HabitItem = { id: string; name: string; completedToday: boolean; currentStreak: number; quantity?: number; targetPerDay?: number; quantityUnit?: string };
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
  return <section className="life-hub life-workspace" aria-label="Routines and goals" data-testid="life-hub">
    <header className="life-hub-heading flex items-center justify-between gap-3"><button type="button" className="lifeos-input flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold" onClick={onInsights}><Lightbulb size={16} aria-hidden="true" />Insights</button></header>
    {hasRoutineSummary && <section className="life-rhythm life-rhythm-compact" aria-labelledby="life-rhythm-title"><div className="flex items-center"><h3 id="life-rhythm-title">Your progress</h3><InfoTip label="Routine progress">Quantity habits count when they reach their daily target.</InfoTip></div><dl className="life-rhythm-stats" aria-label="Routine progress">{routinesDue > 0 && <div><dt className="type-caption text-secondary">Today</dt><dd>{completedRoutines} of {routinesDue} check-ins</dd></div>}{weeklyTotal > 0 && <div><dt className="type-caption text-secondary">This week</dt><dd>{weeklyCompleted} of {weeklyTotal} routines</dd></div>}</dl>{routinesDue > 0 && <progress className="life-daily-progress" aria-label="Daily check-ins" value={Math.min(completedRoutines, routinesDue)} max={routinesDue} />}</section>}
    {empty ? <section className="life-combined-empty" aria-labelledby="life-start-title"><span className="life-empty-symbol" aria-hidden="true"><Plus size={24} /></span><h3 id="life-start-title">Start tracking</h3><p>No routines yet. No goals yet.</p><div><button type="button" onClick={onCreateHabit} className="lifeos-accent-button">Add a habit</button><button type="button" onClick={onCreateGoal} className="life-add-button">Add a goal</button></div></section> : <div className="life-workspace-sections">
      <section className="life-routine-section" aria-labelledby="life-routines-title"><div className="life-section-heading"><div><h3 id="life-routines-title" className="type-section-title"><button type="button" className="min-h-11 text-left" onClick={onHabits}>Habits</button></h3></div><button type="button" onClick={onCreateHabit} className="life-add-button" aria-label="Add a habit"><Plus size={17} aria-hidden="true" /><span>Add</span></button></div>
        {habits.length ? <ul className="life-habit-list" aria-label="Your habits">{habits.slice(0, 4).map(habit => <li key={habit.id} className="life-habit-row"><button type="button" onClick={() => onCheckIn(habit)} aria-pressed={habit.completedToday} aria-label={habit.targetPerDay ? `Add one ${habit.quantityUnit || 'item'} to ${habit.name}` : `${habit.completedToday ? 'Mark' : 'Complete'} ${habit.name} ${habit.completedToday ? 'incomplete' : 'for today'}`} className={`life-habit-check${habit.completedToday ? ' is-complete' : ''}`}>{habit.targetPerDay ? <Plus size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}</button><button type="button" onClick={() => onOpenHabit ? onOpenHabit(habit.id) : onHabits()} className="life-habit-copy life-habit-detail"><strong className={habit.completedToday ? 'is-complete' : ''}>{habit.name}</strong><small>{habit.targetPerDay ? (habit.quantityUnit ? `${formatHabitQuantity(habit.quantity ?? 0, habit.quantityUnit)} / ${formatHabitQuantity(habit.targetPerDay, habit.quantityUnit)}` : `${formatHabitQuantity(habit.quantity ?? 0)} · target ${formatHabitQuantity(habit.targetPerDay, 'item')}`) : habit.currentStreak ? `${habit.currentStreak} day streak` : ''}</small></button></li>)}</ul> : <div className="life-empty-state"><p>No routines yet.</p></div>}
      </section>
      <section className="life-goal-section" aria-labelledby="life-goals-title"><div className="life-section-heading"><div><h3 id="life-goals-title" className="type-section-title"><button type="button" className="min-h-11 text-left" onClick={onGoals}>Goals</button></h3></div><div className="flex items-center gap-2"><InfoTip label="Goal progress">The percentage follows saved numeric progress. Milestone completion is shown separately, and progress display stops at 100%.</InfoTip><button type="button" onClick={onCreateGoal} className="life-add-button" aria-label="Add a goal"><Plus size={17} aria-hidden="true" /><span>Add</span></button></div></div>
        {goals.length ? <ul className="life-goal-list" aria-label="Goals in progress">{goals.slice(0, 3).map(goal => {
          const progress = displayGoalProgress(goal.progress);
          return <li key={goal.id}><button type="button" onClick={() => onOpenGoal ? onOpenGoal(goal.id) : onGoals()} className="life-goal-card"><span className="life-goal-heading"><strong>{goal.title}</strong><span>{progress}%</span></span><span className="life-goal-track" role="progressbar" aria-label={`${goal.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></span><span className="life-goal-meta"><span>{goal.current} of {goal.target}</span><span>{goal.milestoneCount ? `${goal.completedMilestones} of ${goal.milestoneCount} milestones` : ''}</span></span>{goal.targetDate && <span className="life-goal-date">Target {goal.targetDate}</span>}</button></li>;
        })}</ul> : <div className="life-empty-state"><p>No goals yet.</p></div>}
      </section>
    </div>}
  </section>;
}
