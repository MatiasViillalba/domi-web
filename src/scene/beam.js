// Haz de datos entre NODO y CORE: representación conceptual de la red del hogar (no es una pieza física).
import * as THREE from 'three';

const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = `uniform vec3 uColor; uniform float uTime, uHead, uFlow, uDir, uOpacity, uBase;
  varying vec2 vUv;
  void main(){
    float u = vUv.x;
    float ends = smoothstep(0.0, 0.05, u) * smoothstep(1.0, 0.95, u);
    float f = fract(u * 5.0 - uTime * 0.55 * uDir);
    float dash = smoothstep(0.0, 0.08, f) * smoothstep(0.32, 0.1, f);
    float head = uHead < -0.5 ? 0.0 : exp(-pow((u - uHead) / 0.035, 2.0)) * 2.2 + exp(-pow((u - uHead) / 0.12, 2.0)) * 0.35;
    float a = (uBase + dash * uFlow * 0.9 + head) * ends * uOpacity;
    gl_FragColor = vec4(uColor * (0.6 + head * 0.8), a);
  }`;

export class Haz {
  constructor(scene) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color('#34E07A') }, uTime: { value: 0 }, uHead: { value: -1 }, uFlow: { value: 1 },
        uDir: { value: 1 }, uOpacity: { value: 0 }, uBase: { value: 0.12 } },
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.curva = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    this.color = new THREE.Color('#34E07A');
  }

  // a: punto del NODO, b: punto del CORE. cielo (0..1): la voz se va "a la nube" en lugar de llegar al CORE.
  // bajo (0..1): con los equipos abiertos el haz viaja en un arco bajo, por debajo de las carcasas elevadas.
  update(a, b, { opacidad, cielo = 0, cabeza = -1, flujo = 1, dir = 1, color, t, grosor = 0.55, bajo = 0 }) {
    this.mesh.visible = opacidad > 0.003;
    if (!this.mesh.visible) return;
    const dist = a.distanceTo(b);
    const alto = Math.max(a.y, b.y) + 40 + dist * 0.42;
    const altoBajo = Math.max(a.y, b.y) + 14 + dist * 0.08;
    const h1 = alto + (altoBajo - alto) * bajo, h2 = alto * 0.92 + (altoBajo * 0.96 - alto * 0.92) * bajo;
    const f1 = 0.22 + 0.1 * bajo, f2 = 0.72 - 0.04 * bajo;
    const p = this.curva.points;
    p[0].copy(a);
    p[1].set(a.x + (b.x - a.x) * f1, h1, a.z + (b.z - a.z) * f1 - 10 * (1 - bajo));
    p[2].set(a.x + (b.x - a.x) * f2, h2, a.z + (b.z - a.z) * f2 - 10 * (1 - bajo));
    p[3].copy(b);
    if (cielo > 0) {   // la línea sube y sale del cuadro
      const sky = [new THREE.Vector3(a.x - 10, a.y + 160, a.z - 40), new THREE.Vector3(a.x - 40, a.y + 420, a.z - 160), new THREE.Vector3(a.x - 90, a.y + 1100, a.z - 520)];
      for (let i = 1; i < 4; i++) p[i].lerp(sky[i - 1], cielo);
    }
    const g = new THREE.TubeGeometry(this.curva, 120, grosor, 8, false);
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
    if (color) this.color.lerp(color, 0.12);
    const u = this.mat.uniforms;
    u.uColor.value.copy(this.color); u.uTime.value = t; u.uHead.value = cabeza; u.uFlow.value = flujo; u.uDir.value = dir; u.uOpacity.value = opacidad;
  }
}
