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
    preservePendingRecovery?: boolean;
  }): Promise<{
    saved: boolean;
    cancelled: boolean;
    bytesWritten?: number;
  }>;
}

const nativeBackup = registerPlugin<NativeBackupPlugin>('LifeOSBackup');
type BackupOptions = { contents: string; fileName: string; mimeType: 'application/json' | 'text/csv'; preservePendingRecovery?: boolean };
let developmentRecoveryExportAdapter: ((options: BackupOptions) => Promise<BackupExportResult>) | null = null;

/** Explicit synthetic file-provider used only by the browser acceptance entry. */
export function installDevelopmentRecoveryExportAdapter(
  adapter: (options: BackupOptions) => Promise<BackupExportResult>
): void {
  if (typeof window === 'undefined' || window.location.pathname !== '/tests/browser/index.html') {
    throw new Error('The recovery export test adapter is available only in the isolated browser acceptance entry.');
  }
  developmentRecoveryExportAdapter = adapter;
}

export async function exportBackupFile(options: {
  contents: string;
  fileName: string;
  mimeType: 'application/json' | 'text/csv';
  /** Only the recovery confirmation flow may preserve its volatile native envelope through SAF. */
  preservePendingRecovery?: boolean;
}): Promise<BackupExportResult> {
  if (typeof options.contents !== 'string' || !options.fileName.trim()) {
    throw new Error('Invalid backup export content or filename.');
  }

  const isBrowserAcceptanceEntry = typeof window !== 'undefined' && window.location.pathname === '/tests/browser/index.html';
  if (isBrowserAcceptanceEntry && options.preservePendingRecovery === true && developmentRecoveryExportAdapter) {
    return developmentRecoveryExportAdapter(options);
  }

  if (Capacitor.getPlatform() === 'android') {
    if (!Capacitor.isPluginAvailable('LifeOSBackup')) {
      throw new Error('Native LifeOS backup export is unavailable.');
    }

    const preservePendingRecovery = options.preservePendingRecovery === true
      && options.mimeType === 'application/json'
      && options.fileName.startsWith('lifeos-recovery-kit-');
    const expectedBytes = new TextEncoder().encode(options.contents).byteLength;
    const result = await nativeBackup.saveFile({
      contents: options.contents,
      fileName: options.fileName,
      mimeType: options.mimeType,
      preservePendingRecovery,
    });

    if (result.cancelled === true && result.saved === false) {
      return { status: 'cancelled' };
    }

    if (
      result.saved !== true ||
      result.cancelled !== false ||
      !Number.isSafeInteger(result.bytesWritten) ||
      result.bytesWritten !== expectedBytes
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
