import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// @ts-expect-error -- __dirname is available in Vite config
const tauriRoot = __dirname;
const repoRoot = resolve(tauriRoot, '../..');

// Normalize Windows backslashes for comparison
const norm = (p: string) => p.replace(/\\/g, '/');

const originalApi = norm(resolve(repoRoot, 'src/api.ts'));
const tauriApi = norm(resolve(tauriRoot, 'src/tauri-api.ts'));

/**
 * Vite plugin that swaps src/api.ts → tauri-api.ts at resolve time.
 * Standard aliases match import specifiers (e.g. '../api.ts'), not resolved paths.
 * This plugin resolves normally first, then redirects if the result is src/api.ts.
 */
function tauriApiSwap(): Plugin {
  return {
    name: 'tauri-api-swap',
    enforce: 'pre',
    resolveId: {
      order: 'pre',
      async handler(source, importer, options) {
        if (!importer) return null;
        // Resolve the import normally
        const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
        if (resolved && norm(resolved.id) === originalApi) {
          return tauriApi;
        }
        return null;
      },
    },
  };
}

export default defineConfig({
  plugins: [tauriApiSwap(), react()],
  root: repoRoot,
  build: {
    outDir: resolve(tauriRoot, 'dist'),
    rollupOptions: {
      input: resolve(tauriRoot, 'index.html'),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  clearScreen: false,
});
