/** Non-secret first-launch preferences only. Never store recovery material here. */
export interface OnboardingJourney {
  version: 2;
  stage: 'name' | 'notifications' | 'protection' | 'recovery';
  protection: 'pending' | 'enabled';
  recovery: 'pending' | 'confirmed';
  recoveryName: string;
}
export const INITIAL_ONBOARDING_JOURNEY: OnboardingJourney = {
  version: 2, stage: 'name', protection: 'pending', recovery: 'pending', recoveryName: '',
};
export function normalizeOnboardingJourney(value: unknown): OnboardingJourney {
  if (!value || typeof value !== 'object' || !('version' in value) || (value.version !== 1 && value.version !== 2)) return { ...INITIAL_ONBOARDING_JOURNEY };
  const saved = value as Partial<OnboardingJourney>;
  // Older optional onboarding values are deliberately normalized back to the
  // required stage. They never count as verified security setup.
  const protection = saved.protection === 'enabled' ? 'enabled' : 'pending';
  const recovery = saved.recovery === 'confirmed' ? 'confirmed' : 'pending';
  const verifiedStage = protection === 'enabled' ? 'recovery' : 'protection';
  return {
    version: 2,
    stage: saved.stage === 'notifications' ? 'notifications' : saved.stage === 'protection' || saved.stage === 'recovery' ? verifiedStage : 'name',
    protection, recovery,
    recoveryName: typeof saved.recoveryName === 'string' ? saved.recoveryName.trim().slice(0, 64) : '',
  };
}

// Preserve legacy biometric and recovery numbers. Completed installs bypass resume entirely.
export const ONBOARDING_NOTIFICATIONS_STEP = 3;

export function resumeOnboardingStep(value: number, previousVersion: unknown): number {
  if (value === 2) return 2;
  if (value === 1) return previousVersion === 2 ? 1 : ONBOARDING_NOTIFICATIONS_STEP;
  if (value === ONBOARDING_NOTIFICATIONS_STEP) return ONBOARDING_NOTIFICATIONS_STEP;
  return 0;
}
