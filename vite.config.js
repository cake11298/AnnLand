import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), city: resolve(__dirname, 'city.html') } },
  },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
