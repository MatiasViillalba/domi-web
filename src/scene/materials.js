// Materiales físicamente plausibles, todos mate o satinados, y textura fina procedural para las carcasas.
import * as THREE from 'three';

// Textura de grano fino (PC/ABS texturado) → mapas de normales y de rugosidad.
function texturaGrano(size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  // ruido de valor en dos escalas, periódico
  const rnd = (() => { let s = 1337; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const grid = (n) => { const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) a[i] = rnd(); return a; };
  const g1 = grid(128), g2 = grid(32);
  const samp = (a, n, x, y) => {
    const xi = Math.floor(x) % n, yi = Math.floor(y) % n, xf = x - Math.floor(x), yf = y - Math.floor(y);
    const s = (t) => t * t * (3 - 2 * t);
    const v = (i, j) => a[((yi + j) % n) * n + ((xi + i) % n)];
    return v(0, 0) * (1 - s(xf)) * (1 - s(yf)) + v(1, 0) * s(xf) * (1 - s(yf)) + v(0, 1) * (1 - s(xf)) * s(yf) + v(1, 1) * s(xf) * s(yf);
  };
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    H[y * size + x] = samp(g1, 128, x * 128 / size, y * 128 / size) * 0.7 + samp(g2, 32, x * 32 / size, y * 32 / size) * 0.3;
  }
  const nrm = new Uint8ClampedArray(size * size * 4), rgh = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const h = (i, j) => H[((y + j + size) % size) * size + ((x + i + size) % size)];
    const dx = (h(1, 0) - h(-1, 0)) * 2.2, dy = (h(0, 1) - h(0, -1)) * 2.2;
    const l = Math.hypot(dx, dy, 1), k = (y * size + x) * 4;
    nrm[k] = (-dx / l * 0.5 + 0.5) * 255; nrm[k + 1] = (-dy / l * 0.5 + 0.5) * 255; nrm[k + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[k + 3] = 255;
    const r = 200 + (H[y * size + x] - 0.5) * 90;
    rgh[k] = rgh[k + 1] = rgh[k + 2] = r; rgh[k + 3] = 255;
  }
  const mk = (data) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = 16; t.needsUpdate = true; return t;
  };
  return { normal: mk(nrm), rough: mk(rgh) };
}

let GRANO = null;
export function grano() { return GRANO || (GRANO = texturaGrano()); }

// Coordenadas UV por proyección triplanar (los modelos CAD no traen UV). Escala: milímetros por repetición.
export function uvCaja(mesh, mmPorRepeticion = 14) {
  const g = mesh.geometry; if (g.attributes.uv) return;
  const p = g.attributes.position, n = g.attributes.normal;
  const s = mesh.scale, o = mesh.position;
  const uv = new Float32Array(p.count * 2), k = 1 / mmPorRepeticion;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * s.x + o.x, y = p.getY(i) * s.y + o.y, z = p.getZ(i) * s.z + o.z;
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u * k; uv[i * 2 + 1] = v * k;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

const fis = (o) => new THREE.MeshPhysicalMaterial(o);

// Fábrica por tipo de superficie. Cada malla recibe su propia instancia para poder resaltarla o atenuarla.
export const TIPOS = {
  carcasa_pc: (c) => fis({ color: c, roughness: 0.6, metalness: 0, clearcoat: 0.05, clearcoatRoughness: 0.6, normalMap: grano().normal, normalScale: new THREE.Vector2(0.16, 0.16), roughnessMap: grano().rough, envMapIntensity: 0.9 }),
  anodizado: (c) => fis({ color: c, roughness: 0.38, metalness: 0.5, clearcoat: 0.16, clearcoatRoughness: 0.45, normalMap: grano().normal, normalScale: new THREE.Vector2(0.05, 0.05), roughnessMap: grano().rough, envMapIntensity: 1.45 }),
  base_oscura: (c) => fis({ color: c, roughness: 0.7, metalness: 0, normalMap: grano().normal, normalScale: new THREE.Vector2(0.2, 0.2), envMapIntensity: 0.6 }),
  vidrio: (c) => fis({ color: c, roughness: 0.07, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1 }),
  logo: (c) => fis({ color: c, roughness: 0.6, metalness: 0, envMapIntensity: 0.3 }),
  plastico: (c) => fis({ color: c, roughness: 0.55, metalness: 0, envMapIntensity: 0.7 }),
  plastico_mate: (c) => fis({ color: c, roughness: 0.8, metalness: 0, envMapIntensity: 0.5 }),
  goma: (c) => fis({ color: c, roughness: 0.94, metalness: 0, envMapIntensity: 0.35 }),
  pcb: (c) => fis({ color: c, roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.35, envMapIntensity: 0.8 }),
  metal: (c) => fis({ color: c, roughness: 0.3, metalness: 1, envMapIntensity: 1.0 }),
  aluminio: (c) => fis({ color: c, roughness: 0.36, metalness: 1, envMapIntensity: 1.0 }),
  oro: (c) => fis({ color: c, roughness: 0.26, metalness: 1, envMapIntensity: 1.0 }),
  opalo: (c) => fis({ color: c, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.62, depthWrite: false, envMapIntensity: 0.4 }),
  cristal: (c) => fis({ color: c, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.55, envMapIntensity: 0.6 }),
  relleno: (c) => fis({ color: c, roughness: 1, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false }),
  emisor: (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: true }),
  led: () => new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }),
};

export function luminancia(hex) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}
// Regla del logo (marca/LEEME_PARA_IAS.md): negro sobre superficies claras, blanco sobre oscuras.
export function colorLogo(superficie) {
  return luminancia(superficie) > 0.22 ? '#101113' : '#eeeff1';
}
