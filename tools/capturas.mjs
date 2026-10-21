// Capturas de verificación con Microsoft Edge (playwright-core, sin descargar navegadores).
//   node tools/capturas.mjs [url] [ancho] [alto] [carpeta] [puntos...]
// puntos: "seccion:p" (p de 0 a 1), por ejemplo inicio:0 interior:0.4
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const [url = 'http://localhost:5173/', W = '1440', H = '900', out = 'capturas', ...pts] = process.argv.slice(2);
const puntos = pts.length ? pts : ['inicio:0', 'inicio:0.6', 'problema:0.5', 'sistema:0.6', 'nodo-exterior:0.3', 'nodo-exterior:0.7',
  'privacidad:0.5', 'core-exterior:0.3', 'core-exterior:0.8', 'interior:0.25', 'interior:0.42', 'interior:0.75', 'interior:0.94',
  'inteligencia:0.3', 'inteligencia:0.7', 'ensamblaje:0.3', 'ensamblaje:0.9', 'personaliza:0.5', 'comprar:0.4', 'especificaciones:0.3'];
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const movil = +W < 700;
const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, isMobile: movil, hasTouch: movil });
const page = await ctx.newPage();
const errores = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errores.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errores.push('[pageerror] ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.body.classList.contains('listo'), null, { timeout: 120000 });
await page.waitForTimeout(1500);
for (const p of puntos) {
  const [sec, v, extra] = p.split(':');
  await page.evaluate(([s, x]) => {
    const el = document.getElementById(s);
    const top = el.getBoundingClientRect().top + scrollY;
    const largo = Math.max(1, el.offsetHeight - innerHeight);
    scrollTo(0, top + (+x) * largo);
  }, [sec, v]);
  await page.waitForTimeout(1700);
  if (extra) await page.evaluate((js) => eval(js), decodeURIComponent(extra)), await page.waitForTimeout(1600);
  const f = path.join(out, `${W}x${H}_${sec}_${v}${extra ? '_x' : ''}.png`);
  await page.screenshot({ path: f });
  console.log('captura', f);
}
console.log('ERRORES:', errores.length ? '\n' + [...new Set(errores)].join('\n') : 'ninguno');
await browser.close();
