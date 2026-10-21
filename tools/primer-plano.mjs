// Primeros planos de los dispositivos a alta densidad de píxeles (control de calidad visual).
//   node tools/primer-plano.mjs [url] [carpeta] [escala] [seccion:p ...]
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const [url = 'http://localhost:5173/', out = 'primer-plano', escala = '2', ...pts] = process.argv.slice(2);
const puntos = pts.length ? pts : ['core-exterior:0.2', 'core-exterior:0.85', 'nodo-exterior:0.3', 'interior:0.94'];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: +escala })).newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'limpio', { waitUntil: 'load' });
await page.waitForFunction(() => document.body.classList.contains('listo'), null, { timeout: 120000 });
await page.waitForTimeout(1200);
for (const pt of puntos) {
  const [sec, p] = pt.split(':');
  await page.evaluate(([s, x]) => { const el = document.getElementById(s); scrollTo(0, el.getBoundingClientRect().top + scrollY + x * Math.max(1, el.offsetHeight - innerHeight)); }, [sec, +p]);
  await page.waitForTimeout(2600);
  const f = path.join(out, `${sec}_${p}_x${escala}.png`);
  await page.screenshot({ path: f, clip: { x: 360, y: 150, width: 720, height: 600 } });
  console.log('primer plano', f);
}
await browser.close();
