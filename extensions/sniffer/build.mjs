/**
 * Build script para la extensión Sniffer.
 * Vite/Rollup no soporta IIFE con múltiples entry points — construimos cada uno por separado.
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
};

const entries = [
  { name: 'injected',   input: resolve(__dirname, 'src/injected.ts') },
  { name: 'content',    input: resolve(__dirname, 'src/content.ts') },
  { name: 'background', input: resolve(__dirname, 'src/background.ts') },
  { name: 'popup',      input: resolve(__dirname, 'src/popup/popup.ts') },
];

// Limpiar dist/ una vez antes de todos los builds
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
          format: 'iife',
          name: entry.name,
        },
      },
    },
  });
}

// Copiar assets estáticos
copyFileSync(resolve(__dirname, 'manifest.json'), resolve(OUT_DIR, 'manifest.json'));
// popup.html va PLANO en dist/ — el manifest lo referencia como "popup.html"
copyFileSync(resolve(__dirname, 'src/popup/popup.html'), resolve(OUT_DIR, 'popup.html'));

console.log('\n✓ Extension built successfully → dist/');
