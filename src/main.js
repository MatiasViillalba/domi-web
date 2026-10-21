// Punto de entrada. Si no hay WebGL, la página muestra vistas renderizadas de los mismos modelos CAD.
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
// ?limpio → solo la escena 3D, sin interfaz (para capturas y video)
if (new URLSearchParams(location.search).has('limpio')) document.body.classList.add('limpio');

function hayWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

const pct = document.getElementById('carga-pct');
const simbolo = document.querySelector('.carga-simbolo path');
function alProgreso(p) {
  const v = Math.max(0, Math.min(1, p));
  pct.textContent = Math.round(v * 100) + ' %';
  simbolo.style.setProperty('--falta', (1 - v).toFixed(3));
}

if (!hayWebGL()) {
  document.body.classList.add('sin-webgl', 'listo');
} else {
  import('./scene/app.js')
    .then(({ iniciar }) => iniciar({ base: import.meta.env.BASE_URL, alProgreso, reducido }))
    .catch((err) => {
      console.error(err);
      document.body.classList.add('sin-webgl', 'listo');
    });
}
