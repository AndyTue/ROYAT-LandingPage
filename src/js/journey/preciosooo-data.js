// @ts-check
// Medidas y movimiento de ¡Preciosooo! móvil vertical (MOV-3b). Valores del prototipo
// preciosooo-vertical.html a 390×844; la sección los escala con `f = min(ancho / 390, 1.2)`.

/** Scroll que la tira se queda quieta sobre Vocalistas (px reales, sin escalar). */
export const HOLD = 380;

/** Inicio de la palabra, borde de los bordados y paso entre bordados de las cenefas (px a f = 1). */
export const WORD_TOP = 140;
export const EDGE = {
  left: 2,
  right: 368,
  step: 270,
  leftFrom: 40,
  rightFrom: 175,
};

/** Tarjetas del glosario, en orden: tono, inclinación (°) y deriva vertical (`k`). */
export const CARDS = [
  { tone: 'w', r: -4, k: 0.18 },
  { tone: 'n', r: 4, k: 0.32 },
  { tone: 'o', r: -3, k: 0.24 },
  { tone: 'w', r: 4, k: 0.28 },
  { tone: 'n', r: -4, k: 0.2 },
  { tone: 'o', r: 3, k: 0.3 },
];
/** Columnas de las tarjetas (x a f = 1) y su paso vertical. */
export const CARD = { left: 28, right: 250, top: 10, step: 205 };

/**
 * Motivos en la banda que dejan libre las tarjetas: `yo` es el centro, desde el inicio de la palabra.
 * @type {{ m: string, x: number, yo: number, map?: string }[]}
 */
export const MOTIFS = [
  { m: 'mari', x: 278, yo: 110 },
  { m: 'bird', x: 49, yo: 314 },
  { m: 'birdl', x: 272, yo: 470 },
  { m: 'rombo', x: 66, yo: 724 },
  { m: 'mari', x: 278, yo: 929, map: 'eg,gj' },
];

/**
 * Bordados del panel de Vocalistas. `bottom` ancla al pie de la pantalla (px a f = 1).
 * @type {{ m: string, x: number, y?: number, bottom?: number, ord: string, s: number }[]}
 */
export const VOICE_STITCHES = [
  { m: 'dflor', x: 60, y: 22, ord: 'lr', s: 4 },
  { m: 'dzig', x: 250, y: 22, ord: 'lr', s: 4 },
  { m: 'drombos', x: 40, bottom: 42, ord: 'lr', s: 4 },
  { m: 'flor5', x: 300, bottom: 42, ord: 'lr', s: 4 },
  { m: 'seam', x: 16, y: 110, ord: 'down', s: 5 },
  { m: 'bird', x: 280, y: 74, ord: 'out', s: 5 },
];

/** Foto del trío (px a f = 1): posición y alto del marco. */
export const TRIO = { left: 176, top: 452, height: 276 };
