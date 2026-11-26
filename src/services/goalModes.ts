import type { Goal, Milestone } from '../types';

type GoalMeasure = Pick<Goal, 'mode' | 'baselineValue' | 'currentValue' | 'targetValue'>;
type GoalMilestone = Pick<Milestone, 'completed'>;

export function isGoalComplete(goal: GoalMeasure, milestones: GoalMilestone[]): boolean {
  const reachedTarget = goal.mode === 'milestone' ? milestones.length > 0
    : goal.mode === 'reduce' ? goal.baselineValue !== undefined && goal.baselineValue > goal.targetValue && goal.currentValue <= goal.targetValue
    : Number(goal.targetValue) > 0 && Number(goal.currentValue) >= Number(goal.targetValue);
  return reachedTarget && milestones.every(item => item.completed);
}

export function goalProgressPercent(goal: GoalMeasure, milestones: GoalMilestone[]): number {
  const baseline = goal.baselineValue ?? 0;
  const [current, target] = goal.mode === 'milestone' ? [milestones.filter(row => row.completed).length, milestones.length]
    : goal.mode === 'reduce' ? [baseline - goal.currentValue, baseline - goal.targetValue]
    : [goal.currentValue, goal.targetValue];
  return target > 0 ? Math.max(0, Math.min(100, Math.round(current / target * 100))) : 0;
}

export function validateGoalMeasure(goal: GoalMeasure): void {
  if (goal.mode !== undefined && !['accumulate', 'reduce', 'milestone', 'frequency'].includes(goal.mode)) {
    throw new Error('Choose a valid goal mode.');
  }
  if (goal.mode === 'reduce' && (!Number.isFinite(goal.baselineValue) || goal.baselineValue! <= goal.targetValue || goal.targetValue < 0)) {
    throw new Error('Enter a starting value above the reduction target.');
  }
  if (goal.mode === 'frequency' && (!Number.isSafeInteger(goal.targetValue) || goal.targetValue <= 0 ||
    !Number.isSafeInteger(goal.currentValue) || goal.currentValue < 0)) {
    throw new Error('Enter whole numbers for sessions.');
  }
}
