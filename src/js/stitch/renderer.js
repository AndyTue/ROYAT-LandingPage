// @ts-check

/**
 * @typedef {import('./order.js').OrderedStitch} OrderedStitch
 * @typedef {Pick<CanvasRenderingContext2D, 'beginPath' | 'moveTo' | 'lineTo' | 'stroke' | 'strokeStyle' | 'lineWidth'>} StrokeContext
 * @typedef {{ i: number, j: number, rise: string, fall: string }} PreparedStitch
 * @typedef {{
 *   readonly size: number,
 *   readonly drawn: number,
 *   advance(progress: number): void,
 *   drawAll(): void,
 *   reset(): void,
 * }} StitchLayer
 */

const SHADOW = 'rgba(40,30,20,.22)';
const HIGHLIGHT = 'rgba(255,255,255,.26)';
/** Margen de la X dentro de su celda. */
const INSET = 0.16;
/** El segundo trazo de la X va detrás del primero por esta fracción del total. */
const LAG = 0.015;
/** Tope de densidad: más de 2 no se nota y multiplica la memoria del canvas. */
export const MAX_DPR = 2;

/**
 * Aclara (`amount` > 0) u oscurece (< 0) un color hexadecimal.
 * @param {string} hex `#RRGGBB`
 * @param {number} amount entre -1 y 1
 * @returns {string}
 */
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const mix = (/** @type {number} */ c) => Math.round(c + (target - c) * a);
  return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

/**
 * Un trazo de hilo: sombra, color y brillo, en ese orden.
 * @param {StrokeContext} ctx
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {string} color
 * @param {number} cell tamaño de la celda en px CSS
 */
export function drawLeg(ctx, x1, y1, x2, y2, color, cell) {
  const width = cell * 0.44;
  ctx.strokeStyle = SHADOW;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1 + 0.5, y1 + 0.7);
  ctx.lineTo(x2 + 0.5, y2 + 0.7);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = HIGHLIGHT;
  ctx.lineWidth = width * 0.28;
  ctx.beginPath();
  ctx.moveTo(x1 - 0.4, y1 - 0.4);
  ctx.lineTo(x2 - 0.4, y2 - 0.4);
  ctx.stroke();
}

/**
 * Cuántas puntadas lleva cada trazo para un avance dado.
 * @param {number} progress entre 0 y 1
 * @param {number} total
 * @returns {{ rise: number, fall: number }} trazo `/` y trazo `\`
 */
export function stitchCounts(progress, total) {
  const p = Math.min(1, Math.max(0, progress || 0));
  const rise = Math.floor(p * total);
  const fall = p >= 1 ? total : Math.max(0, rise - Math.max(1, Math.floor(total * LAG)));
  return { rise, fall };
}

/**
 * Capa de bordado incremental: `advance(p)` dibuja solo las puntadas que faltan hasta `p`,
 * nunca repinta lo ya bordado. Volver atrás requiere `reset()` (y limpiar el canvas).
 * @param {StrokeContext} ctx contexto ya escalado a px CSS (ver `setupCanvas`)
 * @param {readonly OrderedStitch[]} stitches en orden de costura
 * @param {{ cell: number, skip?: (s: OrderedStitch) => boolean }} options
 * @returns {StitchLayer}
 */
export function createStitchLayer(ctx, stitches, { cell, skip }) {
  // Los colores se calculan una vez: advance() corre dentro del loop de animación.
  /** @type {PreparedStitch[]} */
  const list = stitches
    .filter((s) => !skip?.(s))
    .map((s) => ({
      i: s.i,
      j: s.j,
      rise: shade(s.color, s.shade - 0.06),
      fall: shade(s.color, s.shade + 0.04),
    }));
  const pad = cell * INSET;
  let rise = 0;
  let fall = 0;

  /** @param {number} toRise @param {number} toFall */
  const drawTo = (toRise, toFall) => {
    for (; rise < toRise; rise++) {
      const { i, j, rise: color } = list[rise];
      const x = i * cell;
      const y = j * cell;
      drawLeg(ctx, x + pad, y + cell - pad, x + cell - pad, y + pad, color, cell);
    }
    for (; fall < Math.min(toFall, rise); fall++) {
      const { i, j, fall: color } = list[fall];
      const x = i * cell;
      const y = j * cell;
      drawLeg(ctx, x + pad, y + pad, x + cell - pad, y + cell - pad, color, cell);
    }
  };

  return {
    get size() {
      return list.length;
    },
    get drawn() {
      return fall;
    },
    advance(progress) {
      const target = stitchCounts(progress, list.length);
      drawTo(Math.max(rise, target.rise), Math.max(fall, target.fall));
    },
    drawAll() {
      drawTo(list.length, list.length);
    },
    reset() {
      rise = 0;
      fall = 0;
    },
  };
}

/**
 * Dimensiona un canvas para `w`×`h` celdas: el búfer usa la densidad de la pantalla (hasta 2)
 * y el contexto queda escalado para dibujar en px CSS.
 * @param {HTMLCanvasElement} canvas
 * @param {number} w celdas
 * @param {number} h celdas
 * @param {number} cell px CSS por celda
 * @param {number} devicePixelRatio
 * @returns {CanvasRenderingContext2D}
 */
export function setupCanvas(canvas, w, h, cell, devicePixelRatio) {
  const dpr = Math.min(MAX_DPR, devicePixelRatio || 1);
  canvas.width = Math.ceil(w * cell * dpr);
  canvas.height = Math.ceil(h * cell * dpr);
  canvas.style.width = `${w * cell}px`;
  canvas.style.height = `${h * cell}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  return ctx;
}
