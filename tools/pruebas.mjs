// Pruebas de interacción en Microsoft Edge: apertura manual, selección, colores, exploración, privacidad.
//   node tools/pruebas.mjs [url] [carpeta]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const [url = 'http://localhost:5173/', out = 'pruebas'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const resultados = [];
const ok = (nombre, cond, extra = '') => { resultados.push(`${cond ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ' · ' + extra : ''}`); };

async function abrir(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.classList.contains('listo'), null, { timeout: 120000 });
  await page.waitForTimeout(1200);
  return { ctx, page, errores };
}
const ir = (page, sec, p) => page.evaluate(([s, x]) => {
  const el = document.getElementById(s); const top = el.getBoundingClientRect().top + scrollY;
  scrollTo(0, top + x * Math.max(1, el.offsetHeight - innerHeight));
}, [sec, p]);
const foto = (page, n) => page.screenshot({ path: path.join(out, n + '.png') });

{
  const { ctx, page, errores } = await abrir();
  // 1 · apertura y ensamblaje manuales
  await ir(page, 'interior', 0.06); await page.waitForTimeout(1800);
  await page.click('#btn-abrir'); await page.waitForTimeout(3200); await foto(page, '01_abrir_manual');
  const manual = await page.$eval('#modo-interior', (e) => e.classList.contains('manual'));
  ok('«Abrir producto» activa el control manual', manual);
  await page.click('#btn-ensamblar'); await page.waitForTimeout(3200); await foto(page, '02_ensamblar_manual');
  await page.click('#btn-abrir'); await page.waitForTimeout(3200);

  // 2 · selección de una pieza tocando su etiqueta 3D
  const etq = await page.$('button.etq[data-key="nodo:placa"]');
  ok('etiqueta de la placa visible', !!etq);
  if (etq) { await etq.click(); await page.waitForTimeout(900); }
  const ficha = await page.$eval('#ficha', (e) => !e.hidden && document.getElementById('ficha-nombre').textContent);
  ok('selección muestra la ficha de la pieza', !!ficha, ficha || '');
  await foto(page, '03_seleccion_placa');
  // selección tocando el modelo (centro del canvas donde está la matriz)
  await page.click('#btn-restablecer'); await page.waitForTimeout(400);
  const sinSel = await page.$eval('#ficha', (e) => e.hidden);
  ok('«Restablecer vista» limpia la selección y vuelve al scroll', sinSel && !(await page.$eval('#modo-interior', (e) => e.classList.contains('manual'))));

  // 3 · la lista de piezas permite elegir con teclado
  await ir(page, 'interior', 0.42); await page.waitForTimeout(1800);
  await page.click('.piezas-lista summary');
  await page.focus('#lista-piezas button'); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  ok('selección por teclado desde la lista', await page.$eval('#ficha', (e) => !e.hidden));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok('Esc cierra la selección', await page.$eval('#ficha', (e) => e.hidden));

  // 4 · selección tocando el modelo 3D
  const box = await page.$eval('#gl', (c) => { const r = c.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  let tocado = '';
  for (const [fx, fy] of [[0.64, 0.68], [0.62, 0.52], [0.66, 0.6], [0.6, 0.45]]) {
    await page.mouse.click(box.w * fx, box.h * fy); await page.waitForTimeout(500);
    tocado = await page.$eval('#ficha', (e) => (e.hidden ? '' : document.getElementById('ficha-nombre').textContent));
    if (tocado) break;
  }
  ok('tocar una pieza del modelo la identifica', !!tocado, tocado);
  await foto(page, '04_toque_modelo');
  await page.keyboard.press('Escape');

  // 5 · privacidad
  await ir(page, 'privacidad', 0.6); await page.waitForTimeout(1800);
  await page.click('#btn-privacidad'); await page.waitForTimeout(1500);
  ok('botón de privacidad cambia de estado', (await page.getAttribute('#btn-privacidad', 'aria-pressed')) === 'true');
  await foto(page, '05_privacidad_cortado');
  await page.click('#btn-privacidad'); await page.waitForTimeout(600);

  // 6 · configurador: colores por dispositivo y contraste del logo
  await ir(page, 'personaliza', 0.6); await page.waitForTimeout(2000);
  await page.click('[data-prod="core"]'); await page.waitForTimeout(400);
  await page.click('[data-preset="negro-blanco"]'); await page.waitForTimeout(2200); await foto(page, '06_core_negro_tapa_blanca');
  await page.click('[data-prod="nodo"]'); await page.waitForTimeout(400);
  await page.click('[data-preset="blanco-negro"]'); await page.waitForTimeout(2200); await foto(page, '07_nodo_blanco_tapa_negra');
  await page.click('[data-prod="ambos"]'); await page.waitForTimeout(2200); await foto(page, '08_los_dos_configurados');
  const cfg = await page.evaluate(() => localStorage.getItem('domi-config'));
  ok('colores independientes por dispositivo', /"core":\{"cuerpo":"grafito","tapa":"blanco"\}/.test(cfg) && /"nodo":\{"cuerpo":"blanco","tapa":"grafito"\}/.test(cfg), cfg);
  // las elecciones se mantienen al volver a otra sección
  await ir(page, 'sistema', 0.6); await page.waitForTimeout(2200); await foto(page, '09_colores_en_otra_seccion');

  // 7 · exploración libre: arrastrar, acercar, salir
  await ir(page, 'personaliza', 0.6); await page.waitForTimeout(1800);
  await page.click('#config [data-explorar]'); await page.waitForTimeout(500);
  ok('modo exploración visible', await page.$eval('#modo', (e) => !e.hidden));
  await page.mouse.move(720, 450); await page.mouse.down(); await page.mouse.move(980, 380, { steps: 12 }); await page.mouse.up();
  await page.mouse.wheel(0, -400); await page.waitForTimeout(1200); await foto(page, '10_exploracion_rotada');
  await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
  ok('Esc sale de la exploración', await page.$eval('#modo', (e) => e.hidden));
  await foto(page, '11_vuelta_al_recorrido');

  ok('sin errores en consola', errores.length === 0, errores.join(' | '));

  // 8 · la web es pública: ningún dato interno del desarrollo en el texto de la página
  const texto = await page.evaluate(() => document.body.textContent + ' ' + [...document.querySelectorAll('[aria-label],[alt],[title]')]
    .map((e) => [e.getAttribute('aria-label'), e.getAttribute('alt'), e.getAttribute('title')].join(' ')).join(' '));
  // la lista de términos vive en interno/terminos.json (no se publica con el repositorio)
  const lista = fs.existsSync('interno/terminos.json') ? JSON.parse(fs.readFileSync('interno/terminos.json', 'utf8')) : null;
  if (lista) {
    const internos = lista.filter((t) => new RegExp(t, 'i').test(texto));
    ok('sin datos internos en la página', internos.length === 0, internos.join(', '));
  } else resultados.push('—     sin datos internos en la página · omitida (falta interno/terminos.json)');
  await page.evaluate(() => localStorage.removeItem('domi-config'));
  await ctx.close();
}

// 9 · movimiento reducido
{
  const { ctx, page, errores } = await abrir({ reducedMotion: 'reduce' });
  await ir(page, 'interior', 0.42); await page.waitForTimeout(800); await foto(page, '12_movimiento_reducido');
  ok('movimiento reducido sin errores', errores.length === 0, errores.join(' | '));
  await ctx.close();
}
await browser.close();

// 10 · sin WebGL: vistas renderizadas
{
  const b2 = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-webgl', '--disable-3d-apis'] });
  const ctx = await b2.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' }); await page.waitForTimeout(1500);
  ok('sin WebGL muestra la alternativa', await page.evaluate(() => document.body.classList.contains('sin-webgl')));
  await ir(page, 'nodo-exterior', 0.5); await page.waitForTimeout(800); await foto(page, '13_sin_webgl');
  await b2.close();
}
console.log(resultados.join('\n'));
