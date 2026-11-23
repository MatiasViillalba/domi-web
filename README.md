# DOMI · web

Web de producto de DOMI, el asistente de voz con procesamiento local para empresas y organizaciones.
Un DOMI CORE por sede y un DOMI NODO en cada sala, en 3D real y con un recorrido que avanza con el
scroll: presentación, sistema, NODO con batería, privacidad, CORE con Ryzen 5 PRO, diseño (vista
abierta), cómo funciona, terminaciones, precios y especificaciones. Al final reúne la comparación de
producto, las situaciones de uso, el panel de control y las nueve láminas A3 del trabajo integrador
(AE4), con la explicación de cada una.

Precios sugeridos: DOMI CORE US$ 449, DOMI NODO con cable US$ 39 y DOMI NODO con batería US$ 59.

Diseño de producto: Fabricio Iván Coronil (DOMI NODO) y Alejandro Matías Villalba (DOMI CORE).

## Requisitos

- Node.js 20 o superior (probado con Node 24 y npm 11).
- Un navegador con WebGL 2 (Chrome, Edge, Firefox o Safari actuales). Sin WebGL la página
  muestra imágenes del producto y todo el texto.

## Uso

```bash
npm install        # una sola vez
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run build      # versión final en dist/
npm run preview    # sirve dist/ en http://localhost:4173 para revisarla
```

`dist/` es estática y usa rutas relativas: se puede publicar tal cual en GitHub Pages, Netlify,
Vercel o cualquier hosting de archivos.

### GitHub Pages

El flujo `.github/workflows/pages.yml` compila y publica la web en cada push a `main`.
En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Herramientas de verificación

Necesitan el servidor en marcha (`npm run dev` o `npm run preview`) y usan el Microsoft Edge
instalado (playwright-core, no descarga navegadores).

| Comando | Qué hace |
| --- | --- |
| `npm run pruebas -- [url] [carpeta]` | 15 pruebas: abrir, ensamblar y restablecer; selección con mouse, teclado y toque; privacidad; colores por dispositivo; exploración libre; consola sin errores; que la página no muestre datos internos; movimiento reducido y versión sin WebGL. |
| `npm run capturas -- [url] [ancho] [alto] [carpeta] [seccion:p ...]` | Capturas en distintos puntos del recorrido. |
| `npm run primer-plano -- [url] [carpeta] [escala]` | Primeros planos de los dispositivos a alta densidad de píxeles. |
| `npm run renders -- [url] [carpeta]` | Imágenes limpias (`?limpio`) para `public/renders/`. |

`npm run modelos` regenera `public/models/*.glb` a partir de los modelos de diseño (antes, si cambió el CAD del CORE:
`freecadcmd tools/exportar_core.py`, que actualiza `cad_fuente/core_cad.json`). Necesita
material del proyecto que no forma parte de este repositorio.

## Estructura

```
index.html                 contenido y secciones (todo el texto de la página)
src/main.js                detección de WebGL, carga diferida de la escena, pantalla de carga
src/data/producto.js       estados de luz, pasos de una conversación, colores y combinaciones
src/data/piezas.js         partes de cada equipo para la vista abierta: nombre, texto y recorrido
src/scene/stage.js         escenario: estudio de luz, piso, sombra de contacto, posprocesado, calidad
src/scene/materials.js     materiales y regla de contraste del símbolo DOMI
src/scene/device.js        base común: carga, apertura por grupos, selección, transición de colores
src/scene/nodo.js          NODO: luz de estado, tela, rejilla perforada, privacidad
src/scene/core.js          CORE: barra de luz, colores de cuerpo y tapa
src/scene/beam.js          haz de luz NODO → CORE (la voz que viaja por el Wi-Fi de la empresa)
src/scene/app.js           cámara, lógica por sección, selección, exploración libre, bucle de cuadros
src/story/timeline.js      encuadres y apertura en cada punto del recorrido
src/story/director.js      interpola el recorrido según el scroll
src/ui/labels.js           etiquetas con líneas guía sobre las piezas 3D
src/ui/interfaz.js         textos que aparecen, navegación, vista abierta, configurador, exploración
src/ui/laminas.js          visor de las láminas A3 en PDF
src/styles/main.css        estilos, celular y accesibilidad
src/styles/producto-ae4.css  secciones del AE4: comparación, usos, panel, láminas y precios
recursos/                  imágenes de las láminas, de los usos en la oficina, de Figma y del panel
public/models/             nodo.glb y core.glb
public/renders/            imágenes del producto (versión sin WebGL y tarjetas de precios)
public/laminas/            láminas A3 en PDF (vistas múltiples, isométricas, explotadas y renders)
public/panel/              panel de control DOMI para la oficina (demostración con datos de ejemplo)
public/brand/              logo y símbolo DOMI
```

## Calidad, accesibilidad y rendimiento

- En computadoras la escena se dibuja por encima de la resolución de la pantalla (hasta 2×) con
  antialiasing 4×; si los cuadros no alcanzan, la resolución baja sola de a poco.
- La rueda y el toque nunca se bloquean: el scroll es nativo y la escena lo sigue.
- `prefers-reduced-motion`: sin animaciones de cámara; la escena salta a cada vista.
- Teclado: navegación por secciones, lista de partes seleccionable, `Esc` cierra la ficha o sale de la exploración.
- `?limpio` en la URL oculta la interfaz y deja solo la escena.
