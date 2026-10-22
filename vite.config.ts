import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served by GitHub Pages at silverninja71.github.io/Empire/
export default defineConfig({
  base: '/Empire/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
  },
});
