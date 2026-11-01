import { Capacitor, registerPlugin } from '@capacitor/core';

export type BackupExportResult =
  | { status: 'saved'; bytesWritten: number }
  | { status: 'cancelled' }
  | { status: 'download_started' };

interface NativeBackupPlugin {
  saveFile(options: {
    contents: string;
    fileName: string;
    mimeType: 'application/json' | 'text/csv';
  }): Promise<{
    saved: boolean;
    cancelled: boolean;
    bytesWritten?: number;
  }>;
}

const nativeBackup = registerPlugin<NativeBackupPlugin>('LifeOSBackup');

export async function exportBackupFile(options: {
  contents: string;
  fileName: string;
  mimeType: 'application/json' | 'text/csv';
}): Promise<BackupExportResult> {
  if (typeof options.contents !== 'string' || !options.fileName.trim()) {
    throw new Error('Invalid backup export content or filename.');
  }

  if (Capacitor.getPlatform() === 'android') {
    if (!Capacitor.isPluginAvailable('LifeOSBackup')) {
      throw new Error('Native LifeOS backup export is unavailable.');
    }

    const result = await nativeBackup.saveFile(options);

    if (result.cancelled === true && result.saved === false) {
      return { status: 'cancelled' };
    }

    if (
      result.saved !== true ||
      result.cancelled !== false ||
      !Number.isSafeInteger(result.bytesWritten) ||
      result.bytesWritten! < 0
    ) {
      throw new Error('Android did not confirm a successful backup write.');
    }

    return {
      status: 'saved',
      bytesWritten: result.bytesWritten!
    };
  }

  const blob = new Blob([options.contents], {
    type: options.mimeType
  });

  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = options.fileName;
    anchor.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { status: 'download_started' };
}
