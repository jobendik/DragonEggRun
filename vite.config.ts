import { defineConfig } from 'vite';

// Vite configuration for the Dragon Egg Run prototype.
// `base: './'` keeps asset URLs relative so the production build also works
// when served from a sub-path (e.g. GitHub Pages project sites).
export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split the large Phaser runtime into its own cacheable chunk.
          phaser: ['phaser'],
        },
      },
    },
  },
});
