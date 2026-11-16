import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Relative assets support both project Pages subpaths and root/custom domains.
export default defineConfig({
  root: fileURLToPath(new URL('./web', import.meta.url)),
  base: './',
  server: {host:'127.0.0.1'},
  preview: {host:'127.0.0.1'},
  build: {
    // Only this build-owned directory is emptied; never the old dist root.
    outDir: fileURLToPath(new URL('./dist/pages', import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
  },
});
