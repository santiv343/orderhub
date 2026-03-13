/**
 * Build script for the PedidosYa Chrome extension.
 *
 * Vite/Rollup does not support IIFE format with multiple inputs (it sets
 * inlineDynamicImports:true which conflicts with multi-entry builds).
 * Solution: build each entry separately as IIFE so every script is
 * fully self-contained — required for Chrome content scripts and injected
 * scripts which run as classic scripts without ES module support.
 */
import { build } from 'vite';
import { resolve, dirname } from 'path';
import { copyFileSync, rmSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, 'dist');

const sharedConfig = {
  build: {
    outDir: OUT_DIR,
    emptyOutDir: false,
    minify: false,
  },
  resolve: {
    alias: {
      '@orderhub/types': resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
};

const entries = [
  { name: 'content', input: resolve(__dirname, 'src/content.ts') },
  { name: 'background', input: resolve(__dirname, 'src/background.ts') },
  { name: 'injected', input: resolve(__dirname, 'src/injected.ts') },
  { name: 'popup', input: resolve(__dirname, 'src/popup/popup.ts') },
];

// Clean dist/ once before all builds
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

for (const entry of entries) {
  await build({
    ...sharedConfig,
    build: {
      ...sharedConfig.build,
      rollupOptions: {
        input: entry.input,
        output: {
          entryFileNames: `${entry.name}.js`,
          // IIFE: self-contained script, no imports — required for Chrome extension scripts.
          format: 'iife',
          name: entry.name,
        },
      },
    },
  });
}

// Copy static assets
copyFileSync(resolve(__dirname, 'manifest.json'), resolve(OUT_DIR, 'manifest.json'));
copyFileSync(resolve(__dirname, 'src/popup/popup.html'), resolve(OUT_DIR, 'popup.html'));

console.log('\n✓ Extension built successfully');
