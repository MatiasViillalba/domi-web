// Etiquetas HTML ancladas a puntos 3D, con líneas guía al estilo de una lámina técnica.
// Se ubican a izquierda o derecha del producto y se separan verticalmente para no superponerse.
import * as THREE from 'three';

const v = new THREE.Vector3(), n = new THREE.Vector3(), camDir = new THREE.Vector3();

export class Etiquetas {
  constructor(contenedor, camera) {
    this.cont = contenedor; this.camera = camera;
    this.svg = contenedor.querySelector('svg');
    this.items = new Map();       // key → { el, linea, punto, alpha }
    this.onClick = null;
  }

  crear(key, titulo, sub, clic) {
    const el = document.createElement(clic ? 'button' : 'div');
    el.className = 'etq'; el.dataset.key = key;
    el.innerHTML = `<b></b><span></span>`;
    if (clic) { el.type = 'button'; el.addEventListener('click', () => this.onClick && this.onClick(key)); }
    this.cont.appendChild(el);
    const linea = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    const punto = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    punto.setAttribute('r', '2.6');
    this.svg.append(linea, punto);
    const it = { el, linea, punto, alpha: 0, titulo: '', sub: '' };
    this.items.set(key, it);
    return it;
  }

  // lista: [{ key, pos: Vector3 (mundo), titulo, sub, alpha, normal?: Vector3, clic?, activa? }]
  // zona: área prohibida para etiquetas (columna de texto) en px { x0, x1 }
  render(lista, { w, h, centroX, compacto, zona, caja, franja }) {
    const vistos = new Set();
    this.camera.getWorldDirection(camDir);
    const izq = [], der = [];
    for (const L of lista) {
      let it = this.items.get(L.key) || this.crear(L.key, L.titulo, L.sub, L.clic);
      vistos.add(L.key);
      if (it.titulo !== L.titulo) { it.el.querySelector('b').textContent = L.titulo; it.titulo = L.titulo; }
      const sub = compacto ? '' : L.sub || '';
      if (it.sub !== sub) { it.el.querySelector('span').textContent = sub; it.sub = sub; }
      it.el.classList.toggle('activa', !!L.activa);
      if (it.medido !== it.titulo + it.sub) { it.medido = it.titulo + it.sub; it.ancho = it.el.offsetWidth || 160; }
      let a = L.alpha;
      if (L.normal) { n.copy(L.normal).normalize(); if (n.dot(camDir) > 0.15) a = 0; }
      v.copy(L.pos).project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) a = 0;
      it.x = (v.x * 0.5 + 0.5) * w; it.y = (-v.y * 0.5 + 0.5) * h;
      if (franja && (it.y < franja.y0 || it.y > franja.y1)) a = 0;
      it.alpha += (a - it.alpha) * 0.2;
      if (it.alpha < 0.02) { this.ocultar(it); continue; }
      (it.x < centroX ? izq : der).push(it);
    }
    for (const [k, it] of this.items) if (!vistos.has(k)) { it.alpha *= 0.8; if (it.alpha < 0.02) this.ocultar(it); else (it.x < centroX ? izq : der).push(it); }

    const sep = compacto ? 34 : 46, despl = compacto ? 40 : 104, borde = 14;
    const limIzq = zona ? zona.x1 + 10 : borde;
    // lado de cada etiqueta: se da vuelta si choca con la columna de texto o con el borde de la pantalla
    // columnas a los costados de la silueta del producto (caja en pantalla); si no entra, se oculta
    const xIzq = (it) => Math.min(it.x - despl, caja && !compacto ? caja.x0 - 22 : Infinity);
    const xDer = (it) => Math.max(it.x + despl, caja && !compacto ? caja.x1 + 22 : -Infinity);
    const todos = [...izq, ...der];
    izq.length = 0; der.length = 0;
    for (const it of todos) {
      const w0 = it.ancho || 160;
      const entraIzq = xIzq(it) - w0 >= limIzq, entraDer = xDer(it) + w0 <= w - borde;
      let lado = it.x < centroX ? -1 : 1;
      if (lado < 0 && !entraIzq) lado = entraDer ? 1 : 0;
      else if (lado > 0 && !entraDer) lado = entraIzq ? -1 : 0;
      if (!lado) { it.alpha *= 0.6; if (it.alpha < 0.02) { this.ocultar(it); continue; } lado = it.x < centroX ? -1 : 1; }
      (lado < 0 ? izq : der).push(it);
    }
    const ubicar = (arr, lado) => {
      arr.sort((a, b) => a.y - b.y);
      let ult = -Infinity;
      for (const it of arr) {
        let ly = Math.max(it.y, ult + sep, franja ? franja.y0 + 12 : 0);
        ly = Math.min(ly, franja ? franja.y1 - 12 : h - 40); ult = ly; it.ly = ly;
        const w0 = it.ancho || 160;
        let lx = lado < 0 ? xIzq(it) : xDer(it);
        lx = lado < 0 ? Math.max(limIzq + w0, lx) : Math.min(w - borde - w0, lx);
        it.lx = lx; it.lado = lado;
      }
    };
    ubicar(izq, -1); ubicar(der, 1);
    for (const it of [...izq, ...der]) this.dibujar(it);
  }

  dibujar(it) {
    const { el, linea, punto } = it;
    el.style.opacity = it.alpha.toFixed(3);
    el.style.visibility = 'visible';
    const derecha = it.lado > 0;
    el.classList.toggle('der', derecha);
    el.style.transform = `translate(${derecha ? it.lx + 6 : it.lx - 6}px, ${it.ly}px) translate(${derecha ? '0' : '-100%'}, -50%)`;
    const codo = derecha ? it.lx - 14 : it.lx + 14;
    linea.setAttribute('points', `${it.x.toFixed(1)},${it.y.toFixed(1)} ${codo.toFixed(1)},${it.ly.toFixed(1)} ${it.lx.toFixed(1)},${it.ly.toFixed(1)}`);
    linea.style.opacity = punto.style.opacity = (it.alpha * 0.9).toFixed(3);
    punto.setAttribute('cx', it.x.toFixed(1)); punto.setAttribute('cy', it.y.toFixed(1));
  }

  ocultar(it) {
    if (it.el.style.visibility === 'hidden') return;
    it.el.style.visibility = 'hidden'; it.el.style.opacity = '0';
    it.linea.style.opacity = it.punto.style.opacity = '0';
  }
}
