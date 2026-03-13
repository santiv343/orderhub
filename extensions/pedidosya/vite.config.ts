import { defineConfig } from 'vite';
import { resolve } from 'path';

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
        // IIFE format es requerido: content scripts y injected NO soportan ES modules en Chrome.
        // El service worker (background) también funciona correctamente como classic script.
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
