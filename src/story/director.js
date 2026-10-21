// Director: convierte la posición del scroll en el estado de la escena (cámara, dispositivos, luces, apertura).
import { INICIAL, ANCLAS, encuadreConfigurador } from './timeline.js';

const CLAVES = Object.keys(INICIAL);
const smooth = (x) => x * x * (3 - 2 * x);
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

export class Director {
  constructor({ reducido }) {
    this.reducido = reducido;
    this.secciones = new Map();         // id → { el, top, alto, largo }
    this.producto = 'ambos';
    this.estado = { ...INICIAL };       // valor suavizado que se dibuja
    this.objetivo = { ...INICIAL };
    this.anclas = [];
    this.medir();
  }

  medir() {
    const vh = innerHeight;
    this.vh = vh;
    this.secciones.clear();
    document.querySelectorAll('[data-escena]').forEach((el) => {
      const r = el.getBoundingClientRect();
      const top = r.top + scrollY;
      this.secciones.set(el.id, { el, top, alto: el.offsetHeight, largo: Math.max(1, el.offsetHeight - vh) });
    });
    this.armarAnclas();
  }

  armarAnclas() {
    let previo = { ...INICIAL };
    this.anclas = [];
    for (const a of ANCLAS) {
      const s = this.secciones.get(a.sec); if (!s) continue;
      const y = s.top + a.p * s.largo;
      const datos = a.s === 'configurador' ? encuadreConfigurador(this.producto) : a.s;
      const estado = { ...previo, ...datos };
      this.anclas.push({ y, estado, sec: a.sec });
      previo = estado;
    }
    this.anclas.sort((a, b) => a.y - b.y);
  }
  setProducto(p) { this.producto = p; this.armarAnclas(); }

  progreso(id) {
    const s = this.secciones.get(id); if (!s) return -1;
    return Math.min(1, Math.max(0, (scrollY - s.top) / s.largo));
  }
  // sección activa (la que ocupa el centro de la pantalla)
  activa() {
    const y = scrollY + this.vh * 0.5;
    for (const [id, s] of this.secciones) if (y >= s.top && y < s.top + s.alto) return id;
    return null;
  }

  calcular() {
    const y = scrollY, A = this.anclas;
    if (!A.length) return this.objetivo;
    let i = 0;
    while (i < A.length - 1 && A[i + 1].y <= y) i++;
    const a = A[i], b = A[Math.min(i + 1, A.length - 1)];
    let t = b.y > a.y ? Math.min(1, Math.max(0, (y - a.y) / (b.y - a.y))) : 1;
    if (y < A[0].y) t = 0;
    t = this.reducido ? (t < 0.5 ? 0 : 1) : smooth(t);
    const o = this.objetivo;
    for (const k of CLAVES) {
      const va = a.estado[k], vb = b.estado[k];
      o[k] = k === 'az' ? va + wrap(vb - va) * t : va + (vb - va) * t;
    }
    return o;
  }

  // avanza el estado suavizado hacia el objetivo (el leve retardo da sensación de peso)
  paso(dt) {
    const o = this.calcular(), e = this.estado;
    const k = this.reducido ? 1 : 1 - Math.exp(-dt * 4.2);
    for (const c of CLAVES) e[c] += (c === 'az' ? wrap(o[c] - e[c]) : o[c] - e[c]) * k;
    return e;
  }
  saltar() { this.calcular(); Object.assign(this.estado, this.objetivo); }
}
