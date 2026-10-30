// @ts-check
// Lógica pura del mapa de Presencia (sin DOM): rejilla, orden de costura, conteos y textos.
import { clamp, range } from '../core/motion.js';
import { fill } from '../lib/format.js';
import { decodeRunLength } from '../stitch/patterns.js';

/**
 * @typedef {{
 *   i: number, municipio: string, label: string, state: string, presence: boolean,
 *   comisarias: string[], colorFamily: number, labelPos: number[], stitchOrder: number,
 * }} Place
 * @typedef {{ W: number, H: number, S: number, rows: string[], palette: string[][], lab: Record<string, number[] | null> }} MapGrid
 */

/**
 * Rejilla del mapa: para cada celda, el índice del municipio (o -1 si es mar).
 * @param {readonly string[]} rows filas en run-length
 * @param {number} W
 * @returns {Int16Array}
 */
export function buildGrid(rows, W) {
  const grid = new Int16Array(W * rows.length).fill(-1);
  rows.forEach((row, j) => {
    decodeRunLength(row).forEach((value, i) => {
      grid[j * W + i] = value ?? -1;
    });
  });
  return grid;
}

/**
 * Celdas de cada municipio.
 * @param {Int16Array} grid
 * @param {number} count número de municipios
 * @returns {number[][]}
 */
export function cellsByPlace(grid, count) {
  const cells = Array.from({ length: count }, () => /** @type {number[]} */ ([]));
  grid.forEach((id, k) => {
    if (id >= 0) cells[id].push(k);
  });
  return cells;
}

/**
 * Municipios con presencia en el orden en que se bordan.
 * @param {readonly Place[]} places
 * @returns {number[]} índices de `places`
 */
export const revealOrder = (places) =>
  places
    .filter((p) => p.presence)
    .sort((a, b) => a.stitchOrder - b.stitchOrder)
    .map((p) => p.i);

/**
 * Cuántos municipios de cada estado llevan bordados `revealed` municipios.
 * @param {readonly Place[]} places
 * @param {readonly number[]} order
 * @param {number} revealed
 * @param {readonly string[]} states
 * @returns {number[]}
 */
export function countByState(places, order, revealed, states) {
  const counts = states.map(() => 0);
  for (let n = 0; n < revealed; n++) {
    const index = states.indexOf(places[order[n]].state);
    if (index >= 0) counts[index]++;
  }
  return counts;
}

/**
 * Número tal como se muestra: con tope, "+50"; sin tope, el número.
 * @param {number} count
 * @param {number} [cap]
 */
export const countLabel = (count, cap) =>
  cap !== undefined && count > cap ? `+${cap}` : String(count);

/**
 * Cuántos municipios deben estar bordados para una posición de scroll. Empieza un poco antes
 * de que la sección quede fija y termina a mitad de su recorrido.
 * @param {{ y: number, start: number, run: number, vh: number, total: number }} input
 * @returns {number}
 */
export function revealedAt({ y, start, run, vh, total }) {
  const from = start - vh * 0.55;
  const to = start + run * 0.72;
  return Math.round(range(y, from, to) * total);
}

/**
 * Celda bajo un punto del mapa en pantalla.
 * @param {number} x posición en pantalla
 * @param {number} y
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @param {number} W celdas de ancho
 * @param {number} H celdas de alto
 * @returns {{ i: number, j: number } | null}
 */
export function cellAt(x, y, rect, W, H) {
  const i = Math.floor(((x - rect.left) / rect.width) * W);
  const j = Math.floor(((y - rect.top) / rect.height) * H);
  return i >= 0 && j >= 0 && i < W && j < H ? { i, j } : null;
}

/**
 * Municipio en una celda o, si no hay, el más cercano dentro de `radius` celdas: los dedos
 * son anchos y los municipios, chicos.
 * @param {Int16Array} grid
 * @param {number} W
 * @param {number} H
 * @param {{ i: number, j: number }} cell
 * @param {number} [radius]
 * @returns {number} índice o -1
 */
export function placeNear(grid, W, H, { i, j }, radius = 0) {
  for (let r = 0; r <= radius; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const ii = i + di;
        const jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < W && jj < H && grid[jj * W + ii] >= 0)
          return grid[jj * W + ii];
      }
    }
  }
  return -1;
}

/**
 * Color del hilo de un municipio con presencia: la familia de su estado.
 * @param {Place} place
 * @param {readonly string[]} states
 * @param {readonly (readonly string[])[]} palette
 */
export function threadColor(place, states, palette) {
  const family = palette[Math.max(0, states.indexOf(place.state))];
  return family[Math.max(0, place.colorFamily) % family.length];
}

/**
 * @param {{ place: Place, shown: boolean, touch: boolean, text: Record<string, string>, list: Intl.ListFormat }} input
 * @returns {string}
 */
function bodyText({ place, shown, touch, text, list }) {
  if (!place.presence) return touch ? text.notYetTouch : text.notYet;
  if (!shown) return touch ? text.revealTouch : text.reveal;
  const [first] = place.comisarias;
  /** @type {string} */
  let body;
  if (!first) body = touch ? text.playedHere : '';
  else if (first.startsWith('Puerto:')) body = fill(text.port, { name: first.slice(8) });
  else {
    const key = place.comisarias.length > 1 ? 'comisarias' : 'comisaria';
    body = fill(text[key], { list: list.format(place.comisarias) });
  }
  if (!touch) body = body ? `${body} ${text.inviteAgain}` : text.inviteAgain;
  return body;
}

/**
 * Textos del tooltip o de la tarjeta de un municipio.
 * @param {{
 *   place: Place, shown: boolean, isCradle: boolean, touch: boolean,
 *   text: Record<string, string>,
 * }} input `text` es `ui.presence.map`
 * @returns {{ title: string, sub: string, body: string, button: string }}
 */
export function tipTexts({ place, shown, isCradle, touch, text }) {
  const named = place.label !== place.municipio ? `${place.municipio} · ` : '';
  const sub = isCradle ? text.cradleSub : `${named}${place.state}`;
  const list = new Intl.ListFormat(globalThis.document?.documentElement.lang || 'es', { type: 'conjunction' });
  const body = bodyText({ place, shown, touch, text, list });
  return {
    title: place.label,
    sub,
    body,
    button: place.presence ? text.inviteAgainButton : text.inviteHere,
  };
}

/**
 * Posición de una etiqueta fija sobre el mapa, en porcentaje del tamaño del mapa.
 * @param {number[]} pos `[x, y]` en px del mapa original
 * @param {MapGrid} grid
 */
export const labelPercent = ([x, y], { W, H, S }) => ({
  left: clamp((x / (W * S)) * 100, 0, 100),
  top: clamp((y / (H * S)) * 100, 0, 100),
});
