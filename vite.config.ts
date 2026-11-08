import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Keep the native WebViewCompatibility baseline aligned with emitted syntax.
    target: ['chrome87', 'edge88', 'firefox78', 'safari14'],
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false
  }
});
