/** Non-secret first-launch preferences only. Never store recovery material here. */
export interface OnboardingJourney {
  version: 1;
  stage: 'name' | 'protection' | 'recovery';
  protection: 'pending' | 'enabled' | 'skipped';
  recovery: 'pending' | 'named' | 'skipped';
  recoveryName: string;
}
export const INITIAL_ONBOARDING_JOURNEY: OnboardingJourney = {
  version: 1, stage: 'name', protection: 'pending', recovery: 'pending', recoveryName: '',
};
export function normalizeOnboardingJourney(value: unknown): OnboardingJourney {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return { ...INITIAL_ONBOARDING_JOURNEY };
  const saved = value as Partial<OnboardingJourney>;
  const protection = saved.protection === 'enabled' || saved.protection === 'skipped' ? saved.protection : 'pending';
  const recovery = saved.recovery === 'named' || saved.recovery === 'skipped' ? saved.recovery : 'pending';
  return {
    version: 1,
    stage: saved.stage === 'protection' || saved.stage === 'recovery' ? saved.stage : 'name',
    protection, recovery,
    recoveryName: typeof saved.recoveryName === 'string' ? saved.recoveryName.trim().slice(0, 64) : '',
  };
}
