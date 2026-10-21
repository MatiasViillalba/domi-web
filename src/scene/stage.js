// Escenario: renderer, ambiente de estudio, luces, piso, sombras de contacto y posprocesado.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

export const BG = new THREE.Color('#08090b');

// Calidad según el equipo. Se ajusta en marcha si los cuadros tardan demasiado.
export function detectarCalidad() {
  const movil = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 600;
  const nucleos = navigator.hardwareConcurrency || 4;
  const memoria = navigator.deviceMemory || 8;
  let nivel = 'alta';
  if (movil || nucleos <= 4 || memoria <= 4) nivel = 'media';
  if (movil && (nucleos <= 4 || memoria <= 3)) nivel = 'baja';
  // en computadoras se dibuja por encima de la densidad de la pantalla (supersampling) para cantos y detalles nítidos;
  // si los cuadros no alcanzan, la calidad adaptativa baja la resolución de a poco
  const dpr = Math.max(1, devicePixelRatio || 1);
  const q = {
    alta: { pr: Math.min(2, dpr * 1.5), msaa: 4, bloom: true, sombra: 1024 },
    media: { pr: Math.min(1.75, dpr * 1.2), msaa: 4, bloom: true, sombra: 512 },
    baja: { pr: Math.min(1.5, dpr), msaa: 2, bloom: false, sombra: 256 },
  }[nivel];
  return { nivel, movil, ...q };
}

// Ambiente de estudio: sala oscura con cajas de luz (softboxes) para reflejos limpios en los cantos.
function ambienteEstudio() {
  const s = new THREE.Scene();
  const sala = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x0b0c0e, side: THREE.BackSide }));
  sala.position.y = 3.5;
  s.add(sala);
  const panel = (w, h, int, pos, rot, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(int), side: THREE.DoubleSide }));
    m.position.set(...pos); m.rotation.set(...rot); s.add(m); return m;
  };
  panel(5.5, 2.4, 2.2, [0, 8.2, 0.6], [Math.PI / 2, 0, 0]);                 // cenital grande
  panel(1.0, 5.0, 3.0, [-4.6, 3.2, 1.6], [0, Math.PI / 2.4, 0]);             // tira lateral izquierda
  panel(0.7, 4.5, 2.2, [4.7, 3.0, -1.2], [0, -Math.PI / 2.2, 0], 0xdfe7ff);   // tira lateral derecha, fría
  panel(4.0, 0.6, 1.4, [0, 2.2, -4.8], [0, 0, 0], 0xe8eeff);                 // contraluz
  panel(3.0, 1.4, 0.55, [0, 1.6, 4.9], [0, Math.PI, 0]);                    // relleno frontal suave
  // gran caja de luz frontal con degradé: dibuja un reflejo suave y continuo en los frentes y en los cantos
  const c = document.createElement('canvas'); c.width = 8; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#8a8a8a'); gr.addColorStop(1, '#1a1a1a');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
  const deg = new THREE.CanvasTexture(c); deg.colorSpace = THREE.SRGBColorSpace;
  // centrada unos 10° por debajo del horizonte: es lo que reflejan los frentes vistos desde una cámara apenas elevada
  const frente = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.2), new THREE.MeshBasicMaterial({ map: deg, color: new THREE.Color(0xffffff).multiplyScalar(4), side: THREE.DoubleSide }));
  frente.position.set(-0.8, -0.8, 4.85); frente.rotation.y = Math.PI; s.add(frente);
  // tira cenital fina sobre el frente: línea de luz nítida en el canto superior
  panel(6.0, 0.25, 4.0, [0, 6.2, 2.6], [Math.PI / 2.6, 0, 0]);
  return s;
}

// Sombras de contacto (técnica de drei/ContactShadows): profundidad vista desde el piso, desenfocada.
class SombraContacto {
  constructor(renderer, res, ancho = 900, profundo = 520, alto = 180) {
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(res, res);
    this.rtBlur = new THREE.WebGLRenderTarget(res, res);
    this.rt.texture.generateMipmaps = this.rtBlur.texture.generateMipmaps = false;
    this.cam = new THREE.OrthographicCamera(-ancho / 2, ancho / 2, profundo / 2, -profundo / 2, 0, alto);
    this.cam.rotation.x = Math.PI / 2;
    this.plano = new THREE.Mesh(new THREE.PlaneGeometry(ancho, profundo).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: this.rt.texture, transparent: true, opacity: 0.92, depthWrite: false }));
    this.plano.scale.z = -1;          // la imagen de la cámara cenital tiene +Z arriba
    this.plano.position.y = 0.06;
    this.plano.renderOrder = -1;
    this.depth = new THREE.MeshDepthMaterial();
    this.depth.depthTest = this.depth.depthWrite = false;
    this.depth.onBeforeCompile = (sh) => {
      sh.uniforms.darkness = { value: 2.6 };
      sh.fragmentShader = 'uniform float darkness;\n' + sh.fragmentShader.replace(
        'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
        'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );');
    };
    this.blurH = new THREE.ShaderMaterial(HorizontalBlurShader); this.blurH.depthTest = false;
    this.blurV = new THREE.ShaderMaterial(VerticalBlurShader); this.blurV.depthTest = false;
    this.blurQuad = new THREE.Mesh(new THREE.PlaneGeometry(), this.blurH);
    this.blurCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
    this.blurQuad.position.z = -0.5;
    this.res = res;
  }
  blur(amount) {
    const r = this.renderer;
    this.blurQuad.material = this.blurH; this.blurH.uniforms.tDiffuse.value = this.rt.texture; this.blurH.uniforms.h.value = amount / 256;
    r.setRenderTarget(this.rtBlur); r.render(this.blurQuad, this.blurCam);
    this.blurQuad.material = this.blurV; this.blurV.uniforms.tDiffuse.value = this.rtBlur.texture; this.blurV.uniforms.v.value = amount / 256;
    r.setRenderTarget(this.rt); r.render(this.blurQuad, this.blurCam);
  }
  render(scene, ocultar) {
    const r = this.renderer;
    const bg = scene.background; scene.background = null;
    const vis = ocultar.map(o => o.visible); ocultar.forEach(o => (o.visible = false));
    this.plano.visible = false;
    scene.overrideMaterial = this.depth;
    const cc = r.getClearAlpha(); r.setClearAlpha(0);
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, this.cam);
    scene.overrideMaterial = null;
    this.blur(1.4); this.blur(0.6);
    r.setRenderTarget(null); r.setClearAlpha(cc);
    this.plano.visible = true;
    ocultar.forEach((o, i) => (o.visible = vis[i]));
    scene.background = bg;
  }
}

// Terminación final: viñeta y grano fino de película, en espacio de salida.
const Terminacion = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrano: { value: 0.012 }, uVineta: { value: 0.32 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uGrano, uVineta; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5; float v = 1.0 - uVineta * smoothstep(0.25, 0.95, dot(d, d) * 2.2);
      float g = (h(vUv * 913.0 + fract(uTime) * 37.0) - 0.5) * uGrano;
      gl_FragColor = vec4(c.rgb * v + g, c.a);
    }`,
};

export function crearEscenario(canvas, Q) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Q.pr);
  // tono neutro (Khronos PBR Neutral): respeta los colores reales de las terminaciones y no aplasta los grises oscuros
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(BG, 1);

  const scene = new THREE.Scene();
  scene.background = BG;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(ambienteEstudio(), 0.03).texture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(26, 1, 5, 6000);

  // luces: principal cálida, contraluz fría y relleno muy bajo
  const luces = {
    key: new THREE.DirectionalLight(0xfff4ea, 2.2),
    rim: new THREE.DirectionalLight(0xc8d6ff, 2.6),
    fill: new THREE.HemisphereLight(0xd9e2ff, 0x08090b, 0.35),
    estado: new THREE.PointLight(0x34e07a, 0, 320, 1.7),
    estado2: new THREE.PointLight(0x34e07a, 0, 260, 1.7),
  };
  luces.key.position.set(-260, 420, 300);
  luces.rim.position.set(320, 220, -380);
  Object.values(luces).forEach(l => scene.add(l));

  // piso: grafito mate con un charco de luz suave bajo los productos
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  // el piso se funde con el fondo por niebla: no hay horizonte visible
  scene.fog = new THREE.Fog(BG, 900, 2300);
  const piso = new THREE.Mesh(new THREE.CircleGeometry(4000, 96).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 0.9, metalness: 0, envMapIntensity: 0.04 }));
  scene.add(piso);
  const charco = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: tex, color: 0x111216, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  charco.position.y = 0.04; scene.add(charco);
  const brilloEstado = new THREE.Mesh(new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: tex, color: 0x34e07a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  brilloEstado.position.y = 0.05; scene.add(brilloEstado);
  // fondo: barrido de estudio que se pierde en negro
  const fondo = new THREE.Mesh(new THREE.PlaneGeometry(9000, 4200),
    new THREE.MeshBasicMaterial({ map: tex, color: 0x15171c, transparent: true, depthWrite: false, fog: false }));
  fondo.position.set(0, 600, -2400); fondo.visible = false; scene.add(fondo);

  const sombra = new SombraContacto(renderer, Q.sombra);
  scene.add(sombra.plano);

  // posprocesado
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: Q.msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.62, 1.05);
  bloom.enabled = Q.bloom;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const terminacion = new ShaderPass(Terminacion);
  composer.addPass(terminacion);

  let w = 1, h = 1;
  function resize() {
    w = canvas.clientWidth || innerWidth; h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return { renderer, scene, camera, luces, piso, charco, brilloEstado, fondo, sombra, composer, bloom, terminacion, resize, size: () => ({ w, h }) };
}
