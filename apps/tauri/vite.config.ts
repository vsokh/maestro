import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// @ts-expect-error -- __dirname is available in Vite config
const root = __dirname;
const repoRoot = resolve(root, '../..');

export default defineConfig({
  plugins: [react()],
  root,
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      // Intercept the resolved absolute path of src/api.ts → Tauri IPC adapter.
      // All hooks do `import { ... } from '../api.ts'` which Vite resolves to
      // the absolute path of src/api.ts before checking aliases.
      [resolve(repoRoot, 'src/api.ts')]: resolve(root, 'src/tauri-api.ts'),
    },
  },
  // Tauri dev server
  server: {
    port: 1420,
    strictPort: true,
  },
  clearScreen: false,
});
