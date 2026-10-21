// DOMI CORE: geometría del CAD de A. M. Villalba (Modelo_01, 65 piezas; la carcasa dividida en cuerpo y tapa).
import * as THREE from 'three';
import { Dispositivo } from './device.js';
import { TIPOS, uvCaja, colorLogo } from './materials.js';
import { CORE } from '../data/piezas.js';
import { ESTADOS } from '../data/producto.js';

const C = { grafito: '#1d1e22', blanco: '#e7e7e3', gris: '#b9bcc2', beige: '#c9bda6' };

export class Core extends Dispositivo {
  constructor(gltfRoot) {
    super(CORE, gltfRoot);
    this.estado = 'reposo';
    this.col = new THREE.Color('#ffffff');
    this.armarMateriales();
    this.armarGrupos();
    this.setExplode(0);
  }

  armarMateriales() {
    const especiales = {
      Carcasa_cuerpo: () => TIPOS.anodizado(C.grafito), Carcasa_tapa: () => TIPOS.anodizado(C.grafito),
      Boton_encendido: () => TIPOS.anodizado(C.grafito), Boton_encendido_icono: () => TIPOS.logo('#c8cbcd'),
      Logo_DOMI: () => TIPOS.logo('#eeeff1'), Base_ventilada: () => TIPOS.base_oscura('#18191d'),
      Filtro_polvo: () => TIPOS.goma('#040405'), Aro_goma: () => TIPOS.goma('#09090b'),
      Luz_DOMI: () => TIPOS.emisor('#ffffff'), LEDs_blancos: () => TIPOS.emisor('#ffffff'), LEDs_fosforo: () => TIPOS.emisor('#ffffff'),
      Guia_luz: () => TIPOS.opalo('#f2f2f2'), Placa_PCB: () => TIPOS.pcb('#1f6b3a'), PCB_frontal: () => TIPOS.pcb('#0c0f0d'),
      PCB_entrada: () => TIPOS.pcb('#0c0f0d'), Placa_SoC_IHS: () => TIPOS.aluminio('#c9ccd2'), Placa_WiFi_blindaje: () => TIPOS.aluminio('#c3c6cc'),
      Disipador_principal: () => TIPOS.aluminio('#c8ccd3'), Disipadores_aux: () => TIPOS.aluminio('#c8ccd3'),
      Placa_pads_montaje: () => TIPOS.oro('#e3b75a'), Placa_GPIO_pines: () => TIPOS.oro('#e3b75a'), Placa_antena: () => TIPOS.oro('#d9ad55'),
      PCB_entrada_pads: () => TIPOS.oro('#e3b75a'), Pads_termicos: () => TIPOS.plastico_mate('#8fa3bf'),
      Ventilador_marco: () => TIPOS.plastico('#121315'), Ventilador_rotor: () => TIPOS.plastico('#0e0f11'), Ventilador_etiqueta: () => TIPOS.plastico_mate('#050506'),
      Conector_JST: () => TIPOS.plastico('#ece6d4'), Cable_alimentacion: () => TIPOS.plastico_mate('#151517'),
    };
    for (const p of this.piezas.values()) {
      const base = p.mesh.material?.color ? '#' + p.mesh.material.color.getHexString(THREE.SRGBColorSpace) : '#666666';
      const kind = p.extras.kind;
      let mat;
      if (especiales[p.id]) mat = especiales[p.id]();
      else if (kind === 'metal') mat = /tornillo/i.test(p.id) ? TIPOS.metal('#b8bcc3') : TIPOS.metal(base);
      else if (kind === 'pcb') mat = TIPOS.pcb(base);
      else if (kind === 'goma') mat = TIPOS.goma(base);
      else if (kind === 'carcasa') mat = TIPOS.metal(base);
      else mat = TIPOS.plastico(base);
      this.setMaterial(p.id, mat);
      if (/^Carcasa|^Base_ventilada|^Boton_encendido$/.test(p.id)) uvCaja(p.mesh, p.id === 'Base_ventilada' ? 10 : 18);
      if (/^Luz_DOMI|^LEDs_/.test(p.id)) mat.userData.emisivoPropio = true;
    }
    this.mLuz = ['Luz_DOMI', 'LEDs_blancos', 'LEDs_fosforo'].map((id) => this.piezas.get(id)?.mesh.material).filter(Boolean);
    this.mGuia = this.piezas.get('Guia_luz')?.mesh.material;
    if (this.mGuia) { this.mGuia.emissive = new THREE.Color(0); this.mGuia.userData.emisivoPropio = true; }
  }

  setEstado(s) { this.estado = s; }

  setColores(cuerpo, tapa) {
    this.colorear(this.piezas.get('Carcasa_cuerpo')?.mesh.material, C[cuerpo]);
    this.colorear(this.piezas.get('Boton_encendido')?.mesh.material, C[cuerpo]);
    this.colorear(this.piezas.get('Boton_encendido_icono')?.mesh.material, colorLogo(C[cuerpo]) === '#eeeff1' ? '#9ea3ab' : '#3a3c41');
    this.colorear(this.piezas.get('Carcasa_tapa')?.mesh.material, C[tapa]);
    this.colorear(this.piezas.get('Logo_DOMI')?.mesh.material, colorLogo(C[tapa]));
  }

  update(dt, t, explode) {
    this.setExplode(explode);
    super.update(dt);
    // barra de luz: mismo lenguaje de color que el NODO (datos/domi_producto.json → estados_de_luz.core)
    const s = this.estado;
    const objetivo = new THREE.Color(s === 'reposo' || s === 'silencio' ? '#ffffff' : ESTADOS[s].color);
    this.col.lerp(objetivo, Math.min(1, dt * 4));
    const k = s === 'silencio' ? 0.18 : s === 'reposo' ? 0.75 : s === 'pensando' ? 0.62 + 0.38 * Math.sin(t * 5.5) : 0.95;
    const c = this.col.clone().multiplyScalar(0.3 + 1.55 * k);
    for (const m of this.mLuz) m.color.copy(c);
    if (this.mGuia) this.mGuia.emissive.copy(this.col).multiplyScalar(0.55 * k);
    this.energia = k;
  }
}
