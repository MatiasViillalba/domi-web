import { defineConfig } from 'vite';

// base relativa: la web funciona igual en un dominio propio, en GitHub Pages o abierta desde una subcarpeta
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { target: 'es2020', chunkSizeWarningLimit: 900, assetsInlineLimit: 0 },
});
