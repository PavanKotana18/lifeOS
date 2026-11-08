import { resolveThemeId, type ThemeId } from './themeCatalog';
export type AppearancePreference = 'dark' | 'light' | 'system';

// Appearance is cosmetic: a stalled preferences store or native plugin must not
// prevent the locked application from rendering. Late results are ignored.
async function readWithDeadline<T>(read: () => Promise<T>, timeoutMs: number): Promise<T | undefined> {
  let cancelTimer = () => {};
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise<undefined>(resolve => {
        const timer = setTimeout(resolve, timeoutMs);
        cancelTimer = () => clearTimeout(timer);
      }),
    ]);
  } catch {
    return undefined;
  } finally {
    cancelTimer();
  }
}

export async function resolveInitialAppearancePreference(
  readPreference: () => Promise<unknown>,
  timeoutMs = 1500
): Promise<AppearancePreference> {
  const value = await readWithDeadline(readPreference, timeoutMs);
  return value === 'dark' || value === 'light' ? value : 'system';
}

/** A cosmetic theme read must not hold the locked app root or authentication flow. */
export async function resolveInitialVisualTheme(
  readTheme: () => Promise<unknown>,
  timeoutMs = 1500,
  cachedTheme: unknown = undefined
): Promise<ThemeId> {
  const value = await readWithDeadline(readTheme, timeoutMs);
  // A slow or malformed IndexedDB read is not evidence that the user's saved
  // cosmetic preference is invalid. Keep the last applied cache instead of
  // replacing it with the default palette during bootstrap.
  const resolved = typeof value === 'string' ? resolveThemeId(value) : undefined;
  return resolved && value === resolved ? resolved : resolveThemeId(cachedTheme);
}

/** Read Android's actual UI mode when available; media queries are the browser fallback. */
export async function resolveInitialSystemDark(
  mediaDark: boolean,
  readNativeAppearance?: () => Promise<{ dark?: unknown }>,
  timeoutMs = 1500
): Promise<boolean> {
  if (readNativeAppearance) {
    const result = await readWithDeadline(readNativeAppearance, timeoutMs);
    if (result && typeof result.dark === 'boolean') return result.dark;
  }
  return mediaDark;
}
