// Partes de cada dispositivo para la vista abierta: nombre y texto para el público, mallas que forman cada
// grupo y coreografía de la apertura.
//
// Los ids son los nombres de las mallas en los GLB (geometría de los modelos de diseño).
// track: segmentos aditivos { t0, t1, d: [x, y, z] } en milímetros sobre el progreso de apertura (0 → 1).
// Las trayectorias siguen el orden de armado y se verificaron contra las cajas de cada pieza para que
// ninguna atraviese a otra.
// destacado: la parte se puede tocar, tiene etiqueta y aparece en la lista. El resto acompaña la apertura.
// La web es pública: los textos cuentan qué aporta cada parte, no cómo está hecha por dentro.

const seg = (t0, t1, x, y, z) => ({ t0, t1, d: [x, y, z] });

export const NODO = {
  nombre: 'DOMI NODO',
  centro: [0, 55, 0],
  radio: 72,
  // elevación de todo el conjunto mientras la base baja: la base queda apoyada en el piso
  lift: { t0: 0.55, t1: 0.92, y: 40 },
  grupos: [
    {
      id: 'carcasa_superior', nombre: 'Rejilla 360°', destacado: true,
      texto: 'Una rejilla perforada en toda la vuelta: el sonido sale parejo hacia todo el ambiente y la luz se ve desde cualquier lado.',
      piezas: ['BandaSuperior', 'Rejilla', 'TelaAcustica'], track: [seg(0.0, 0.35, 0, 150, 0)],
      etiqueta: { pieza: 'BandaSuperior', titulo: 'Rejilla 360°', sub: 'Sonido y luz para todo el ambiente', ancla: [36, 0, 30] },
    },
    {
      id: 'tapa', nombre: 'Tapa táctil', destacado: true,
      texto: 'Toda la tapa es un botón. Un toque apaga el micrófono y el ícono se pone rojo.',
      piezas: ['Vidrio', 'Icono'], track: [seg(0.12, 0.4, 0, 48, 0)],
      etiqueta: { pieza: 'Vidrio', titulo: 'Tapa táctil', sub: 'Un toque apaga el micrófono' },
    },
    {
      id: 'portavidrio', nombre: 'Soporte de la tapa',
      piezas: ['Portavidrio', 'GuiaLuz', 'Resortes'],
      tracks: { Portavidrio: [seg(0.28, 0.52, 0, 36, 0)], GuiaLuz: [seg(0.28, 0.52, 0, 36, 0)], Resortes: [seg(0.3, 0.56, 0, 26, 0)] },
    },
    {
      id: 'placa', nombre: 'Dos micrófonos', destacado: true,
      texto: 'Dos micrófonos te escuchan desde cualquier lugar del ambiente. DOMI reconoce su nombre ahí mismo: hasta que lo decís, no envía nada.',
      piezas: ['PlacaPrincipal', 'Radio', 'Pulsador', 'Microfonos', 'Juntas', 'LEDPrivacidad', 'Integrados', 'Capacitores', 'Conectores',
        'TornillosPlaca', 'Antena', 'Marcados', 'Vias', 'Pistas', 'Pasivos_sup', 'Resistores_sup', 'Pads_sup', 'Serigrafia_sup'],
      track: [seg(0.36, 0.62, 0, 14, 0)],
      etiqueta: { pieza: 'PlacaPrincipal', titulo: 'Dos micrófonos', sub: 'Te escuchan desde cualquier lado', ancla: [-30, 2, 0] },
    },
    {
      id: 'difusor', nombre: 'Difusor de luz', destacado: true,
      texto: 'Funde los puntos de luz en un brillo suave y continuo detrás de la rejilla.',
      piezas: ['Difusor'], track: [seg(0.42, 0.72, 0, 0, 22)],
      etiqueta: { pieza: 'Difusor', titulo: 'Difusor de luz', sub: 'Un brillo suave y continuo', ancla: [30, 10, 0] },
    },
    {
      id: 'luz', nombre: 'Luz de estado', destacado: true,
      texto: '91 luces LED de color y un anillo en la base te muestran si DOMI te escucha, piensa o responde.',
      piezas: ['MatrizFlex', 'MatrizLED', 'PlacaAnilloLED', 'AnilloLED'],
      etiqueta: { pieza: 'MatrizLED', titulo: '91 luces LED', sub: 'Te dicen qué está pasando', ancla: [-28, -6, 0] },
    },
    {
      id: 'acustica', nombre: 'Parlante', destacado: true,
      texto: 'Apunta hacia abajo, contra un deflector: así el sonido se reparte en 360° y llena el ambiente.',
      piezas: ['Parlante', 'Diafragma', 'Arana', 'TerminalesParlante', 'CableRojo', 'CableNegro', 'Relleno'],
      etiqueta: { pieza: 'Parlante', titulo: 'Parlante', sub: 'Sonido en 360°', minT: 0.93 },
    },
    {
      id: 'chasis', nombre: 'Estructura interna',
      piezas: ['Chasis'], fantasma: { t0: 0.74, t1: 0.96, opacidad: 0.14 },
    },
    {
      id: 'alimentacion', nombre: 'Alimentación',
      piezas: ['PlacaAlimentacion', 'USBC', 'ConectorAlim', 'CintaAlim', 'Pasivos_inf', 'Resistores_inf', 'Pads_inf', 'Serigrafia_inf'],
    },
    {
      id: 'carcasa_inferior', nombre: 'Cuerpo',
      piezas: ['BandaInferior', 'SimboloFrontal'],
    },
    {
      id: 'cierre', nombre: 'Cierre inferior',
      piezas: ['TapaInferior', 'Tornillos'],
      tracks: { TapaInferior: [seg(0.55, 0.92, 0, -18, 0)], Tornillos: [seg(0.55, 0.92, 0, -30, 0)] },
    },
    {
      id: 'base', nombre: 'Base de silicona', destacado: true,
      texto: 'Antideslizante y suave con los muebles. Tapa los tornillos: no queda ninguno a la vista.',
      piezas: ['BaseSilicona', 'LogoBase'], track: [seg(0.55, 0.92, 0, -40, 0)],
      etiqueta: { pieza: 'BaseSilicona', titulo: 'Base de silicona', sub: 'Antideslizante', ancla: [34, 0, 0] },
    },
  ],
};

export const CORE = {
  nombre: 'DOMI CORE',
  centro: [0, 50, 0],
  radio: 92,
  lift: { t0: 0.72, t1: 0.96, y: 36 },
  // Orden de apertura: sale la tapa; el panel frontal y la entrada USB-C se retiran hacia adentro para
  // liberar las paredes; sube el cuerpo (más alto que todo el interior) y recién ahí se separan las piezas.
  grupos: [
    {
      id: 'tapa', nombre: 'Tapa', destacado: true,
      texto: 'Lleva el símbolo DOMI. Podés elegir su color por separado del cuerpo.',
      piezas: ['Carcasa_tapa', 'Logo_DOMI'], track: [seg(0.0, 0.2, 0, 150, 0)],
      etiqueta: { pieza: 'Carcasa_tapa', titulo: 'Tapa', sub: 'Elegí su color', ancla: [44, 2, 0] },
    },
    {
      id: 'cableado', nombre: 'Cableado',
      piezas: ['Cable_alimentacion', 'Ficha_USB_C_metal', 'Cable_alim_rojo', 'Cable_alim_negro', 'Cinta_hilo_1', 'Cinta_hilo_2',
        'Cinta_hilo_3', 'Cinta_hilo_4', 'Cinta_hilo_5', 'Cable_ventilador_rojo', 'Cable_ventilador_negro'],
      ocultar: { t0: 0.04, t1: 0.14 },
    },
    {
      id: 'placa', nombre: 'Procesamiento local', destacado: true,
      texto: 'El corazón de DOMI: convierte tu voz en texto, entiende lo que pedís y arma la respuesta, todo dentro de tu casa.',
      piezas: ['Placa_PCB', 'Placa_pads_montaje', 'Placa_SoC_sustrato', 'Placa_SoC_IHS', 'Placa_RAM', 'Placa_chips', 'Placa_inductores', 'Placa_cristales',
        'Placa_WiFi_blindaje', 'Placa_antena', 'Placa_LED_PWR', 'Placa_LED_ACT', 'Placa_GPIO_base', 'Placa_GPIO_pines', 'Placa_USB_C', 'Placa_lenguas',
        'Placa_microSD_zocalo', 'Placa_microSD', 'Placa_SMD_capacitores', 'Placa_SMD_resistencias', 'Conectores_Dupont'],
      track: [seg(0.46, 0.7, 0, 38, 0)],
      etiqueta: { pieza: 'Placa_PCB', titulo: 'Procesamiento local', sub: 'Toda la inteligencia, en casa', ancla: [-30, 0, 20] },
    },
    {
      id: 'tornillos_placa', nombre: 'Fijaciones',
      piezas: ['Tornillos_placa'], track: [seg(0.46, 0.7, 0, 54, 0)],
    },
    {
      id: 'refrigeracion', nombre: 'Disipadores', destacado: true,
      texto: 'Aletas de aluminio alineadas con el paso del aire para que DOMI trabaje fresco.',
      piezas: ['Pads_termicos', 'Disipador_principal', 'Disipadores_aux'],
      tracks: { Pads_termicos: [seg(0.46, 0.7, 0, 48, 0)], Disipador_principal: [seg(0.46, 0.7, 0, 60, 0)], Disipadores_aux: [seg(0.46, 0.7, 0, 60, 0)] },
      etiqueta: { pieza: 'Disipador_principal', titulo: 'Disipadores', sub: 'Aletas de aluminio', ancla: [0, 4, 0] },
    },
    {
      id: 'panel', nombre: 'Luz y botón', destacado: true,
      texto: 'Al frente, solo lo justo: una barra de luz que muestra qué hace DOMI y el botón de encendido.',
      piezas: ['Luz_DOMI', 'Boton_encendido', 'Boton_encendido_icono', 'Guia_luz', 'LEDs_blancos', 'LEDs_fosforo', 'PCB_frontal', 'PCB_frontal_SMD',
        'Pulsador_tactil', 'Pulsador_chapa', 'Pulsador_actuador', 'Conector_JST'],
      track: [seg(0.12, 0.24, 0, 0, -4.5), seg(0.62, 0.84, 0, 10, 40)],
      tracks: { Tornillos_PCB_frontal: [seg(0.06, 0.18, 0, 0, -14), seg(0.62, 0.84, 0, 10, 31)] },
      extra: ['Tornillos_PCB_frontal'],
      etiqueta: { pieza: 'PCB_frontal', titulo: 'Luz y botón', sub: 'El frente, simple', ancla: [-8, 10, 6] },
    },
    {
      id: 'carcasa', nombre: 'Carcasa', destacado: true,
      texto: 'Esquinas suaves y una sola pieza, sin tornillos a la vista.',
      piezas: ['Carcasa_cuerpo'], track: [seg(0.26, 0.5, 0, 100, 0)],
      etiqueta: { pieza: 'Carcasa_cuerpo', titulo: 'Carcasa', sub: 'Una sola pieza', ancla: [-50, 0, 30] },
    },
    {
      id: 'entrada', nombre: 'Entrada USB-C', destacado: true,
      texto: 'La única conexión del CORE. La red es por Wi-Fi: no necesita ningún otro cable.',
      piezas: ['PCB_entrada', 'USB_C_receptaculo', 'USB_C_receptaculo_lengua', 'PCB_entrada_pads', 'PCB_entrada_SMD', 'Tornillos_PCB_entrada'],
      track: [seg(0.12, 0.2, 0, 3, 0), seg(0.16, 0.24, 0, 0, 4), seg(0.62, 0.84, 0, 0, -46)],
      etiqueta: { pieza: 'PCB_entrada', titulo: 'USB-C', sub: 'Un solo cable' },
    },
    {
      id: 'ventilador', nombre: 'Ventilación', destacado: true,
      texto: 'Mueve el aire hacia la base, que lo saca por atrás.',
      piezas: ['Ventilador_marco', 'Ventilador_rotor', 'Ventilador_etiqueta', 'Tornillos_ventilador'],
      track: [seg(0.66, 0.84, -44, 0, 0)], tracks: { Tornillos_ventilador: [seg(0.58, 0.66, 0, 24, 0), seg(0.66, 0.84, -44, 0, 0)] },
      etiqueta: { pieza: 'Ventilador_marco', titulo: 'Ventilación', sub: 'El aire sale por atrás' },
    },
    {
      id: 'base', nombre: 'Base flotante', destacado: true,
      texto: 'El aire entra por adelante y sale por atrás, a través de una rejilla con filtro antipolvo.',
      piezas: ['Base_ventilada', 'Filtro_polvo'],
      etiqueta: { pieza: 'Base_ventilada', titulo: 'Base flotante', sub: 'Con filtro antipolvo', ancla: [44, 0, 20] },
    },
    {
      id: 'cierre', nombre: 'Aro de goma',
      piezas: ['Aro_goma', 'Tornillos_base'],
      tracks: { Aro_goma: [seg(0.72, 0.96, 0, -36, 0)], Tornillos_base: [seg(0.72, 0.96, 0, -22, 0)] },
    },
  ],
};

// Mallas del NODO que reúnen componentes de dos placas a distinta altura: se separan por la altura del triángulo
// para que cada parte acompañe a su placa en la vista abierta.
export const NODO_PARTIR = { ids: ['Pasivos', 'Resistores', 'Pads', 'Serigrafia'], corteY: 60 };
