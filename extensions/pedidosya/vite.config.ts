import { defineConfig } from 'vite';
import { resolve } from 'path';

// This config is used by vitest and `vite build --watch` (dev mode).
// Production build uses build.mjs which builds each entry separately as IIFE
// to work around Rollup's restriction on IIFE format with multiple inputs.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content.ts'),
        background: resolve(__dirname, 'src/background.ts'),
        injected: resolve(__dirname, 'src/injected.ts'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        format: 'iife',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
  },
  resolve: {
    alias: {
      '@orderhub/types': resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
});
