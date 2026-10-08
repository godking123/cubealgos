import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH serves the site from a subdirectory, /CubeAlgos/ on GitHub Pages
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  worker: { format: 'es' },
});
