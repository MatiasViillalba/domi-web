// Mide la fluidez real del recorrido: baja con scroll suave por toda la página y registra el tiempo de cada cuadro.
//   node tools/rendimiento.mjs [url] [ancho] [alto] [escala]
// Por defecto imita una notebook 1920 × 1080 al 125 % (1536 × 864 CSS, densidad 1,25).
import { chromium } from 'playwright-core';

const [url = 'http://localhost:5173/', W = '1536', H = '864', escala = '1.25'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await (await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +escala })).newPage();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.body.classList.contains('listo'), null, { timeout: 120000 });
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const fin = document.getElementById('comprar').getBoundingClientRect().top + scrollY - innerHeight;
  const tiempos = []; let largas = 0;
  new PerformanceObserver((l) => { largas += l.getEntries().length; }).observe({ type: 'longtask', buffered: false });
  let t0 = performance.now(), prev = t0;
  await new Promise((ok) => {
    const paso = (t) => {
      tiempos.push(t - prev); prev = t;
      const k = Math.min(1, (t - t0) / 24000);
      scrollTo(0, fin * k);
      if (k < 1) requestAnimationFrame(paso); else ok();
    };
    requestAnimationFrame(paso);
  });
  tiempos.shift();
  const s = [...tiempos].sort((a, b) => a - b);
  const prom = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
  return { cuadros: tiempos.length, fps: +(1000 / prom).toFixed(1), p95_ms: +s[Math.floor(s.length * 0.95)].toFixed(1),
    trabados_pct: +(100 * tiempos.filter((x) => x > 33.4).length / tiempos.length).toFixed(1), tareas_largas: largas,
    resolucion: (() => { const c = document.getElementById('gl'); return c.width + '×' + c.height; })() };
});
console.log(JSON.stringify(r));
await browser.close();
