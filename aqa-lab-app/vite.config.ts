import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 12000 },
  server: { port: 5173, strictPort: true },
});
