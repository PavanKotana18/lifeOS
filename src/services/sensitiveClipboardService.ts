import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeSensitiveClipboard {
  copyRecoveryCode(options: { code: string }): Promise<{ copied: boolean }>;
  clearRecoveryCodeIfMatches(options: { code: string }): Promise<{ cleared: boolean }>;
}

const nativeClipboard = registerPlugin<NativeSensitiveClipboard>('LifeOSClipboard');

export async function copyRecoveryCode(code: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) throw new Error('Recovery code could not be copied.');
  if (Capacitor.getPlatform() === 'android') {
    if (!Capacitor.isPluginAvailable('LifeOSClipboard')) throw new Error('Recovery code could not be copied.');
    const result = await nativeClipboard.copyRecoveryCode({ code });
    if (result.copied !== true) throw new Error('Recovery code could not be copied.');
    return;
  }
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable. Select and copy the displayed code instead.');
  await navigator.clipboard.writeText(code);
}

export async function clearRecoveryCodeFromClipboard(code: string): Promise<void> {
  if (Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LifeOSClipboard')) {
    try { await nativeClipboard.clearRecoveryCodeIfMatches({ code }); } catch { /* Best effort; never affect recovery confirmation. */ }
    return;
  }
  // Browser clipboard access may be denied or unavailable. Only clear the
  // active clipboard when it still contains this exact recovery code.
  try {
    if (navigator.clipboard?.readText && navigator.clipboard?.writeText &&
      await navigator.clipboard.readText() === code) await navigator.clipboard.writeText('');
  } catch { /* Best effort; never affect recovery confirmation. */ }
}
