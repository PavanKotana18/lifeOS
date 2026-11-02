/**
 * LifeOS Storage Access Framework Service (CJS / Browser compatible)
 * Provides native Android Storage Access Framework (SAF) integration via StorageAccessPlugin
 * with deterministic UTF-8 byte counting, 50MB boundary enforcement, cancellation handling,
 * and browser Web Blob fallback.
 */

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB safety limit

function getUtf8ByteLength(text) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length;
  }
  return unescape(encodeURIComponent(text)).length;
}

const StorageAccessService = {
  async exportFile(fileName, content, mimeType = 'application/json') {
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
      const cap = (typeof window !== 'undefined' ? window.Capacitor : null);
      if (cap && typeof cap.isPluginAvailable === 'function' && cap.isPluginAvailable('StorageAccess')) {
        const result = await cap.Plugins.StorageAccess.exportFile({ fileName, content, mimeType });
        if (result) {
          return result;
        }
      }
    } catch (e) {
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

      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      }, 60000);

      return {
        success: true,
        bytesWritten: utf8Bytes
      };
    } catch (err) {
      return { success: false, message: err?.message || 'Web export failed' };
    }
  },

  async importFile(mimeType = 'application/json') {
    try {
      const cap = (typeof window !== 'undefined' ? window.Capacitor : null);
      if (cap && typeof cap.isPluginAvailable === 'function' && cap.isPluginAvailable('StorageAccess')) {
        const result = await cap.Plugins.StorageAccess.importFile({ mimeType });
        if (result) {
          return result;
        }
      }
    } catch (e) {
      return {
        success: false,
        message: e?.message || 'Native storage import failed'
      };
    }

    return new Promise((resolve) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        resolve({ success: false, message: 'Browser document environment unavailable' });
        return;
      }

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = mimeType;

      let fileSelected = false;

      input.onchange = async (e) => {
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
        } catch (err) {
          resolve({ success: false, message: err?.message || 'File reading failed' });
        }
      };

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
if (typeof window !== 'undefined') {
  window.StorageAccessService = StorageAccessService;
}
