/** Non-secret first-launch preferences only. Never store recovery material here. */
export interface OnboardingJourney {
  version: 1;
  stage: 'name' | 'protection' | 'recovery';
  protection: 'pending' | 'enabled';
  recovery: 'pending' | 'confirmed';
  recoveryName: string;
}
export const INITIAL_ONBOARDING_JOURNEY: OnboardingJourney = {
  version: 1, stage: 'name', protection: 'pending', recovery: 'pending', recoveryName: '',
};
export function normalizeOnboardingJourney(value: unknown): OnboardingJourney {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return { ...INITIAL_ONBOARDING_JOURNEY };
  const saved = value as Partial<OnboardingJourney>;
  // Older optional onboarding values are deliberately normalized back to the
  // required stage. They never count as verified security setup.
  const protection = saved.protection === 'enabled' ? 'enabled' : 'pending';
  const recovery = saved.recovery === 'confirmed' ? 'confirmed' : 'pending';
  const verifiedStage = protection !== 'enabled' ? 'protection' : recovery !== 'confirmed' ? 'recovery' : 'recovery';
  return {
    version: 1,
    stage: saved.stage === 'protection' || saved.stage === 'recovery' ? verifiedStage : 'name',
    protection, recovery,
    recoveryName: typeof saved.recoveryName === 'string' ? saved.recoveryName.trim().slice(0, 64) : '',
  };
}
