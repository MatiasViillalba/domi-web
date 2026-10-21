// Guion de la escena 3D vinculado al scroll.
// Cada ancla fija valores en un punto de una sección (p = 0 → 1). Entre anclas se interpola con suavizado,
// así que al subir la secuencia retrocede sola. Los valores que una ancla no menciona se heredan.
//
// Cámara: objetivo (tx, ty, tz), azimut (az°, 0 = frente), elevación (el°), radio a encuadrar (r, mm)
// y desplazamiento del sujeto en pantalla (ox: + derecha, oy: + arriba; fracción de media pantalla).
// En pantallas verticales: mox/moy/mr reemplazan a ox/oy/r (texto abajo, producto arriba).

export const INICIAL = {
  tx: 0, ty: 40, tz: 0, az: 0, el: 6, r: 215, ox: 0, oy: -0.44, mox: 0, moy: -0.32, mr: 0.82,
  nX: -80, nY: 0, nZ: 0, nRot: 0.32, nExp: 0,
  cX: 74, cY: 0, cZ: 6, cRot: -0.34, cExp: 0,
  key: 0, rim: 0.25, fill: 0.05, env: 0.12, haz: 0, cielo: 0, flujo: 1, piso: 0.4,
  fade: 1,
};

export const ANCLAS = [
  // 1 · Presentación: la luz revela las formas
  { sec: 'inicio', p: 0, s: {} },
  { sec: 'inicio', p: 0.45, s: { key: 1, rim: 1, fill: 1, env: 1, el: 9, r: 200, oy: -0.42, mr: 0.92 } },
  { sec: 'inicio', p: 1, s: { el: 13, az: -10, r: 150, oy: -0.2, mr: 1.1, moy: -0.1 } },

  // 2 · El problema: la voz sube y se va de la casa
  { sec: 'problema', p: 0.0, s: {} },
  { sec: 'problema', p: 0.35, s: { tx: -80, ty: 70, az: 18, el: 10, r: 105, ox: 0.34, oy: 0, mox: 0, moy: 0.2, cX: 300, cZ: -80, haz: 1, cielo: 1 } },
  { sec: 'problema', p: 1, s: { az: 6, el: 18, r: 120 } },

  // 3 · El sistema: la línea vuelve y entra al CORE
  { sec: 'sistema', p: 0, s: {} },
  { sec: 'sistema', p: 0.4, s: { tx: 0, ty: 52, az: 0, el: 16, r: 190, ox: 0, oy: -0.1, moy: 0.08, mr: 1.15, nX: -100, cX: 96, cZ: 0, cRot: -0.28, nRot: 0.25, cielo: 0 } },
  { sec: 'sistema', p: 1, s: { az: -12, el: 20, r: 182 } },

  // 4 · El exterior del NODO: la cámara se acerca y gira
  { sec: 'nodo-exterior', p: 0, s: {} },
  { sec: 'nodo-exterior', p: 0.18, s: { tx: 0, ty: 56, az: 28, el: 8, r: 112, ox: 0.2, oy: 0, moy: 0.2, mr: 1.05, nX: 0, nRot: 0, cX: 340, cZ: -120, haz: 0 } },
  { sec: 'nodo-exterior', p: 0.6, s: { az: -26, el: 16, r: 108 } },
  { sec: 'nodo-exterior', p: 1, s: { az: -150, el: 22, r: 110 } },

  // 5 · Privacidad: vista de la tapa
  { sec: 'privacidad', p: 0, s: {} },
  { sec: 'privacidad', p: 0.3, s: { tx: 0, ty: 90, az: 4, el: 56, r: 84, ox: 0.26, oy: -0.04, moy: 0.22 } },
  { sec: 'privacidad', p: 1, s: { az: -12, el: 62, r: 82 } },

  // 6 · El exterior del CORE
  { sec: 'core-exterior', p: 0, s: {} },
  { sec: 'core-exterior', p: 0.16, s: { tx: 0, ty: 22, az: 32, el: 12, r: 108, ox: 0.2, oy: 0, moy: 0.2, nX: -360, nZ: -120, cX: 0, cZ: 0, cRot: 0 } },
  { sec: 'core-exterior', p: 0.42, s: { az: -24, el: 6, r: 104 } },
  { sec: 'core-exterior', p: 0.7, s: { az: -160, el: 16, r: 106 } },
  { sec: 'core-exterior', p: 1, s: { az: -210, el: 50, r: 108 } },

  // 7 · El interior: apertura del NODO y luego del CORE
  { sec: 'interior', p: 0, s: {} },
  { sec: 'interior', p: 0.08, s: { tx: 0, ty: 62, az: 26, el: 10, r: 92, ox: 0.28, moy: 0.3, mr: 1.22, nX: 0, nZ: 0, cX: 380, cZ: -140, nExp: 0 } },
  { sec: 'interior', p: 0.4, s: { ty: 166, az: -18, el: 14, r: 206, nExp: 1 } },
  { sec: 'interior', p: 0.46, s: { az: -26 } },
  { sec: 'interior', p: 0.54, s: { tx: 0, ty: 28, az: 30, el: 16, r: 100, nX: -380, nZ: -140, cX: 0, cZ: 0, cExp: 0 } },
  { sec: 'interior', p: 0.92, s: { ty: 116, az: -16, el: 22, r: 196, cExp: 1 } },
  { sec: 'interior', p: 1, s: { az: -22 } },

  // 8 · La inteligencia: los dos, abiertos a medias, y la voz que viaja
  { sec: 'inteligencia', p: 0, s: {} },
  { sec: 'inteligencia', p: 0.12, s: { tx: 0, ty: 100, az: 0, el: 14, r: 232, ox: 0.36, oy: 0.02, moy: -0.08, mr: 1.42, nX: -112, nZ: 0, nRot: 0.2, cX: 108, cZ: 0, cRot: -0.22, nExp: 0.5, cExp: 0.5, haz: 1, flujo: 0 } },
  { sec: 'inteligencia', p: 1, s: { az: -8, el: 18 } },

  // 9 · El ensamblaje: todo vuelve a su lugar
  { sec: 'ensamblaje', p: 0, s: {} },
  { sec: 'ensamblaje', p: 0.65, s: { tx: 0, ty: 40, az: -10, el: 11, r: 150, ox: 0.3, oy: 0, moy: 0.2, mr: 1.05, nX: -80, nZ: 0, nRot: 0.32, cX: 74, cZ: 6, cRot: -0.34, nExp: 0, cExp: 0, haz: 0 } },
  { sec: 'ensamblaje', p: 1, s: { az: 8, el: 13 } },

  // 10 · Personalización (el encuadre lo ajusta el configurador)
  { sec: 'personaliza', p: 0, s: {} },
  { sec: 'personaliza', p: 0.25, s: 'configurador' },
  { sec: 'personaliza', p: 1, s: 'configurador' },

  // 11 · Comprar y especificaciones: la escena se apaga
  { sec: 'comprar', p: 0, s: { fade: 1 } },
  { sec: 'comprar', p: 0.12, s: { fade: 0 } },
];

// Encuadre del configurador según el producto elegido
export function encuadreConfigurador(producto) {
  if (producto === 'nodo') return { tx: 0, ty: 52, az: 18, el: 12, r: 82, ox: 0, oy: 0.14, moy: 0.3, mr: 1.5, nX: 0, nZ: 0, nRot: 0, cX: 360, cZ: -140, cRot: 0 };
  if (producto === 'core') return { tx: 0, ty: 22, az: 22, el: 16, r: 86, ox: 0, oy: 0.14, moy: 0.3, mr: 1.5, nX: -380, nZ: -140, nRot: 0, cX: 0, cZ: 0, cRot: 0 };
  return { tx: 0, ty: 42, az: -6, el: 13, r: 150, ox: 0, oy: 0.1, moy: 0.3, mr: 1.16, nX: -80, nZ: 0, nRot: 0.32, cX: 74, cZ: 6, cRot: -0.34 };
}
