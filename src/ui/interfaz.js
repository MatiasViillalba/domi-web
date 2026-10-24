// Interfaz HTML: textos que aparecen con el scroll, navegación, controles de la vista abierta,
// privacidad, pasos de una conversación, configurador y exploración libre.
import { ESTADOS, CADENA, COLORES, PRESETS } from '../data/producto.js';
import { NODO as DEF_NODO, CORE as DEF_CORE } from '../data/piezas.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const DEFS = { nodo: DEF_NODO, core: DEF_CORE };
const CON_TEXTO_IZQ = new Set(['problema', 'nodo-exterior', 'privacidad', 'core-exterior', 'interior', 'inteligencia', 'ensamblaje']);

export class Interfaz {
  constructor({ director, disp, reducido }) {
    this.director = director; this.disp = disp; this.reducido = reducido;
    this.explorando = false; this.seleccion = null; this.override = {}; this.secPrev = null;
    this.alExplorar = null; this.alRestablecerVista = null;
    this.revelables = $$('[data-in]').map((el) => ({ el, sec: el.closest('[data-escena]').id, a: +el.dataset.in, b: +el.dataset.out, o: -1, y: -1 }));
    this.fijos = $$('.escena .fijo').map((el) => ({ el, sec: el.parentElement.id, v: -1 }));
    this.nav = $('#nav'); this.navLinks = $$('.nav nav a'); this.progreso = $('#progreso');
    this.colorEstado = '';
    this.armarPrivacidad();
    this.armarInterior();
    this.armarCadena();
    this.armarConfig();
    this.armarExplorar();
    this.colorRecorrido();
    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.explorando) this.salirExplorar();
      else if (this.seleccion) this.seleccionar(null, null);
    });
  }

  zonaTexto(sec) { return CON_TEXTO_IZQ.has(sec); }
  // borde derecho de la columna de texto visible (las etiquetas 3D no se meten ahí)
  bordeTexto(sec) {
    let x = 0;
    for (const r of this.revelables) {
      if (r.sec !== sec || r.o < 0.05) continue;
      if (r.el.classList.contains('izq') || r.el.classList.contains('taller')) x = Math.max(x, r.el.getBoundingClientRect().right);
    }
    return x || innerWidth * 0.36;
  }
  // franja vertical libre de texto: las etiquetas 3D no se superponen con títulos ni paneles
  franjaLibre(sec) {
    const movil = innerWidth < 900;
    let y0 = 64, y1 = innerHeight - 12;
    for (const r of this.revelables) {
      if (r.sec !== sec || r.o < 0.05) continue;
      const c = r.el.classList;
      if (!movil && !(c.contains('centro') || c.contains('config') || c.contains('datos-pie'))) continue;
      const b = r.el.getBoundingClientRect();
      if (b.top + b.height / 2 < innerHeight * 0.45) y0 = Math.max(y0, b.bottom + 8);
      else y1 = Math.min(y1, b.top - 8);
    }
    return { y0, y1 };
  }

  // ---------------------------------------------------------------- cada cuadro
  actualizar(sec, dt) {
    const D = this.director;
    // textos: aparecen y se van según el progreso de su sección (reversible)
    for (const r of this.revelables) {
      const p = D.progreso(r.sec);
      let o;
      if (p < 0) o = 0;
      else {
        const entra = r.a <= 0 ? 1 : smooth((p - r.a) / 0.06 + 1);
        const sale = r.b >= 1 ? 1 : smooth((r.b - p) / 0.06);
        o = Math.min(entra, sale);
        if (this.reducido) o = o > 0.5 ? 1 : 0;
        r.yv = (1 - entra) * 28 - (1 - sale) * 18;
      }
      if (Math.abs(o - r.o) > 0.002) {
        r.o = o;
        r.el.style.setProperty('--o', o.toFixed(3));
        r.el.style.setProperty('--y', (r.yv || 0).toFixed(1));
        r.el.classList.toggle('fuera', o < 0.01);
      }
    }
    // velo detrás de los textos de la columna izquierda
    for (const f of this.fijos) {
      const v = CON_TEXTO_IZQ.has(f.sec) ? 1 : 0;
      if (v !== f.v) { f.v = v; f.el.style.setProperty('--velo', v); }
    }
    // navegación
    // (posición del scroll y alto de la página ya medidos por el director: no se fuerza el diseño de la página)
    const solida = D.y > 24;
    if (solida !== this.navSolida) { this.navSolida = solida; this.nav.classList.toggle('solida', solida); }
    const prog = (D.y / D.maxScroll).toFixed(3);
    if (prog !== this.progPrev) { this.progPrev = prog; this.progreso.style.setProperty('--prog', prog); }
    const mapa = { ensamblaje: 'interior' };
    const activa = mapa[sec] || sec;
    if (activa !== this.navActiva) {
      this.navActiva = activa;
      for (const a of this.navLinks) a.classList.toggle('activo', a.getAttribute('href') === '#' + activa);
    }

    // color del estado activo tiñe la interfaz
    const d = sec === 'core-exterior' ? this.disp.core : this.disp.nodo;
    const hex = '#' + d.col.getHexString();
    if (hex !== this.colorEstado) { this.colorEstado = hex; document.documentElement.style.setProperty('--estado', hex === '#ffffff' ? '#c9cdd6' : hex); }

    // lista de estados del NODO
    if (sec === 'nodo-exterior') for (const li of this.listaEstados) li.classList.toggle('activo', li.dataset.estado === this.disp.nodo.estado);

    // al salir de una sección se restablecen sus controles
    if (sec !== this.secPrev) {
      if (sec === 'personaliza') this.aplicarColores();
      else if (this.secPrev === 'personaliza') this.colorRecorrido();
      if (this.secPrev === 'privacidad' && this.disp.nodo.privado) this.setPrivado(false);
      if (this.secPrev === 'interior') { this.override = {}; this.seleccionar(null, null); this.modoInterior(false); }
      if (this.explorando && sec !== this.secPrev && this.secPrev !== null) this.salirExplorar();
      this.secPrev = sec;
    }
    if (sec === 'interior') this.actualizarInterior();
  }

  // ---------------------------------------------------------------- privacidad (simulación)
  armarPrivacidad() {
    this.btnPriv = $('#btn-privacidad'); this.estMic = $('#estado-mic');
    this.listaEstados = $$('#lista-estados li');
    this.btnPriv.addEventListener('click', () => this.setPrivado(!this.disp.nodo.privado));
  }
  setPrivado(v) {
    this.disp.nodo.setPrivado(v);
    this.btnPriv.setAttribute('aria-pressed', String(v));
    this.btnPriv.textContent = v ? 'Volver a tocar la tapa' : 'Tocar la tapa';
    this.estMic.classList.toggle('cortado', v);
    this.estMic.querySelector('span').textContent = v ? 'Micrófono apagado' : 'Micrófono encendido';
  }

  // ---------------------------------------------------------------- interior
  armarInterior() {
    this.botonesIr = $$('[data-ir]');
    this.botonesIr.forEach((b) => b.addEventListener('click', () => this.irA(b.dataset.ir)));
    $('#btn-abrir').addEventListener('click', () => this.manual(1));
    $('#btn-ensamblar').addEventListener('click', () => this.manual(0));
    $('#btn-restablecer').addEventListener('click', () => this.restablecer());
    $('#ficha-cerrar').addEventListener('click', () => this.seleccionar(null, null));
    this.ficha = $('#ficha'); this.modoEtq = $('#modo-interior'); this.listaPiezas = $('#lista-piezas');
    this.dispLista = null;
  }
  dispositivoInterior() {
    if (this.director.activa() !== 'interior') return null;
    return this.director.progreso('interior') < 0.47 ? 'nodo' : 'core';
  }
  irA(d) {
    const s = this.director.secciones.get('interior'); if (!s) return;
    const y = s.top + (d === 'nodo' ? 0.4 : 0.92) * s.largo;
    this.override = {};
    scrollTo({ top: y, behavior: this.reducido ? 'auto' : 'smooth' });
  }
  manual(objetivo) {
    const d = this.dispositivoInterior() || 'nodo';
    const actual = this.disp[d].explode;
    this.override[d] = { objetivo, valor: actual };
    this.modoInterior(true);
  }
  modoInterior(manual) {
    this.modoEtq.classList.toggle('manual', manual);
    this.modoEtq.lastChild.textContent = manual ? 'Control manual · «Restablecer vista» vuelve al scroll' : 'El scroll abre el producto';
  }
  restablecer() {
    this.override = {}; this.seleccionar(null, null); this.modoInterior(false);
    if (this.explorando) this.salirExplorar();
    this.alRestablecerVista && this.alRestablecerVista();
  }
  explodeEfectivo(d, scrollVal, dt) {
    const o = this.override[d];
    if (!o) return scrollVal;
    o.valor += (o.objetivo - o.valor) * (1 - Math.exp(-dt * (this.reducido ? 60 : 1.9)));
    return o.valor;
  }
  actualizarInterior() {
    const d = this.dispositivoInterior();
    for (const b of this.botonesIr) b.setAttribute('aria-pressed', String(b.dataset.ir === d));
    if (d && d !== this.dispLista) {
      this.dispLista = d;
      this.listaPiezas.innerHTML = '';
      for (const g of DEFS[d].grupos.filter((x) => x.destacado)) {
        const li = document.createElement('li'); const b = document.createElement('button');
        b.type = 'button'; b.textContent = g.nombre; b.dataset.g = g.id;
        b.addEventListener('click', () => this.seleccionar(d, g.id));
        li.appendChild(b); this.listaPiezas.appendChild(li);
      }
      if (this.seleccion && this.seleccion.d !== d) this.seleccionar(null, null);
    }
  }
  seleccionar(d, g) {
    const otro = d === 'nodo' ? 'core' : 'nodo';
    if (!d || !g) {
      this.seleccion = null;
      this.disp.nodo.seleccionar(null); this.disp.core.seleccionar(null);
      this.ficha.hidden = true;
      $$('#lista-piezas button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      return;
    }
    const G = DEFS[d].grupos.find((x) => x.id === g);
    if (!G || !G.destacado) return this.seleccionar(null, null);      // solo las partes destacadas tienen ficha
    if (this.seleccion && this.seleccion.d === d && this.seleccion.g === g) return this.seleccionar(null, null);
    this.seleccion = { d, g };
    this.disp[d].seleccionar(g); this.disp[otro].seleccionar(null);
    $('#ficha-nombre').textContent = G.nombre;
    $('#ficha-texto').textContent = G.texto;
    this.ficha.hidden = false;
    $$('#lista-piezas button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === g)));
  }

  // ---------------------------------------------------------------- cadena de voz
  armarCadena() {
    $('#pasos').innerHTML = CADENA.map((c) => `<li><b>${c.paso}</b><span class="como">${c.texto}</span></li>`).join('');
    this.pasos = $$('#pasos li'); this.lineasDemo = $$('#demo .demo-linea'); this.pasoPrev = null; this.resPrev = '';
  }
  pasoCadena(paso) {
    if (paso === this.pasoPrev) return;
    this.pasoPrev = paso;
    this.pasos.forEach((li, i) => { li.classList.toggle('activo', i === paso); li.classList.toggle('hecho', i < paso); });
    this.lineasDemo.forEach((l) => l.classList.toggle('visible', paso >= +l.dataset.paso));
    const vis = this.lineasDemo.filter((l) => paso >= +l.dataset.paso);
    this.lineasDemo.forEach((l) => l.classList.toggle('ultima', l === (vis.at(-1) || this.lineasDemo[0])));
  }
  resaltarCadena(sel) {
    const k = sel ? sel.join('|') : '';
    if (k === this.resPrev) return;
    this.resPrev = k;
    if (this.seleccion) return;
    this.disp.nodo.seleccionar(sel ? sel[0] : null);
    this.disp.core.seleccionar(sel ? sel[1] : null);
  }

  // ---------------------------------------------------------------- configurador
  armarConfig() {
    let guardado = null;
    try { guardado = JSON.parse(localStorage.getItem('domi-config') || 'null'); } catch (e) { /* sin almacenamiento */ }
    this.cfg = guardado && guardado.nodo && guardado.core ? guardado : { nodo: { cuerpo: 'grafito', tapa: 'grafito' }, core: { cuerpo: 'grafito', tapa: 'grafito' } };
    this.prod = 'ambos'; this.estadoConfig = 'escuchando';
    const pres = $('#presets');
    pres.innerHTML = PRESETS.map((p) => `<button type="button" data-preset="${p.id}" aria-pressed="false">${p.nombre}</button>`).join('');
    const muestra = (parte) => Object.entries(COLORES).map(([k, c]) => `<button type="button" role="radio" aria-checked="false" data-parte="${parte}" data-color="${k}" style="--c:${c.hex}" aria-label="${parte === 'cuerpo' ? 'Cuerpo' : 'Tapa'} ${c.nombre}" title="${c.nombre}"></button>`).join('');
    $('#muestras-cuerpo').innerHTML = muestra('cuerpo');
    $('#muestras-tapa').innerHTML = muestra('tapa');
    const lucesOrden = ['reposo', 'escuchando', 'pensando', 'respondiendo'];
    $('#luces').innerHTML = lucesOrden.map((k) => `<button type="button" data-luz="${k}" aria-pressed="false" style="--c:${ESTADOS[k].color}"><i></i>${ESTADOS[k].nombre}</button>`).join('');

    $$('[data-prod]').forEach((b) => b.addEventListener('click', () => { this.prod = b.dataset.prod; this.director.setProducto(this.prod); this.pintarConfig(); }));
    $$('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      const p = PRESETS.find((x) => x.id === b.dataset.preset);
      for (const d of this.destinos()) this.cfg[d] = { cuerpo: p.cuerpo, tapa: p.tapa };
      this.aplicarColores();
    }));
    $$('.muestras button').forEach((b) => b.addEventListener('click', () => {
      for (const d of this.destinos()) this.cfg[d][b.dataset.parte] = b.dataset.color;
      this.aplicarColores();
    }));
    $$('[data-luz]').forEach((b) => b.addEventListener('click', () => { this.estadoConfig = b.dataset.luz; this.pintarConfig(); }));
    $('#btn-restablecer-config').addEventListener('click', () => { if (this.explorando) this.salirExplorar(); this.director.setProducto(this.prod); });
    this.aplicarColores();
  }
  colorRecorrido() {
    this.disp.nodo.setColores('grafito', 'grafito');
    this.disp.core.setColores('grafito', 'grafito');
  }
  destinos() { return this.prod === 'ambos' ? ['nodo', 'core'] : [this.prod]; }
  aplicarColores() {
    this.disp.nodo.setColores(this.cfg.nodo.cuerpo, this.cfg.nodo.tapa);
    this.disp.core.setColores(this.cfg.core.cuerpo, this.cfg.core.tapa);
    try { localStorage.setItem('domi-config', JSON.stringify(this.cfg)); } catch (e) { /* sin almacenamiento */ }
    this.pintarConfig();
  }
  pintarConfig() {
    const ref = this.cfg[this.prod === 'ambos' ? 'nodo' : this.prod];
    const iguales = this.prod !== 'ambos' || JSON.stringify(this.cfg.nodo) === JSON.stringify(this.cfg.core);
    $$('[data-prod]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.prod === this.prod)));
    $$('.muestras button').forEach((b) => b.setAttribute('aria-checked', String(iguales && ref[b.dataset.parte] === b.dataset.color)));
    $$('[data-preset]').forEach((b) => { const p = PRESETS.find((x) => x.id === b.dataset.preset); b.setAttribute('aria-pressed', String(iguales && p.cuerpo === ref.cuerpo && p.tapa === ref.tapa)); });
    $$('[data-luz]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.luz === this.estadoConfig)));
  }

  // ---------------------------------------------------------------- exploración libre
  armarExplorar() {
    this.modo = $('#modo');
    $$('[data-explorar]').forEach((b) => b.addEventListener('click', () => this.entrarExplorar()));
    $('#salir-explorar').addEventListener('click', () => this.salirExplorar());
  }
  entrarExplorar() {
    if (this.explorando) return;
    this.explorando = true;
    document.body.classList.add('explorando');
    this.modo.hidden = false;
    this.alExplorar && this.alExplorar(true);
    $('#salir-explorar').focus({ preventScroll: true });
  }
  salirExplorar() {
    if (!this.explorando) return;
    this.explorando = false;
    document.body.classList.remove('explorando');
    this.modo.hidden = true;
    this.alExplorar && this.alExplorar(false);
  }
}
