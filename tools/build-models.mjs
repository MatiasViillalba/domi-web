// Convierte la geometría exportada de los modelos FreeCAD (visor_3d del kit: JSON + buffer
// base64 con posiciones/normales float32 e índices uint32, en ejes three.js: Y arriba, frente +Z)
// a GLB optimizados para la web. Los archivos originales del kit NO se modifican.
//
//   npm run modelos
//
// Entrada:  DOMI_Kit_Presentacion/visor_3d/{domi,core}.json + .b64.txt
//           cad_fuente/core_cad.json  (del modelo FreeCAD actual del CORE: carcasa dividida en tapa y
//           cuerpo, y las piezas que cambiaron respecto del kit; ver tools/exportar_core.py)
// Salida:   public/models/nodo.glb, public/models/core.glb, tools/piezas_bbox.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, dedup } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const KIT = process.env.DOMI_KIT || 'C:/Users/Matias/Downloads/DOMI_Kit_Presentacion/DOMI_Kit_Presentacion';
const VISOR = path.join(KIT, 'visor_3d');
const OUT = path.join(ROOT, 'public', 'models');

function readB64(file) {
  return Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
}
function slice(buf, [off, count], Type) {
  const bytes = buf.subarray(off, off + count * Type.BYTES_PER_ELEMENT);
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Type(copy.buffer);
}
function bbox(pos) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
    if (pos[i + k] < mn[k]) mn[k] = pos[i + k];
    if (pos[i + k] > mx[k]) mx[k] = pos[i + k];
  }
  return { min: mn, max: mx };
}
const r2 = v => v.map(x => Math.round(x * 100) / 100);
// La web es pública: las piezas llevan nombres genéricos y solo el dato que necesita el render
// (tipo de material). Las descripciones técnicas quedan en el kit, no en los GLB.
// La tabla de nombres está en interno/nombres.json, que no se publica con el repositorio.
const TABLA = path.join(ROOT, 'interno', 'nombres.json');
const NOMBRES = fs.existsSync(TABLA) ? JSON.parse(fs.readFileSync(TABLA, 'utf8')) : null;
if (!NOMBRES) console.warn('Aviso: falta interno/nombres.json; las piezas conservan sus nombres originales.');
const generico = (id) => {
  if (!NOMBRES) return id;
  if (NOMBRES.exactos[id]) return NOMBRES.exactos[id];
  for (const [de, a] of NOMBRES.prefijos) if (id.startsWith(de)) return a + id.slice(de.length);
  return id;
};

function buildDoc(name, pieces) {
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene(name);
  const root = doc.createNode(name);
  scene.addChild(root);
  const mats = new Map();
  for (const p of pieces) {
    const key = `${p.matKey}|${p.color.join(',')}`;
    if (!mats.has(key)) {
      const m = doc.createMaterial(p.matKey)
        .setBaseColorFactor([...p.color, 1])
        .setRoughnessFactor(p.rough ?? 0.6)
        .setMetallicFactor(p.metal ?? 0);
      mats.set(key, m);
    }
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(p.pos))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(p.nrm))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(p.idx))
      .setMaterial(mats.get(key));
    const mesh = doc.createMesh(p.id).addPrimitive(prim);
    const node = doc.createNode(p.id).setMesh(mesh).setExtras(p.extras);
    root.addChild(node);
  }
  return doc;
}

const KIND_PBR = {
  carcasa: { rough: 0.5, metal: 0 }, plastico: { rough: 0.6, metal: 0 }, metal: { rough: 0.32, metal: 1 },
  pcb: { rough: 0.45, metal: 0 }, logo: { rough: 0.8, metal: 0 }, goma: { rough: 0.95, metal: 0 },
  opalo: { rough: 0.9, metal: 0 }, luz: { rough: 0.3, metal: 0 }, ledcore: { rough: 0.3, metal: 0 },
};
const NODO_COLOR = {
  alu: [0.113, 0.118, 0.133], vidrio: [0.02, 0.02, 0.027], logo: [0.784, 0.796, 0.804], icono: [0.07, 0.07, 0.07],
  chasis: [0.165, 0.169, 0.188], opalo: [0.6, 0.62, 0.64], cristal: [0.81, 0.89, 1], silicona: [0.165, 0.169, 0.184],
  pcb: [0.06, 0.2, 0.13], flex: [0.82, 0.54, 0.17], led: [0.9, 0.9, 0.9], metal: [0.77, 0.78, 0.8], iman: [0.48, 0.49, 0.52],
  cono: [0.17, 0.17, 0.19], ic: [0.08, 0.08, 0.09], conector: [0.74, 0.72, 0.66], cobre: [0.76, 0.23, 0.17],
  cable_negro: [0.07, 0.07, 0.075], tornillo: [0.27, 0.28, 0.3], pista: [0.11, 0.35, 0.23], serigrafia: [0.79, 0.79, 0.77],
  oro: [0.89, 0.72, 0.35], mlcc: [0.72, 0.61, 0.43], resistor: [0.09, 0.09, 0.1], marcado: [0.54, 0.55, 0.58],
  relleno: [0.54, 0.54, 0.52], tela: [0.047, 0.047, 0.055], rejilla: [0.133, 0.137, 0.16],
};
const NODO_PBR = { metal: { metal: 1, rough: 0.3 }, iman: { metal: 1, rough: 0.35 }, tornillo: { metal: 1, rough: 0.35 }, oro: { metal: 1, rough: 0.25 }, vidrio: { rough: 0.06 }, alu: { rough: 0.58 } };

async function main() {
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const informe = {};

  // ------------------------------------------------------------------ NODO v2 (49 piezas, Fabricio I. Coronil)
  {
    const man = JSON.parse(fs.readFileSync(path.join(VISOR, 'domi.json'), 'utf8'));
    const buf = readB64(path.join(VISOR, 'domi.b64.txt'));
    const pieces = man.piezas.map(p => {
      const pos = slice(buf, p.pos, Float32Array), nrm = slice(buf, p.nrm, Float32Array), idx = slice(buf, p.idx, Uint32Array);
      const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));   // glTF usa color lineal
      return {
        id: generico(p.id), pos, nrm, idx, matKey: p.mat, color: (NODO_COLOR[p.mat] || [0.5, 0.5, 0.5]).map(lin),
        rough: NODO_PBR[p.mat]?.rough ?? 0.6, metal: NODO_PBR[p.mat]?.metal ?? 0,
        extras: { mat: p.mat },
      };
    });
    informe.nodo = { piezas: pieces.length, tris: pieces.reduce((a, p) => a + p.idx.length / 3, 0),
      rejilla: man.rejilla, matriz: man.matriz, verificacion: man.verificacion,
      bbox: Object.fromEntries(pieces.map(p => { const b = bbox(p.pos); return [p.id, { min: r2(b.min), max: r2(b.max) }]; })) };
    const doc = buildDoc('DOMI_NODO_v2', pieces);
    await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 10 }));
    await io.write(path.join(OUT, 'nodo.glb'), doc);
  }

  // ------------------------------------------------------------------ CORE (65 piezas, A. M. Villalba)
  {
    const man = JSON.parse(fs.readFileSync(path.join(VISOR, 'core.json'), 'utf8'));
    const buf = readB64(path.join(VISOR, 'core.b64.txt'));
    // carcasa (tapa y cuerpo) y piezas que cambiaron en el modelo FreeCAD actual (tools/exportar_core.py)
    const cad = JSON.parse(fs.readFileSync(path.join(ROOT, 'cad_fuente', 'core_cad.json'), 'utf8'));
    // FreeCAD (x, y, z) -> three (x, z, -y) con el mismo centrado que el visor del kit
    let carcasaBB = null;
    for (const p of man.piezas) if (p.id === 'Carcasa_unibody') carcasaBB = bbox(slice(buf, p.pos, Float32Array));
    // caja exacta de la carcasa en coordenadas FreeCAD, medida sobre las mallas (BoundBox se agranda en curvas)
    const fb = bbox(new Float32Array(cad.carcasa.pos));
    const [fx0, fy0, fz0, fx1, fy1] = [...fb.min, ...fb.max];
    const off = [carcasaBB.min[0] - fx0, carcasaBB.min[1] - fz0, carcasaBB.min[2] + fy1];
    // el CAD puede cambiar de alto; el ancho y el fondo tienen que coincidir con el visor del kit
    const chk = [fx1 + off[0] - carcasaBB.max[0], -fy0 + off[2] - carcasaBB.max[2]];
    const toThree = m => {
      const P = new Float32Array(m.pos.length), N = new Float32Array(m.nrm.length);
      for (let i = 0; i < m.pos.length; i += 3) {
        P[i] = m.pos[i] + off[0]; P[i + 1] = m.pos[i + 2] + off[1]; P[i + 2] = -m.pos[i + 1] + off[2];
        N[i] = m.nrm[i]; N[i + 1] = m.nrm[i + 2]; N[i + 2] = -m.nrm[i + 1];
      }
      return { pos: P, nrm: N, idx: new Uint32Array(m.idx) };
    };
    const pieces = [];
    const agregar = (id, geo, kind, color) => {
      const pbr = KIND_PBR[kind] || KIND_PBR.plastico;
      pieces.push({ id: generico(id), ...geo, matKey: kind, color, rough: pbr.rough, metal: pbr.metal, extras: { kind } });
    };
    for (const p of man.piezas) {
      if (p.id === 'Carcasa_unibody' || cad.quitadas.includes(p.id)) continue;
      const nueva = cad.piezas[p.id];
      const geo = nueva ? toThree(nueva)
        : { pos: slice(buf, p.pos, Float32Array), nrm: slice(buf, p.nrm, Float32Array), idx: slice(buf, p.idx, Uint32Array) };
      agregar(p.id, geo, nueva?.kind || p.kind, nueva?.color || p.color);
    }
    for (const [id, m] of Object.entries(cad.nuevas)) agregar(id, toThree(m), m.kind || 'plastico', m.color || [0.3, 0.3, 0.3]);
    const split = cad;
    const col = [0.1255, 0.1373, 0.1608];
    for (const [id, m] of [['Carcasa_cuerpo', split.cuerpo], ['Carcasa_tapa', split.tapa]]) {
      pieces.unshift({ id, ...toThree(m), matKey: 'carcasa', color: col, rough: 0.5, metal: 0, extras: { kind: 'carcasa' } });
    }
    informe.core = { piezas: pieces.length, tris: pieces.reduce((a, p) => a + p.idx.length / 3, 0), offset_freecad: off,
      control_alineacion_mm: r2(chk),
      bbox: Object.fromEntries(pieces.map(p => { const b = bbox(p.pos); return [p.id, { min: r2(b.min), max: r2(b.max) }]; })) };
    const doc = buildDoc('DOMI_CORE', pieces);
    await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: 16, quantizeNormal: 10 }));
    await io.write(path.join(OUT, 'core.glb'), doc);
  }

  fs.writeFileSync(path.join(HERE, 'piezas_bbox.json'), JSON.stringify(informe, null, 1));
  for (const f of ['nodo.glb', 'core.glb']) console.log(f, (fs.statSync(path.join(OUT, f)).size / 1048576).toFixed(2), 'MB');
  console.log('NODO', informe.nodo.piezas, 'piezas', informe.nodo.tris, 'triángulos');
  console.log('CORE', informe.core.piezas, 'piezas', informe.core.tris, 'triángulos', 'alto', cad_alto(informe), 'mm', 'alineación x/z', informe.core.control_alineacion_mm);
}
const cad_alto = (inf) => Math.max(...Object.values(inf.core.bbox).map((b) => b.max[1]));
main().catch(e => { console.error(e); process.exit(1); });
