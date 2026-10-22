// Aplicación 3D: carga los modelos y coordina escena, scroll e interfaz.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { crearEscenario, detectarCalidad } from './stage.js';
import { Nodo } from './nodo.js';
import { Core } from './core.js';
import { Haz } from './beam.js';
import { Director } from '../story/director.js';
import { Etiquetas } from '../ui/labels.js';
import { ESTADOS, CADENA } from '../data/producto.js';
import { NODO as DEF_NODO, CORE as DEF_CORE } from '../data/piezas.js';
import { Interfaz } from '../ui/interfaz.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

export async function iniciar({ base, alProgreso, reducido }) {
  const Q = detectarCalidad();
  const canvas = document.getElementById('gl');
  const E = crearEscenario(canvas, Q);
  E.resize();

  // ---------------------------------------------------------------- carga
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const prog = { nodo: 0, core: 0 };
  const cargar = (f, k) => new Promise((res, rej) => loader.load(base + 'models/' + f, res, (e) => {
    if (e.total) prog[k] = e.loaded / e.total; alProgreso((prog.nodo + prog.core) / 2);
  }, rej));
  const [gN, gC] = await Promise.all([cargar('nodo.glb', 'nodo'), cargar('core.glb', 'core')]);
  alProgreso(1);

  const nodo = new Nodo(gN.scene, Q);
  const core = new Core(gC.scene);
  E.scene.add(nodo.root, core.root);
  const haz = new Haz(E.scene);
  const disp = { nodo, core };

  // ---------------------------------------------------------------- director e interfaz
  const director = new Director({ reducido });
  const etiquetas = new Etiquetas(document.getElementById('etiquetas'), E.camera);
  const ui = new Interfaz({ director, disp, reducido });
  const controls = new OrbitControls(E.camera, canvas);
  controls.enabled = false; controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;

  const ajustar = () => { E.resize(); director.medir(); };
  addEventListener('resize', ajustar);
  new ResizeObserver(() => director.medir()).observe(document.querySelector('main'));
  document.fonts?.ready.then(() => director.medir());
  director.saltar();

  // Compila todos los materiales mientras está la pantalla de carga: si se compilan la primera vez que una pieza
  // aparece en cuadro (el CORE recién en su sección, la vista abierta, la rejilla), el scroll se traba un instante.
  nodo.root.visible = core.root.visible = true;
  E.renderer.compile(E.scene, E.camera);
  for (const d of [nodo, core]) { d.setExplode(1); d.update(0, 0, 1); }
  E.renderer.compile(E.scene, E.camera);
  for (const d of [nodo, core]) { d.setExplode(0); d.update(0, 0, 0); }

  // ---------------------------------------------------------------- selección de piezas (interior)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let abajo = null;
  canvas.addEventListener('pointerdown', (e) => { abajo = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!abajo || Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) > 6) return;
    const d = ui.dispositivoInterior();
    if (!d || !(director.activa() === 'interior' || ui.explorando)) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, E.camera);
    const hits = ray.intersectObjects(disp[d].mallas().filter((m) => m.visible), true);
    const h = hits.find((x) => x.object.material && x.object.material.opacity > 0.3);
    ui.seleccionar(d, h ? disp[d].grupoDe(h.object) : null);
  });
  etiquetas.onClick = (key) => { const [d, g] = key.split(':'); ui.seleccionar(d, g); };

  // ---------------------------------------------------------------- exploración libre
  let volver = 0; const camGuardada = { pos: new THREE.Vector3(), q: new THREE.Quaternion() };
  ui.alExplorar = (activo) => {
    if (activo) {
      const s = director.estado;
      controls.target.set(s.tx, s.ty, s.tz);
      const d0 = E.camera.position.distanceTo(controls.target);
      controls.minDistance = d0 * 0.45; controls.maxDistance = d0 * 1.8;
      controls.minPolarAngle = 0.05; controls.maxPolarAngle = Math.PI * 0.53;
      E.camera.clearViewOffset();
      controls.enabled = true; controls.update();
    } else {
      controls.enabled = false; volver = 1;
      camGuardada.pos.copy(E.camera.position); camGuardada.q.copy(E.camera.quaternion);
    }
  };
  ui.alRestablecerVista = () => { if (controls.enabled) ui.salirExplorar(); };

  // ---------------------------------------------------------------- cámara desde el estado
  function ubicarCamara(s) {
    const { w, h } = E.size();
    const vertical = w / h < 0.85;
    const limpio = document.body.classList.contains('limpio');
    const ox = limpio ? 0 : vertical ? s.mox : s.ox, oy = limpio ? 0 : vertical ? s.moy : s.oy;
    const R = s.r * (vertical ? s.mr : 1);
    const fov = vertical ? 38 : 26;                 // en vertical se abre el ángulo para no alejar tanto la cámara
    if (E.camera.fov !== fov) { E.camera.fov = fov; E.camera.updateProjectionMatrix(); }
    const tv = Math.tan(THREE.MathUtils.degToRad(E.camera.fov / 2));
    const t = Math.min(tv * (1 - Math.abs(oy)), tv * (w / h) * (1 - Math.abs(ox)));
    const dist = (R * Math.sqrt(1 + t * t)) / t;
    E.scene.fog.near = dist * 0.9 + 150; E.scene.fog.far = dist + 1700;   // la niebla borra el horizonte, nunca el producto
    const az = THREE.MathUtils.degToRad(s.az), el = THREE.MathUtils.degToRad(s.el);
    E.camera.position.set(s.tx + Math.sin(az) * Math.cos(el) * dist, s.ty + Math.sin(el) * dist, s.tz + Math.cos(az) * Math.cos(el) * dist);
    E.camera.lookAt(s.tx, s.ty, s.tz);
    E.camera.setViewOffset(w, h, (-ox * w) / 2, (oy * h) / 2, w, h);
    return { centroX: w / 2 + (ox * w) / 2 };
  }

  // encuadre del dispositivo abierto o cerrado (interior), para la apertura manual
  const ENC = { nodo: { cerrado: { ty: 62, r: 92 }, abierto: { ty: 166, r: 206 } }, core: { cerrado: { ty: 32, r: 104 }, abierto: { ty: 123, r: 205 } } };
  function encuadreManual(s, sec) {
    const d = sec === 'interior' ? ui.dispositivoInterior() : null;
    if (!d || !ui.override[d]) return s;
    const eScroll = d === 'nodo' ? s.nExp : s.cExp, eReal = d === 'nodo' ? s.nExpEf : s.cExpEf;
    const sc = { ...s }, E2 = ENC[d], dif = eReal - eScroll;
    const destino = dif > 0 ? E2.abierto : E2.cerrado, k = Math.min(1, Math.abs(dif));
    sc.ty = s.ty + (destino.ty - s.ty) * k; sc.r = s.r + (destino.r - s.r) * k;
    return sc;
  }

  // ---------------------------------------------------------------- lógica de cada sección
  const PI = DEF_NODO, PC = DEF_CORE;
  // cada etiqueta aparece cuando su pieza terminó de separarse
  const finTrayectoria = (g) => Math.max(0, ...[...(g.track || []), ...Object.values(g.tracks || {}).flat()].map((x) => x.t1));
  const etiquetasDe = (d, def, e) => def.grupos.filter((g) => g.etiqueta).map((g) => {
    const L = g.etiqueta, fin = finTrayectoria(g);
    const umbral = L.minT ?? (fin ? fin - 0.04 : 0.88);
    const activa = !!(ui.seleccion && ui.seleccion.d === d && ui.seleccion.g === g.id);
    return { key: `${d}:${g.id}`, pos: disp[d].centro(L.pieza, L.ancla), titulo: L.titulo, sub: L.sub, clic: true,
      alpha: e > umbral && (!ui.seleccion || activa) ? 1 : 0, activa };
  });
  const N = (x, y, z, d) => V(x, y, z).applyQuaternion(disp[d].root.quaternion);

  function logica(sec, s, t) {
    const lista = [];
    let estN = 'reposo', estC = 'reposo';
    const hz = { opacidad: s.haz, cielo: s.cielo, flujo: s.flujo, cabeza: -1, dir: 1, color: null };
    nodo.dimFuerza = core.dimFuerza = 0.72;
    const p = director.progreso(sec);
    if (sec === 'inicio') { estN = p > 0.5 ? 'escuchando' : 'reposo'; }
    else if (sec === 'problema') { estN = 'escuchando'; hz.color = new THREE.Color('#aeb4c0'); }
    else if (sec === 'sistema') {
      estN = estC = p < 0.55 ? 'escuchando' : 'pensando';
      lista.push({ key: 'sis:nodo', pos: nodo.centro('BandaSuperior', [0, 26, 0]), titulo: 'DOMI NODO', sub: 'Te escucha y te responde', alpha: p > 0.3 ? 1 : 0 });
      lista.push({ key: 'sis:core', pos: core.centro('Carcasa_tapa', [0, 8, 0]), titulo: 'DOMI CORE', sub: 'Entiende lo que pedís', alpha: p > 0.38 ? 1 : 0 });
    } else if (sec === 'nodo-exterior') {
      const orden = ['escuchando', 'pensando', 'respondiendo', 'voz'];
      estN = p < 0.14 ? 'reposo' : orden[Math.min(3, Math.floor(((p - 0.14) / 0.86) * 4))];
      const a = p > 0.16 ? 1 : 0;
      lista.push({ key: 'ne:tapa', pos: nodo.centro('Vidrio', [10, 1, -8]), titulo: 'Tapa táctil', sub: 'Un toque apaga el micrófono', alpha: a });
      lista.push({ key: 'ne:mic', pos: nodo.centro('Juntas', [46, 0, 0]), titulo: 'Micrófonos', sub: 'Te escuchan desde cualquier lado', alpha: a, normal: N(1, 0, 0, 'nodo') });
      lista.push({ key: 'ne:rej', pos: nodo.centro('Rejilla', [0, 4, 48]), titulo: 'Sonido 360°', sub: 'Llena todo el ambiente', alpha: a, normal: N(0, 0, 1, 'nodo') });
      lista.push({ key: 'ne:usb', pos: nodo.centro('USBC', [0, 0, -1]), titulo: 'USB-C', sub: 'Un solo cable', alpha: a, normal: N(0, 0, -1, 'nodo') });
    } else if (sec === 'privacidad') {
      estN = 'escuchando';
      lista.push({ key: 'pr:ic', pos: nodo.centro('Icono'), titulo: nodo.privado ? 'Micrófono apagado' : 'Micrófono encendido', sub: nodo.privado ? 'Ícono rojo: DOMI no escucha' : 'Ícono verde: DOMI te escucha', alpha: p > 0.25 ? 1 : 0 });
      lista.push({ key: 'pr:tapa', pos: nodo.centro('Vidrio', [-30, 0, 18]), titulo: 'Toda la tapa es un botón', sub: 'Un toque y listo', alpha: p > 0.3 ? 1 : 0 });
    } else if (sec === 'core-exterior') {
      const a = p > 0.12 ? 1 : 0;
      lista.push({ key: 'ce:luz', pos: core.centro('Luz_DOMI', [0, 0, 1]), titulo: 'Luz de estado', sub: 'Te muestra qué está haciendo', alpha: a, normal: N(0, 0, 1, 'core') });
      lista.push({ key: 'ce:tecla', pos: core.centro('Boton_encendido', [0, 0, 1]), titulo: 'Encendido', sub: 'Un solo botón', alpha: a, normal: N(0, 0, 1, 'core') });
      lista.push({ key: 'ce:base', pos: core.centro('Base_ventilada', [0, -3, 50]), titulo: 'Base flotante', sub: 'Ventilación invisible', alpha: a, normal: N(0, 0, 1, 'core') });
      lista.push({ key: 'ce:usb', pos: core.centro('USB_C_receptaculo', [0, 0, -1.5]), titulo: 'USB-C', sub: 'La única conexión', alpha: a, normal: N(0, 0, -1, 'core') });
    } else if (sec === 'interior') {
      estN = 'pensando';
      const dI = ui.dispositivoInterior();
      if (dI === 'nodo') lista.push(...etiquetasDe('nodo', PI, s.nExpEf));
      if (dI === 'core') lista.push(...etiquetasDe('core', PC, s.cExpEf));
    } else if (sec === 'inteligencia') {
      const n = CADENA.length, q = (p - 0.12) / 0.84;
      const paso = q < 0 ? -1 : Math.min(n - 1, Math.floor(q * n)), qq = q * n - paso;
      ui.pasoCadena(paso, qq);
      const C = CADENA[Math.max(0, paso)];
      estN = estC = paso < 0 ? 'escuchando' : C.estado;
      nodo.dimFuerza = core.dimFuerza = 0.5;
      const sel = [null, null];
      if (paso === 0) { sel[0] = 'placa'; lista.push({ key: 'ia:mic', pos: nodo.centro('Microfonos', [44, 0, 0]), titulo: 'Micrófonos', sub: 'Escuchan «DOMI»', alpha: 1 }); }
      if (paso === 1) {
        sel[0] = 'placa'; sel[1] = 'placa'; hz.cabeza = Math.min(1, qq * 1.15); hz.dir = 1;
        lista.push({ key: 'ia:wifi', pos: core.centro('Placa_WiFi_blindaje'), titulo: 'Por tu Wi-Fi', sub: 'Tu voz no sale de casa', alpha: qq > 0.5 ? 1 : 0 });
      }
      if (paso === 2) {
        sel[1] = 'placa'; hz.flujo = 0.0;
        lista.push({ key: 'ia:soc', pos: core.centro('Placa_SoC_IHS', [0, 2, 0]), titulo: 'Procesamiento local', sub: 'Entiende lo que pediste', alpha: 1 });
      }
      if (paso === 3) {
        sel[0] = 'luz'; hz.cabeza = 1 - Math.min(1, qq * 1.15); hz.dir = -1;
        lista.push({ key: 'ia:hab', pos: nodo.centro('MatrizLED', [0, 0, 6]), titulo: 'DOMI responde', sub: 'Desde el NODO donde hablaste', alpha: qq > 0.4 ? 1 : 0 });
      }
      ui.resaltarCadena(sel);
    } else if (sec === 'ensamblaje') { estN = estC = p < 0.55 ? 'voz' : 'reposo'; }
    else if (sec === 'personaliza') { estN = estC = ui.estadoConfig || 'reposo'; }
    if (sec !== 'inteligencia') ui.resaltarCadena(null);

    nodo.setEstado(estN); core.setEstado(estC);
    hz.color = hz.color || new THREE.Color(ESTADOS[estN === 'reposo' ? 'escuchando' : estN].color);
    return { lista, hz };
  }

  // silueta en pantalla de los productos visibles (las etiquetas se ubican a los costados)
  const caja3 = new THREE.Box3(), esq = new THREE.Vector3();
  function cajaPantalla(w) {
    let x0 = Infinity, x1 = -Infinity;
    for (const d of [nodo, core]) {
      if (!d.root.visible) continue;
      caja3.setFromObject(d.root);
      for (let i = 0; i < 8; i++) {
        esq.set(i & 1 ? caja3.max.x : caja3.min.x, i & 2 ? caja3.max.y : caja3.min.y, i & 4 ? caja3.max.z : caja3.min.z).project(E.camera);
        if (esq.z > 1) continue;
        const x = (esq.x * 0.5 + 0.5) * w; x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      }
    }
    return x0 < x1 ? { x0, x1 } : null;
  }

  // ---------------------------------------------------------------- bucle
  const reloj = new THREE.Clock();
  let t = 0, firmaSombra = '', cuadros = 0, lento = 0, ventana = 0, fadePrev = '';
  const ocultarSombra = [E.piso, E.charco, E.brilloEstado, E.fondo, haz.mesh];
  const capaEtiquetas = document.getElementById('etiquetas');
  const PR_MIN = Q.movil ? 0.75 : 1;
  function cuadro() {
    requestAnimationFrame(cuadro);
    const dt = Math.min(reloj.getDelta(), 0.05);
    if (!reducido) t += dt;
    const s = director.paso(dt);
    const sec = director.activa();
    // medidas de los textos ANTES de tocar estilos: así se usan las del cuadro anterior, ya calculadas
    const { w, h } = E.size();
    const franja = ui.franjaLibre(sec);
    const zona = w >= 900 && ui.zonaTexto(sec) ? { x0: 0, x1: ui.bordeTexto(sec) } : null;
    ui.actualizar(sec, dt);

    // fundido al final (comprar y especificaciones): no se dibuja si no se ve
    const fade = s.fade.toFixed(2);
    if (fade !== fadePrev) { fadePrev = fade; canvas.style.opacity = fade; capaEtiquetas.style.opacity = fade; }
    if (s.fade < 0.01 && !controls.enabled) return;

    // apertura: el scroll manda salvo que el usuario use «Abrir» / «Ensamblar»
    s.nExpEf = ui.explodeEfectivo('nodo', s.nExp, dt);
    s.cExpEf = ui.explodeEfectivo('core', s.cExp, dt);

    nodo.root.position.set(s.nX, s.nY, s.nZ); nodo.root.rotation.y = s.nRot;
    core.root.position.set(s.cX, s.cY, s.cZ); core.root.rotation.y = s.cRot;
    nodo.root.visible = Math.abs(s.nX) < 330; core.root.visible = Math.abs(s.cX) < 330;
    nodo.update(dt, t, s.nExpEf); core.update(dt, t, s.cExpEf);

    E.luces.key.intensity = 2.2 * s.key; E.luces.rim.intensity = 2.6 * s.rim; E.luces.fill.intensity = 0.35 * s.fill;
    E.scene.environmentIntensity = 0.85 * s.env;
    E.charco.material.opacity = 0.5 + 0.5 * s.key;

    // si el usuario abre o ensambla con los botones, el encuadre acompaña la apertura real
    const sc = encuadreManual(s, sec);
    let centroX = E.size().w / 2;
    if (controls.enabled) { controls.update(); }
    else if (volver > 0) {
      ubicarCamara(sc); volver = Math.max(0, volver - dt * 1.6);
      const k = volver * volver;
      tmp.copy(E.camera.position); E.camera.position.lerpVectors(tmp, camGuardada.pos, k);
      const q = E.camera.quaternion.clone(); E.camera.quaternion.slerpQuaternions(q, camGuardada.q, k);
    } else centroX = ubicarCamara(sc).centroX;

    // luz del estado sobre el piso y desde adentro del NODO
    const lg = logica(sec, s, t);
    const colN = nodo.col;
    nodo.centro('MatrizLED', [0, 0, 22], tmp);
    E.luces.estado.position.copy(tmp); E.luces.estado.color.copy(colN);
    E.luces.estado.intensity = nodo.root.visible ? Math.min(1.5, nodo.energia || 0) * 220 * s.key : 0;
    E.luces.estado2.position.copy(core.centro('Luz_DOMI', [0, 0, 18], tmp2)); E.luces.estado2.color.copy(core.col);
    E.luces.estado2.intensity = core.root.visible ? (core.energia || 0) * 60 * s.key : 0;
    E.brilloEstado.position.set(s.nX, 0.05, s.nZ + 20); E.brilloEstado.material.color.copy(colN);
    E.brilloEstado.material.opacity = nodo.root.visible ? Math.min(0.5, (nodo.energia || 0) * 0.35) * s.key : 0;

    // haz de datos
    const a = nodo.centro('Radio', [0, 4, 0], tmp), b = core.centro('Placa_WiFi_blindaje', [0, 6, 0], tmp2);
    haz.update(a, b, { ...lg.hz, t: reducido ? 0 : t, bajo: Math.min(1, Math.max(0, s.nExpEf * 3 - 0.2)) });

    // sombras de contacto: solo cuando algo se mueve
    const firma = [s.nX, s.nZ, s.nRot, s.nExpEf, s.cX, s.cZ, s.cRot, s.cExpEf].map((x) => x.toFixed(1)).join();
    const cadaN = Q.nivel === 'alta' ? 2 : 4;
    if (!Q.sinSombra && ((firma !== firmaSombra && cuadros % cadaN === 0) || cuadros % 30 === 0)) { E.sombra.render(E.scene, ocultarSombra); firmaSombra = firma; }

    E.terminacion.uniforms.uTime.value = t;
    E.composer.render();

    etiquetas.render(lg.lista, { w, h, centroX, compacto: w < 700, caja: cajaPantalla(w), franja, zona });

    // calidad adaptativa: si en una ventana de 2 s más de un cuarto de los cuadros tardan más de 1/45 s,
    // baja la resolución un escalón (sin pasar de la densidad real de la pantalla) y, al final, apaga el bloom
    cuadros++; ventana += dt; if (dt > 1 / 45) lento += dt;
    if (ventana > 2) {
      if (lento / ventana > 0.25) {
        const pr = E.renderer.getPixelRatio();
        if (pr > PR_MIN + 0.01) { E.renderer.setPixelRatio(Math.max(PR_MIN, pr - 0.25)); E.resize(); }
        else if (E.bloom.enabled) E.bloom.enabled = false;
      }
      ventana = 0; lento = 0;
    }
  }
  cuadro();
  document.body.classList.add('listo');
  return { director, ui };
}
