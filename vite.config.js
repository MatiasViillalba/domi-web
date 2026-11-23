import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const archivoLocal = {
  name: 'domi-archivo-local',
  apply: 'build',
  generateBundle() {
    const modelos = {};
    for (const nombre of ['nodo', 'core']) {
      const archivo = new URL(`./public/models/${nombre}.glb`, import.meta.url);
      modelos[nombre] = `data:model/gltf-binary;base64,${readFileSync(archivo).toString('base64')}`;
    }
    this.emitFile({
      type: 'asset',
      fileName: 'models/modelos-locales.js',
      source: `globalThis.domiModelosLocales = ${JSON.stringify(modelos)};\n`,
    });
  },
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      // Chrome bloquea módulos y hojas con CORS cuando el origen es file://.
      return html
        .replace('<script type="module" crossorigin src=', '<script defer src=')
        .replace('<link rel="stylesheet" crossorigin href=', '<link rel="stylesheet" href=');
    },
  },
};

export default defineConfig({
  base: './',
  plugins: [archivoLocal],
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
