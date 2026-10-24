// Datos de DOMI que usa la escena: estados de luz, pasos de una conversación y terminaciones.

export const ESTADOS = {
  reposo:       { id: 'reposo', nombre: 'En reposo', color: '#c9cdd6' },
  escuchando:   { id: 'escuchando', nombre: 'Escuchando', color: '#34E07A' },
  pensando:     { id: 'pensando', nombre: 'Pensando', color: '#3D7BFF' },
  respondiendo: { id: 'respondiendo', nombre: 'Respondiendo', color: '#5A6BFF' },
  silencio:     { id: 'silencio', nombre: 'Micrófono apagado', color: '#FF453A' },
};

// Una conversación, paso a paso (sección «Cómo funciona»)
export const CADENA = [
  { paso: 'Decís «DOMI»', texto: 'El NODO reconoce su nombre por su cuenta. Hasta ese momento no envía nada.', estado: 'escuchando' },
  { paso: 'Tu pedido viaja al CORE', texto: 'Por el Wi-Fi de tu casa, sin salir a internet.', estado: 'escuchando' },
  { paso: 'El CORE lo entiende', texto: 'Pasa tu voz a texto y entiende qué querés, ahí mismo.', estado: 'pensando' },
  { paso: 'DOMI te responde', texto: 'Con voz natural, en español, desde el NODO donde hablaste.', estado: 'respondiendo' },
];

// Terminaciones del configurador
export const COLORES = {
  grafito: { nombre: 'Grafito', hex: '#1d1e22' },
  blanco: { nombre: 'Blanco', hex: '#e7e7e3' },
  gris: { nombre: 'Gris claro', hex: '#b9bcc2' },
  beige: { nombre: 'Beige', hex: '#c9bda6' },
};
export const PRESETS = [
  { id: 'grafito', nombre: 'Grafito', cuerpo: 'grafito', tapa: 'grafito' },
  { id: 'negro-blanco', nombre: 'Cuerpo negro · tapa blanca', cuerpo: 'grafito', tapa: 'blanco' },
  { id: 'blanco-negro', nombre: 'Cuerpo blanco · tapa negra', cuerpo: 'blanco', tapa: 'grafito' },
];
