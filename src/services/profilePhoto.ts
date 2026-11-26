export const PROFILE_PHOTO_SETTING = 'profilePhoto';
export const MAX_PHOTO_LENGTH = 900_000;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const AVATAR_EDGE = 1024;

export function readProfilePhoto(value: unknown): string | null {
  return typeof value === 'string' && value.length <= MAX_PHOTO_LENGTH &&
    /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null;
}

export type PhotoCrop = { x: number; y: number; zoom: number; turns: number };
export const INITIAL_PHOTO_CROP: PhotoCrop = { x: .5, y: .5, zoom: 1, turns: 0 };

export function photoCropGeometry(image: HTMLImageElement, crop: PhotoCrop) {
  const turned = crop.turns % 2 !== 0;
  const width = turned ? image.naturalHeight : image.naturalWidth;
  const height = turned ? image.naturalWidth : image.naturalHeight;
  const edge = Math.min(width, height) / crop.zoom;
  return { width, height, edge };
}

export function clampPhotoCrop(image: HTMLImageElement, crop: PhotoCrop): PhotoCrop {
  const { width, height, edge } = photoCropGeometry(image, crop);
  const clamp = (value: number, bound: number) => Math.max(bound, Math.min(1 - bound, value));
  return { ...crop, x: clamp(crop.x, edge / 2 / width), y: clamp(crop.y, edge / 2 / height) };
}

export function photoObjectUrl(file: File) {
  if (!/^image\/(jpeg|png|webp|avif)$/i.test(file.type) || file.size < 1 || file.size > MAX_SOURCE_BYTES) {
    throw new Error('Choose a JPEG, PNG, WebP or AVIF photo under 12 MB.');
  }
  return URL.createObjectURL(file);
}

/** Draw the EXIF-oriented browser image into a fresh JPEG without source metadata. */
export function encodeProfileCrop(image: HTMLImageElement, input: PhotoCrop): string {
  const crop = clampPhotoCrop(image, input);
  const { width, height, edge } = photoCropGeometry(image, crop);
  const canvas = document.createElement('canvas');
  const output = Math.max(1, Math.min(Math.floor(edge), AVATAR_EDGE));
  for (const size of [output, Math.floor(output * .82), Math.floor(output * .65)].filter(Boolean)) {
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Photo processing is unavailable.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.translate(size / 2, size / 2);
    context.scale(size / edge, size / edge);
    context.translate(width * (.5 - crop.x), height * (.5 - crop.y));
    context.rotate(crop.turns * Math.PI / 2);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    for (const quality of [.92, .86, .78]) {
      const encoded = readProfilePhoto(canvas.toDataURL('image/jpeg', quality));
      if (encoded) return encoded;
    }
  }
  throw new Error('That crop could not be saved within the photo size limit.');
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
