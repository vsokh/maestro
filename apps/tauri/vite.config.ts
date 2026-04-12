import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// @ts-expect-error -- __dirname is available in Vite config
const tauriRoot = __dirname;
const repoRoot = resolve(tauriRoot, '../..');

export default defineConfig({
  plugins: [react()],
  // Root = repo root so Vite can resolve imports from shared src/ and packages/
  root: repoRoot,
  build: {
    outDir: resolve(tauriRoot, 'dist'),
    rollupOptions: {
      input: resolve(tauriRoot, 'index.html'),
    },
  },
  resolve: {
    alias: {
      // Swap src/api.ts → Tauri IPC adapter for all transitive imports
      [resolve(repoRoot, 'src/api.ts')]: resolve(tauriRoot, 'src/tauri-api.ts'),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  clearScreen: false,
});
