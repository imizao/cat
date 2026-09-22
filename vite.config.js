import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/cat/',
  build: {
    rollupOptions: {
      input: {
        game: resolve(import.meta.dirname, 'index.html'),
        simulator: resolve(import.meta.dirname, 'simulator.html')
      }
    }
  }
});
