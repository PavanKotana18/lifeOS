/** Read Android's actual UI mode when available; media queries are the browser fallback. */
export async function resolveInitialSystemDark(
  mediaDark: boolean,
  readNativeAppearance?: () => Promise<{ dark?: unknown }>
): Promise<boolean> {
  if (readNativeAppearance) {
    try {
      const result = await readNativeAppearance();
      if (typeof result.dark === 'boolean') return result.dark;
    } catch {
      // The WebView media query remains a safe fallback if the native bridge is unavailable.
    }
  }
  return mediaDark;
}
