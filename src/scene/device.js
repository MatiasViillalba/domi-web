// Dispositivo: piezas del GLB, vista explotada por trayectorias, resaltado, atenuado y transiciones de color.
import * as THREE from 'three';

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const prog = (t, t0, t1) => ease(clamp01((t - t0) / (t1 - t0)));

export class Dispositivo {
  constructor(def, gltfRoot) {
    this.def = def;
    this.root = new THREE.Group();           // ubicación en la escena (x, z, giro)
    this.lift = new THREE.Group();           // elevación del conjunto durante la apertura
    this.root.add(this.lift);
    this.modelo = gltfRoot;
    this.lift.add(this.modelo);
    this.piezas = new Map();                 // id → { mesh, base, track, grupo, mats[] }
    this.grupos = new Map();                 // id → { def, ids[], dim, sel, dimT, selT }
    this.explode = 0;
    this.colores = [];                       // transiciones de color { mat, actual, objetivo }
    const meshes = [];
    gltfRoot.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const m of meshes) this.registrar(m.name, m);
  }

  registrar(id, mesh) {
    mesh.updateMatrix();
    const p = { id, mesh, base: mesh.position.clone(), track: [], grupo: null, extras: mesh.userData || {} };
    mesh.userData.pieza = id;
    mesh.userData.dispositivo = this;
    this.piezas.set(id, p);
    return p;
  }

  // Asigna grupos y trayectorias a partir de la definición (data/piezas.js).
  armarGrupos() {
    for (const g of this.def.grupos) {
      const ids = [...g.piezas, ...(g.extra || [])].filter((id) => this.piezas.has(id));
      this.grupos.set(g.id, { def: g, ids, dim: 0, sel: 0, dimT: 0, selT: 0 });
      for (const id of ids) {
        const p = this.piezas.get(id);
        p.grupo = g.id;
        p.track = (g.tracks && g.tracks[id]) || g.track || [];
      }
    }
  }

  setMaterial(id, mat) {
    const p = this.piezas.get(id); if (!p) return null;
    p.mesh.material = mat;
    mat.userData.base = mat.color ? mat.color.clone() : null;
    mat.userData.opacidad = mat.opacity;
    return mat;
  }

  // ---------------------------------------------------------------- vista explotada
  setExplode(t) {
    this.explode = t;
    const L = this.def.lift;
    this.lift.position.y = L ? L.y * prog(t, L.t0, L.t1) : 0;
    const off = new THREE.Vector3();
    for (const p of this.piezas.values()) {
      off.set(0, 0, 0);
      for (const s of p.track) {
        const k = prog(t, s.t0, s.t1);
        if (k) off.x += s.d[0] * k, off.y += s.d[1] * k, off.z += s.d[2] * k;
      }
      p.mesh.position.copy(p.base).add(off);
    }
    // piezas que se ocultan (cableado) o se vuelven transparentes (chasis)
    for (const g of this.grupos.values()) {
      const o = g.def.ocultar, f = g.def.fantasma;
      if (!o && !f) continue;
      const a = o ? 1 - prog(t, o.t0, o.t1) : 1 - (1 - f.opacidad) * prog(t, f.t0, f.t1);
      for (const id of g.ids) {
        const m = this.piezas.get(id).mesh;
        const mat = m.material;
        m.visible = a > 0.01;
        const transp = a < 0.995;
        if (mat.transparent !== (transp || mat.userData.opacidad < 1)) { mat.transparent = transp || mat.userData.opacidad < 1; mat.needsUpdate = true; }
        mat.opacity = (mat.userData.opacidad ?? 1) * a;
        mat.depthWrite = !transp;
      }
    }
  }

  // ---------------------------------------------------------------- selección
  seleccionar(grupoId) {
    for (const [id, g] of this.grupos) {
      g.selT = grupoId && id === grupoId ? 1 : 0;
      g.dimT = grupoId && id !== grupoId ? 1 : 0;
    }
  }
  grupoDe(mesh) {
    const p = this.piezas.get(mesh.userData.pieza);
    return p ? p.grupo : null;
  }

  // ---------------------------------------------------------------- color
  colorear(mat, hex) {
    if (!mat || !mat.color) return;
    let c = this.colores.find((x) => x.mat === mat);
    if (!c) { c = { mat, objetivo: new THREE.Color() }; this.colores.push(c); }
    c.objetivo.set(hex);
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 7);
    for (const c of this.colores) {
      const b = c.mat.userData.base;
      b.lerp(c.objetivo, 1 - Math.exp(-dt * 5));
    }
    for (const g of this.grupos.values()) {
      g.dim += (g.dimT - g.dim) * k;
      g.sel += (g.selT - g.sel) * k;
      for (const id of g.ids) {
        const mat = this.piezas.get(id).mesh.material;
        if (!mat.userData.base) continue;
        mat.color.copy(mat.userData.base).multiplyScalar(1 - (this.dimFuerza ?? 0.72) * g.dim);
        if (mat.emissive && !mat.userData.emisivoPropio) mat.emissive.setScalar(0.11 * g.sel);
      }
    }
  }

  // centro de una pieza en coordenadas del mundo (para etiquetas y el haz de datos)
  centro(id, ancla, out = new THREE.Vector3()) {
    const p = this.piezas.get(id); if (!p) return out.set(0, 0, 0);
    const g = p.mesh.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    g.boundingBox.getCenter(out);
    p.mesh.updateWorldMatrix(true, false);
    out.applyMatrix4(p.mesh.matrixWorld);
    if (ancla) out.add(new THREE.Vector3(...ancla).applyQuaternion(this.root.quaternion));
    return out;
  }

  mallas() { return [...this.piezas.values()].map((p) => p.mesh); }
}
