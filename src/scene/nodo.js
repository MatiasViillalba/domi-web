// DOMI NODO v2: geometría del CAD de F. I. Coronil + rejilla, tela y luz de estado.
// Los patrones de luz y la grilla de la rejilla se adaptaron del visor_3d del kit.
import * as THREE from 'three';
import { Dispositivo, prog } from './device.js';
import { TIPOS, uvCaja, colorLogo } from './materials.js';
import { NODO, NODO_PARTIR } from '../data/piezas.js';
import { ESTADOS } from '../data/producto.js';

// Grilla real (visor_3d/domi.json)
const REJ = { r_in: 47.2, r_out: 48.0, z0: 18, z1: 90, columnas: 126, filas: 33, z_primera_fila: 20.9, paso_z: 2.0784609690826525, agujero: 1.6 };
const MAT = { cols: 13, filas: 7, a0: 195, a1: 345, z0: 41, dz: 7 };
const PA = (MAT.a1 - MAT.a0) / MAT.cols;

const COL = {
  vidrio: { grafito: '#050507', blanco: '#ecece8', gris: '#b9bcc2', beige: '#c9bda6' },
  base: { grafito: '#232428', blanco: '#cfcfca', gris: '#9a9da3', beige: '#ab9f88' },
  tela: { grafito: '#0b0b0d', blanco: '#c9c9c4', gris: '#6e7177', beige: '#8a7f6c' },
};

// Agujeros de la rejilla calculados en el shader (no en una textura): bordes nítidos a cualquier distancia,
// con alpha-to-coverage sobre el MSAA. De lejos, cuando el agujero es menor que un píxel, se funde en el
// área abierta promedio del CAD (40,3 %) en lugar de producir moiré.
function perforar(mat) {
  mat.defines = { ...(mat.defines || {}), USE_UV: '' };
  mat.alphaTest = 0.5; mat.alphaToCoverage = true;
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
      {
        const float COLS = ${REJ.columnas.toFixed(1)}, FILAS = ${REJ.filas.toFixed(1)}, R = ${REJ.r_out.toFixed(3)};
        const float Z0 = ${REJ.z0.toFixed(3)}, Z1 = ${REJ.z1.toFixed(3)}, ZF = ${REJ.z_primera_fila.toFixed(4)}, PZ = ${REJ.paso_z.toFixed(6)};
        const float RA = ${(REJ.agujero / 2).toFixed(3)}, VUELTA = 6.2831853;
        float z = Z0 + vUv.y * (Z1 - Z0);
        float a = fract(vUv.x - 0.25);                       // vuelta en [0, 1): misma fase que la grilla del CAD
        float paso = 1.0 / COLS, d = 1e3;
        float j0 = floor((z - ZF) / PZ);
        for (int k = 0; k < 2; k++) {
          float j = j0 + float(k);
          if (j < 0.0 || j > FILAS - 1.0) continue;
          float off = mod(j, 2.0) * 0.5;
          float i = floor(a / paso - off + 0.5);
          float da = (a - (i + off) * paso) * VUELTA * R;
          d = min(d, length(vec2(da, z - (ZF + j * PZ))));
        }
        float w = max(fwidth(d), 1e-4);
        float nitido = smoothstep(RA - w * 0.5, RA + w * 0.5, d);
        diffuseColor.a *= mix(nitido, 1.0 - 0.403, smoothstep(0.35, 0.9, w / RA));
      }`);
  };
  mat.customProgramCacheKey = () => 'rejilla-perforada';
}

export class Nodo extends Dispositivo {
  constructor(gltfRoot, Q) {
    super(NODO, gltfRoot);
    this.Q = Q;
    this.estado = 'reposo'; this.estadoPrev = 'reposo'; this.mezcla = 1;
    this.col = new THREE.Color(ESTADOS.reposo.color);
    this.led = new Float32Array(MAT.cols * MAT.filas); this.ledA = new Float32Array(this.led.length); this.ledB = new Float32Array(this.led.length);
    this.anillo = new Float32Array(11);
    this.presion = 0; this.presionT = 0;
    this.privado = false;
    this.partirMallas();
    this.armarMateriales();
    this.armarRejilla();
    this.armarGrupos();
    this.mapearLeds();
    this.setExplode(0);
  }

  // Pasivos, resistores, pads y serigrafía están en dos placas: se separan por altura.
  partirMallas() {
    for (const id of NODO_PARTIR.ids) {
      const p = this.piezas.get(id); if (!p) continue;
      const m = p.mesh, g = m.geometry, pos = g.attributes.position, idx = g.index;
      const sup = [], inf = [];
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
        const y = ((pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3) * m.scale.y + m.position.y;
        (y > NODO_PARTIR.corteY ? sup : inf).push(a, b, c);
      }
      for (const [suf, arr] of [['_sup', sup], ['_inf', inf]]) {
        if (!arr.length) continue;
        const g2 = new THREE.BufferGeometry();
        for (const k of Object.keys(g.attributes)) g2.setAttribute(k, g.attributes[k]);
        g2.setIndex(arr);
        const m2 = new THREE.Mesh(g2, m.material);
        m2.name = id + suf; m2.position.copy(m.position); m2.scale.copy(m.scale); m2.quaternion.copy(m.quaternion);
        m.parent.add(m2);
        const p2 = this.registrar(id + suf, m2); p2.extras = p.extras;
      }
      m.parent.remove(m); this.piezas.delete(id);
    }
  }

  armarMateriales() {
    const POR_MAT = {
      alu: () => TIPOS.carcasa_pc('#1d1e22'), vidrio: () => TIPOS.vidrio(COL.vidrio.grafito), logo: () => TIPOS.logo('#c8cbcd'),
      icono: () => TIPOS.emisor('#ffffff'), chasis: () => TIPOS.plastico_mate('#2a2b30'), opalo: () => Object.assign(TIPOS.opalo('#6c7077'), { opacity: 0.42 }),
      cristal: () => TIPOS.cristal('#cfe3ff'), silicona: () => TIPOS.goma('#2a2b2f'), pcb: () => TIPOS.pcb('#0f3221'),
      flex: () => TIPOS.plastico('#c9822a'), led: () => TIPOS.led(), metal: () => TIPOS.metal('#c5c8cd'), iman: () => TIPOS.metal('#7a7d84'),
      cono: () => TIPOS.plastico_mate('#2b2b30'), ic: () => TIPOS.plastico('#141416'), conector: () => TIPOS.plastico('#d8d2c2'),
      cobre: () => TIPOS.plastico('#c23a2c'), cable_negro: () => TIPOS.plastico('#111113'), tornillo: () => TIPOS.metal('#5a5c62'),
      pista: () => TIPOS.pcb('#1d5a3a'), serigrafia: () => TIPOS.plastico_mate('#d4d4cf'), oro: () => TIPOS.oro('#e3b75a'),
      mlcc: () => TIPOS.plastico('#b79c6e'), resistor: () => TIPOS.plastico('#18181a'), marcado: () => TIPOS.aluminio('#8a8d93'),
      relleno: () => TIPOS.relleno('#8a8984'), tela: () => TIPOS.plastico_mate('#0b0b0d'),
    };
    for (const p of this.piezas.values()) {
      const k = p.extras.mat || 'chasis';
      const mat = (POR_MAT[k] || POR_MAT.chasis)();
      this.setMaterial(p.id, mat);
      if (k === 'alu' || k === 'silicona' || k === 'chasis') uvCaja(p.mesh, k === 'silicona' ? 10 : 16);
      if (k === 'icono' || k === 'led') mat.userData.emisivoPropio = true;
    }
    this.mIcono = this.piezas.get('Icono')?.mesh.material;
    this.mLedPriv = this.piezas.get('LEDPrivacidad')?.mesh.material;
    this.mDifusor = this.piezas.get('Difusor')?.mesh.material;
    if (this.mDifusor) this.mDifusor.emissive = new THREE.Color(0), this.mDifusor.userData.emisivoPropio = true;
  }

  armarRejilla() {
    // tela acústica con el brillo de los LED y rejilla perforada con la grilla exacta del CAD
    this.glowC = document.createElement('canvas'); this.glowC.width = 1024; this.glowC.height = 256;
    this.gctx = this.glowC.getContext('2d');
    this.ledC = document.createElement('canvas'); this.ledC.width = 1024; this.ledC.height = 256;
    this.lctx = this.ledC.getContext('2d');
    this.glowTex = new THREE.CanvasTexture(this.glowC); this.glowTex.colorSpace = THREE.SRGBColorSpace;
    this.glowTex.wrapS = THREE.RepeatWrapping; this.glowTex.offset.x = 0.5;

    const telaGLB = this.piezas.get('TelaAcustica'); if (telaGLB) telaGLB.mesh.removeFromParent();
    const mTela = TIPOS.plastico_mate(COL.tela.grafito);
    mTela.emissiveMap = this.glowTex; mTela.emissive = new THREE.Color(0xffffff); mTela.emissiveIntensity = 2.4; mTela.side = THREE.DoubleSide;
    mTela.userData.emisivoPropio = true;
    const tela = new THREE.Mesh(new THREE.CylinderGeometry(47.05, 47.05, 68, 192, 1, true), mTela);
    tela.position.y = 54; tela.name = 'TelaAcustica';
    this.modelo.add(tela);
    this.registrar('TelaAcustica', tela); this.setMaterial('TelaAcustica', mTela);

    const mRej = TIPOS.carcasa_pc('#24252a');
    mRej.metalness = 0.35; mRej.roughness = 0.5; mRej.normalMap = null; mRej.roughnessMap = null;
    perforar(mRej); mRej.side = THREE.DoubleSide;
    mRej.emissiveMap = this.glowTex; mRej.emissive = new THREE.Color(0xffffff); mRej.emissiveIntensity = 0.1; mRej.userData.emisivoPropio = true;
    // una sola pared: con dos cilindros (cara exterior e interior de la chapa) los agujeros se recortan entre sí y se ven poligonales
    const ext = new THREE.Mesh(new THREE.CylinderGeometry(REJ.r_out, REJ.r_out, 72, 256, 1, true), mRej);
    ext.position.y = 54; ext.name = 'Rejilla';
    this.modelo.add(ext);
    this.registrar('Rejilla', ext); this.setMaterial('Rejilla', mRej);
    this.mTela = mTela; this.mRej = mRej;
  }

  // índice de LED de cada vértice de la matriz y del anillo (el orden de vértices cambia al optimizar el GLB)
  mapearLeds() {
    const ang = (x, z) => ((Math.atan2(-z, x) * 180) / Math.PI + 360) % 360;
    const prep = (id, fn) => {
      const p = this.piezas.get(id); if (!p) return null;
      const m = p.mesh, pos = m.geometry.attributes.position, n = pos.count;
      const ix = new Int16Array(n);
      for (let i = 0; i < n; i++) ix[i] = fn(pos.getX(i) * m.scale.x + m.position.x, pos.getY(i) * m.scale.y + m.position.y, pos.getZ(i) * m.scale.z + m.position.z);
      const col = new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.12), 3);
      m.geometry.setAttribute('color', col);
      return { ix, col };
    };
    this.vMatriz = prep('MatrizLED', (x, y, z) => {
      const c = Math.min(MAT.cols - 1, Math.max(0, Math.floor((ang(x, z) - MAT.a0) / PA)));
      const r = Math.min(MAT.filas - 1, Math.max(0, Math.round((y - MAT.z0) / MAT.dz)));
      return c * MAT.filas + r;
    });
    this.anguloAnillo = [];
    for (let k = 0; k < 12; k++) {
      const a = 15 + 30 * k, x = 43.3 * Math.cos(a * Math.PI / 180), y = 43.3 * Math.sin(a * Math.PI / 180);
      if (!(x >= 4 && x <= 12 && y > 30)) this.anguloAnillo.push(a);
    }
    this.vAnillo = prep('AnilloLED', (x, y, z) => {
      const a = ang(x, z); let best = 0, bd = 1e9;
      this.anguloAnillo.forEach((b, i) => { const d = Math.abs(((a - b + 540) % 360) - 180); if (d < bd) { bd = d; best = i; } });
      return best;
    });
  }

  // ---------------------------------------------------------------- luz de estado
  setEstado(s) { this.estado = s; }
  efectivo() { return this.privado ? 'silencio' : this.estado; }
  patron(s, t, out) {
    out.fill(0);
    if (s === 'reposo' || s === 'silencio') return;
    const cols = MAT.cols, rows = MAT.filas, cc = (cols - 1) / 2, cr = (rows - 1) / 2, mmc = 38.8 * PA * Math.PI / 180;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const x = (c - cc) / cc, v = r / (rows - 1); let I = 0;
      if (s === 'escuchando') I = Math.exp(-(((v - 0.95) / 0.2) ** 2)) * (0.5 + 0.5 * Math.cos(x * Math.PI / 2)) * (0.8 + 0.2 * Math.sin(t * 2.2));
      else if (s === 'pensando') {
        const dx = (c - cc) * mmc, dy = (r - cr) * MAT.dz, d = Math.hypot(dx, dy);
        let ph = Math.atan2(dy, dx) / (Math.PI * 2) - t * 0.55; ph -= Math.floor(ph);
        I = Math.exp(-(((d - 19) / 4.5) ** 2)) * (0.3 + 0.7 * ph ** 1.6);
      } else if (s === 'respondiendo') {
        const env = 0.5 + 0.5 * Math.abs(Math.sin(t * 5.2) * Math.sin(t * 1.9 + 0.6));
        I = Math.exp(-((v / 0.28) ** 2)) * (0.55 + 0.45 * Math.cos(x * Math.PI / 2)) * env;
      }
      out[c * rows + r] = I;
    }
  }
  dibujarBrillo() {
    const W = this.ledC.width, H = this.ledC.height, l = this.lctx, g = this.gctx, col = this.col;
    l.fillStyle = '#000'; l.fillRect(0, 0, W, H);
    const rgb = `${Math.round(Math.min(1, col.r) * 255)},${Math.round(Math.min(1, col.g) * 255)},${Math.round(Math.min(1, col.b) * 255)}`;
    const px = 38.8 * PA * Math.PI / 180 / (2 * Math.PI * 47) * W;
    const uvOf = (a, z) => [((((a + 270) % 360) + 360) % 360) / 360, (z - 20) / 68];
    for (let c = 0; c < MAT.cols; c++) for (let r = 0; r < MAT.filas; r++) {
      const I = this.led[c * MAT.filas + r]; if (I < 0.01) continue;
      const [u, v] = uvOf(MAT.a0 + PA / 2 + PA * c, MAT.z0 + MAT.dz * r);
      l.fillStyle = `rgba(${rgb},${Math.min(1, I)})`; l.beginPath(); l.arc(u * W, (1 - v) * H, px * 0.72, 0, 7); l.fill();
    }
    for (let k = 0; k < this.anguloAnillo.length; k++) {
      const I = this.anillo[k]; if (I < 0.01) continue;
      const [u] = uvOf(this.anguloAnillo[k], 0);
      const gr = l.createLinearGradient(0, H, 0, H * 0.72); gr.addColorStop(0, `rgba(${rgb},${I})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      l.fillStyle = gr; l.fillRect(u * W - 26, H * 0.72, 52, H * 0.28);
    }
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.filter = 'blur(13px)'; g.drawImage(this.ledC, 0, 0); g.drawImage(this.ledC, 0, 0);
    g.filter = 'blur(5px)'; g.globalAlpha = 0.45; g.drawImage(this.ledC, 0, 0);
    g.globalAlpha = 1; g.filter = 'none';
    this.glowTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- privacidad (demostración del comportamiento propuesto)
  setPrivado(v) { this.privado = v; this.presionT = 1; }

  setExplode(t) {
    super.setExplode(t);
    const d = -0.4 * this.presion;       // recorrido real de la tapa: 0,4 mm
    for (const id of ['Vidrio', 'Icono', 'Portavidrio', 'GuiaLuz']) { const p = this.piezas.get(id); if (p) p.mesh.position.y += d; }
  }

  // ---------------------------------------------------------------- colores del configurador
  setColores(cuerpo, tapa) {
    const C = { grafito: '#1d1e22', blanco: '#e7e7e3', gris: '#b9bcc2', beige: '#c9bda6' };
    for (const id of ['BandaInferior', 'BandaSuperior', 'TapaInferior']) this.colorear(this.piezas.get(id)?.mesh.material, C[cuerpo]);
    this.colorear(this.mRej, cuerpo === 'grafito' ? '#24252a' : C[cuerpo]);
    this.colorear(this.mTela, COL.tela[cuerpo]);
    this.colorear(this.piezas.get('BaseSilicona')?.mesh.material, COL.base[cuerpo]);
    this.colorear(this.piezas.get('SimboloFrontal')?.mesh.material, colorLogo(C[cuerpo]));
    this.colorear(this.piezas.get('LogoBase')?.mesh.material, colorLogo(COL.base[cuerpo]));
    this.colorear(this.piezas.get('Vidrio')?.mesh.material, COL.vidrio[tapa]);
  }

  update(dt, t, explode) {
    this.presionT = Math.max(0, this.presionT - dt * 3.2);
    this.presion += ((this.presionT > 0.5 ? 1 : 0) - this.presion) * Math.min(1, dt * 18);
    this.setExplode(explode);
    super.update(dt);
    if (!this.root.visible) return;          // fuera de cuadro no se calcula la luz
    // estado de luz con transición suave
    const s = this.efectivo();
    if (s !== this.mostrado) { this.estadoPrev = this.mostrado || 'reposo'; this.mostrado = s; this.mezcla = 0; }
    this.mezcla = Math.min(1, this.mezcla + dt * 2.2);
    this.patron(this.estadoPrev, t, this.ledA);
    this.patron(s, t, this.ledB);
    const m = this.mezcla;
    for (let i = 0; i < this.led.length; i++) this.led[i] = this.ledA[i] * (1 - m) + this.ledB[i] * m;
    const env = s === 'respondiendo' ? 0.45 + 0.55 * Math.abs(Math.sin(t * 5.2) * Math.sin(t * 1.9 + 0.6)) : 0;
    for (let k = 0; k < this.anillo.length; k++) this.anillo[k] += (env - this.anillo[k]) * Math.min(1, dt * 10);
    this.col.lerp(new THREE.Color(ESTADOS[s].color), Math.min(1, dt * 4));
    this.dibujarBrillo();
    // la luz que se ve a través de la rejilla viene de los LED: se apaga cuando la carcasa se aleja
    const cerca = 1 - prog(explode, 0, 0.16);
    this.mTela.emissiveIntensity = 2.4 * cerca; this.mRej.emissiveIntensity = 0.1 * cerca;
    // LED físicos (visibles con la carcasa abierta)
    const pinta = (V, arr, gain) => {
      if (!V) return; const a = V.col.array;
      for (let i = 0; i < V.ix.length; i++) { const I = arr[V.ix[i]]; a[i * 3] = 0.12 + this.col.r * I * gain; a[i * 3 + 1] = 0.12 + this.col.g * I * gain; a[i * 3 + 2] = 0.12 + this.col.b * I * gain; }
      V.col.needsUpdate = true;
    };
    pinta(this.vMatriz, this.led, 2.6);
    pinta(this.vAnillo, this.anillo, 4);
    // ícono de la tapa y LED de privacidad: misma señal
    const ic = s === 'reposo' ? new THREE.Color('#d8dbe2').multiplyScalar(0.7) : this.col.clone().multiplyScalar(2.2);
    if (this.mIcono) this.mIcono.color.copy(ic);
    if (this.mLedPriv) this.mLedPriv.color.copy(ic);
    this.energia = this.led.reduce((a, b) => a + b, 0) / 60 + this.anillo[0] * 0.8;
    if (this.mDifusor) this.mDifusor.emissive.copy(this.col).multiplyScalar(Math.min(1, this.energia) * 0.25);
  }
}
