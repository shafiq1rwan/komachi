import { defineConfig } from 'vite';

// `base: './'` makes the build work from any sub-path (GitHub Pages project sites, file hosting).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // keep the (large, rarely changing) Three.js library in its own cacheable chunk
        manualChunks: { three: ['three'] },
      },
    },
  },
  server: { open: true },
});
