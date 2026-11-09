/** Recovery codes are 32-byte base64url values without padding (43 characters). */
const RECOVERY_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Permit harmless whitespace introduced by clipboard formatting, while leaving
 * every non-whitespace character subject to the native recovery format check.
 */
export function normalizeRecoveryCodeInput(value: string): string {
  const normalized = value.replace(/\s/gu, '');
  return RECOVERY_CODE_PATTERN.test(normalized) ? normalized : '';
}

export function matchesRecoveryCode(input: string, expected: string): boolean {
  return RECOVERY_CODE_PATTERN.test(expected) && normalizeRecoveryCodeInput(input) === expected;
}
