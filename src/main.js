import './ui/laminas.js';

// Punto de entrada. Si no hay WebGL, la página muestra vistas renderizadas de los mismos modelos CAD.
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?limpio → solo la escena 3D, sin interfaz (para capturas y video)
if (new URLSearchParams(location.search).has('limpio')) document.body.classList.add('limpio');

const pct = document.getElementById('carga-pct');
function alProgreso(p) {
  const v = Math.max(0, Math.min(1, p));
  pct.textContent = Math.round(v * 100) + ' %';
}

function mostrarImagenes() {
  document.body.classList.remove('cargando-3d', 'listo', 'explorando');
  document.body.classList.add('sin-webgl');
}

import('./scene/app.js')
  .then(({ iniciar }) => iniciar({ base: import.meta.env.BASE_URL, alProgreso, reducido }))
  .then(() => {
    document.body.classList.replace('cargando-3d', 'listo');
  })
  .catch((err) => {
    console.error(err);
    mostrarImagenes();
  });
