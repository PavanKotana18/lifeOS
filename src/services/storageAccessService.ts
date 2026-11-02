/**
 * LifeOS Storage Access Framework Service (TypeScript)
 * Provides native Android Storage Access Framework (SAF) integration via StorageAccessPlugin
 * with deterministic UTF-8 byte counting, 50MB boundary enforcement, cancellation handling,
 * and browser Web Blob fallback.
 */

export interface ExportResult {
  success: boolean;
  uri?: string;
  bytesWritten?: number;
  cancelled?: boolean;
  message?: string;
}

export interface ImportResult {
  success: boolean;
  content?: string;
  bytesRead?: number;
  uri?: string;
  cancelled?: boolean;
  message?: string;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB safety limit

export function getUtf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  // Fallback for environments without TextEncoder
  return unescape(encodeURIComponent(text)).length;
}

export const StorageAccessService = {
  async exportFile(fileName: string, content: string, mimeType = 'application/json'): Promise<ExportResult> {
    if (!fileName || !fileName.trim()) {
      return { success: false, message: 'File name cannot be empty' };
    }

    if (content === null || content === undefined) {
      return { success: false, message: 'Content cannot be null' };
    }

    const utf8Bytes = getUtf8ByteLength(content);
    if (utf8Bytes > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        message: `Content exceeds maximum permitted file size of 50MB (${utf8Bytes} bytes)`
      };
    }

    // 1. Try native Capacitor StorageAccessPlugin if running in native app
    try {
      const cap = (typeof window !== 'undefined' ? (window as any).Capacitor : null);
      if (cap && typeof cap.isPluginAvailable === 'function' && cap.isPluginAvailable('StorageAccess')) {
        const result = await cap.Plugins.StorageAccess.exportFile({ fileName, content, mimeType });
        if (result) {
          // Native handled request (either success, cancelled, or error)
          return result;
        }
      }
    } catch (e: any) {
      // If native plugin failed with an error or rejection, do not blindly trigger web fallback
      // on mobile as that creates duplicate confusing UI. Return failure explicitly.
      return {
        success: false,
        message: e?.message || 'Native storage export failed'
      };
    }

    // 2. Web Fallback: HTML5 Blob download
    try {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return { success: false, message: 'Browser document environment unavailable' };
      }
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Safe asynchronous object URL revocation (prevents premature teardown in Safari/Firefox)
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      }, 60000);

      return {
        success: true,
        bytesWritten: utf8Bytes
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Web export failed' };
    }
  },

  async importFile(mimeType = 'application/json'): Promise<ImportResult> {
    // 1. Try native Capacitor StorageAccessPlugin if running in native app
    try {
      const cap = (typeof window !== 'undefined' ? (window as any).Capacitor : null);
      if (cap && typeof cap.isPluginAvailable === 'function' && cap.isPluginAvailable('StorageAccess')) {
        const result = await cap.Plugins.StorageAccess.importFile({ mimeType });
        if (result) {
          return result;
        }
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Native storage import failed'
      };
    }

    // 2. Web Fallback: HTML5 file input picker
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        resolve({ success: false, message: 'Browser document environment unavailable' });
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = mimeType;

      let fileSelected = false;

      input.onchange = async (e: any) => {
        fileSelected = true;
        const file = e.target?.files?.[0];
        if (!file) {
          resolve({ success: false, cancelled: true, message: 'No file selected' });
          return;
        }
        try {
          const text = await file.text();
          const byteLen = getUtf8ByteLength(text);
          if (byteLen > MAX_FILE_SIZE_BYTES) {
            resolve({
              success: false,
              message: `Imported file exceeds maximum allowed size of 50MB (${byteLen} bytes)`
            });
            return;
          }
          resolve({
            success: true,
            content: text,
            bytesRead: byteLen
          });
        } catch (err: any) {
          resolve({ success: false, message: err?.message || 'File reading failed' });
        }
      };

      // Handle window focus cancellation detection
      window.addEventListener(
        'focus',
        () => {
          setTimeout(() => {
            if (!fileSelected) {
              resolve({ success: false, cancelled: true, message: 'File selection cancelled' });
            }
          }, 1000);
        },
        { once: true }
      );

      input.click();
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    StorageAccessService,
    getUtf8ByteLength
  };
}
