// Renders limpios de la escena (sin interfaz) para la alternativa sin WebGL y para el video.
//   node tools/renders.mjs [url] [carpeta]
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const [url = 'http://localhost:5173/', out = 'public/renders'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const tomas = [['hero', 'inicio', 1], ['nodo', 'nodo-exterior', 0.3], ['core', 'core-exterior', 0.2], ['interior_nodo', 'interior', 0.42],
  ['interior_core', 'interior', 0.94], ['inteligencia', 'inteligencia', 0.5], ['configurado', 'personaliza', 0.6]];
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
await page.goto(url + (url.includes('?') ? '&' : '?') + 'limpio', { waitUntil: 'load' });
await page.waitForFunction(() => document.body.classList.contains('listo'), null, { timeout: 120000 });
await page.waitForTimeout(1500);
for (const [n, sec, p] of tomas) {
  await page.evaluate(([s, x]) => { const el = document.getElementById(s); scrollTo(0, el.getBoundingClientRect().top + scrollY + x * Math.max(1, el.offsetHeight - innerHeight)); }, [sec, p]);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(out, n + '.jpg'), type: 'jpeg', quality: 84 });
  console.log('render', n);
}
await browser.close();
