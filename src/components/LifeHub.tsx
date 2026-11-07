import { ArrowRight, Check, Heart, Lightbulb, Target } from 'lucide-react';

type Props = {
  completedRoutines: number;
  routinesDue: number;
  weeklyCompleted: number;
  weeklyTotal: number;
  activeGoals: number;
  onHabits: () => void;
  onGoals: () => void;
  onInsights: () => void;
};

export default function LifeHub({ completedRoutines, routinesDue, weeklyCompleted, weeklyTotal, activeGoals, onHabits, onGoals, onInsights }: Props) {
  return <section className="life-hub" aria-labelledby="life-hub-title" data-testid="life-hub">
    <header className="life-hub-heading">
      <p className="type-eyebrow">YOUR LIFE</p>
      <h2 id="life-hub-title" className="type-page-title">Life</h2>
      <p className="type-body text-secondary">Small routines and meaningful goals, in one calm place.</p>
    </header>

    <section className="life-rhythm" aria-labelledby="life-rhythm-title">
      <div className="life-rhythm-copy">
        <span className="life-rhythm-icon" aria-hidden="true"><Heart size={19} strokeWidth={1.8} /></span>
        <div>
          <h3 id="life-rhythm-title" className="type-section-title">Your rhythm</h3>
          <p className="type-caption text-secondary">Progress from what you’ve recorded</p>
        </div>
      </div>
      <div className="life-rhythm-stats">
        <div><span className="type-caption text-secondary">Today</span><strong className="type-metric">{completedRoutines}<span> / {routinesDue}</span></strong><span className="type-caption text-secondary">routines checked</span></div>
        {weeklyTotal > 0 && <div><span className="type-caption text-secondary">This week</span><strong className="type-metric">{weeklyCompleted}<span> / {weeklyTotal}</span></strong><span className="type-caption text-secondary">weekly check-ins</span></div>}
        <div><span className="type-caption text-secondary">In motion</span><strong className="type-metric">{activeGoals}</strong><span className="type-caption text-secondary">active goals</span></div>
      </div>
    </section>

    <nav className="life-destination-list" aria-label="Life modules">
      <button type="button" onClick={onHabits} className="life-destination-row">
        <span className="life-destination-icon" aria-hidden="true"><Check size={19} /></span>
        <span className="life-destination-copy"><strong>Habits</strong><span>{routinesDue ? `${completedRoutines} of ${routinesDue} checked today` : 'Your routines and consistency'}</span></span>
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      <button type="button" onClick={onGoals} className="life-destination-row">
        <span className="life-destination-icon" aria-hidden="true"><Target size={19} /></span>
        <span className="life-destination-copy"><strong>Goals</strong><span>{activeGoals ? `${activeGoals} active ${activeGoals === 1 ? 'goal' : 'goals'}` : 'Milestones and personal progress'}</span></span>
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      <button type="button" onClick={onInsights} className="life-destination-row">
        <span className="life-destination-icon" aria-hidden="true"><Lightbulb size={19} /></span>
        <span className="life-destination-copy"><strong>Insights</strong><span>Patterns from your saved records</span></span>
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </nav>
  </section>;
}
