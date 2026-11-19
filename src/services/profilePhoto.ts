export const PROFILE_PHOTO_SETTING = 'profilePhoto';
const MAX_PHOTO_LENGTH = 192_000;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const AVATAR_EDGE = 256;

export function readProfilePhoto(value: unknown): string | null {
  return typeof value === 'string' && value.length <= MAX_PHOTO_LENGTH &&
    /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null;
}

/** Re-encode selected pixels locally, discarding original file metadata and path. */
export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|avif)$/i.test(file.type) || file.size < 1 || file.size > MAX_SOURCE_BYTES) {
    throw new Error('Choose a JPEG, PNG, WebP or AVIF photo under 12 MB.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); }
    catch { throw new Error('That photo could not be read. Choose another image.'); }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 50_000_000) {
      throw new Error('That photo is too large to process. Choose a smaller image.');
    }
    const edge = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(edge, AVATAR_EDGE);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Photo processing is unavailable.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, (image.naturalWidth - edge) / 2, (image.naturalHeight - edge) / 2, edge, edge, 0, 0, canvas.width, canvas.height);
    const encoded = readProfilePhoto(canvas.toDataURL('image/jpeg', 0.83));
    if (!encoded) throw new Error('That photo could not be prepared. Choose another image.');
    return encoded;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Keep the chooser callback alive when Android backgrounds the React workspace. */
export function pickProfilePhoto(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/avif';
    input.hidden = true;
    let returnTimer: number | undefined;
    const finish = (file: File | null) => {
      window.clearTimeout(returnTimer);
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
      input.remove();
      resolve(file);
    };
    const onReturn = () => {
      if (document.hidden) return;
      window.clearTimeout(returnTimer);
      returnTimer = window.setTimeout(() => finish(input.files?.[0] ?? null), 1000);
    };
    // Older Android WebViews do not dispatch the file input cancel event.
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    document.body.append(input);
    input.click();
  });
}
