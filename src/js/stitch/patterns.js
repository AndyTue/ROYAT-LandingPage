// @ts-check

/**
 * Patrones de punto de cruz: cada fila es una cadena; `.` es tela vacía y cada letra es un
 * índice de la paleta de hilos (`a` = 1.er color).
 * @typedef {{ i: number, j: number, color: string }} Stitch
 * @typedef {{ w: number, h: number, stitches: Stitch[] }} Pattern
 * @typedef {{ flip?: string, colorMap?: Record<string, string> }} PatternOptions
 */

const EMPTY = '.';
const FIRST_LETTER = 'a'.charCodeAt(0);

/**
 * @param {string} letter
 * @param {readonly string[]} palette
 */
function threadColor(letter, palette) {
  const color = palette[letter.charCodeAt(0) - FIRST_LETTER];
  if (!color) throw new Error(`El hilo "${letter}" no existe en la paleta`);
  return color;
}

/**
 * Valida que todas las filas tengan el mismo ancho.
 * @param {readonly string[]} rows
 */
function gridSize(rows) {
  const h = rows.length;
  const w = h ? rows[0].length : 0;
  const ragged = rows.findIndex((row) => row.length !== w);
  if (ragged >= 0) throw new Error(`La fila ${ragged} mide ${rows[ragged].length} y no ${w}`);
  return { w, h };
}

/**
 * Convierte `"be,cg"` en `{ b: 'e', c: 'g' }`: reasigna hilos para variar un motivo.
 * @param {string} spec
 * @returns {Record<string, string>}
 */
export function parseColorMap(spec) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const pair of spec.split(',')) {
    if (pair.length === 2) map[pair[0]] = pair[1];
  }
  return map;
}

/**
 * Gira un patrón 90°: el borde izquierdo pasa arriba (`cw`) o abajo (`ccw`). Así las rosas
 * del Hero de escritorio se vuelven las guirnaldas horizontales del móvil.
 * @param {readonly string[]} rows
 * @param {'cw' | 'ccw'} direction
 * @returns {string[]}
 */
export function rotateRows(rows, direction) {
  const { w, h } = gridSize(rows);
  /** @type {string[]} */
  const out = [];
  for (let j = 0; j < w; j++) {
    let row = '';
    for (let i = 0; i < h; i++) {
      row += direction === 'cw' ? rows[h - 1 - i][j] : rows[i][w - 1 - j];
    }
    out.push(row);
  }
  return out;
}

/**
 * Refleja las filas de un motivo: `x` en horizontal, `y` en vertical.
 * @param {readonly string[]} rows
 * @param {string} flip
 * @returns {string[]}
 */
export function flipRows(rows, flip) {
  let out = [...rows];
  if (flip.includes('y')) out = out.reverse();
  if (flip.includes('x')) out = out.map((row) => [...row].reverse().join(''));
  return out;
}

/**
 * Decodifica un patrón en puntadas, en orden de lectura (fila por fila).
 * @param {readonly string[]} rows
 * @param {readonly string[]} palette
 * @param {PatternOptions} [options]
 * @returns {Pattern}
 */
export function parsePattern(rows, palette, { flip = '', colorMap = {} } = {}) {
  const grid = flipRows(rows, flip);
  const { w, h } = gridSize(grid);
  /** @type {Stitch[]} */
  const stitches = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const letter = grid[j][i];
      if (letter === EMPTY) continue;
      stitches.push({ i, j, color: threadColor(colorMap[letter] ?? letter, palette) });
    }
  }
  return { w, h, stitches };
}

/**
 * Repite una banda a lo ancho de `cols` celdas. `phase` desplaza el dibujo para que una banda
 * que cruza varios paneles se vea como un solo dobladillo continuo.
 * @param {readonly string[]} rows
 * @param {readonly string[]} palette
 * @param {number} cols
 * @param {number} [phase]
 * @returns {Pattern}
 */
export function tileBand(rows, palette, cols, phase = 0) {
  const { w: period, h } = gridSize(rows);
  /** @type {Stitch[]} */
  const stitches = [];
  if (!period) return { w: cols, h, stitches };
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < cols; i++) {
      const letter = rows[j][(((phase + i) % period) + period) % period];
      if (letter !== EMPTY) stitches.push({ i, j, color: threadColor(letter, palette) });
    }
  }
  return { w: cols, h, stitches };
}

/**
 * Agrupa en "flores" las celdas conectadas (4 vecinos), sin contar los hilos de tallo y hoja
 * (`ignore`). Permite recortar el ornamento por flores completas en pantallas angostas.
 * @param {readonly string[]} rows
 * @param {string} [ignore]
 * @returns {{ ids: Int32Array, count: number, w: number }} `ids[j * w + i]` es la flor (o -1).
 */
export function findComponents(rows, ignore = 'adh') {
  const { w, h } = gridSize(rows);
  const ids = new Int32Array(w * h).fill(-1);
  /** @param {number} i @param {number} j */
  const isPetal = (i, j) => {
    const letter = rows[j][i];
    return letter !== EMPTY && !ignore.includes(letter);
  };
  let count = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (!isPetal(i, j) || ids[j * w + i] >= 0) continue;
      const stack = [j * w + i];
      ids[j * w + i] = count;
      while (stack.length) {
        const cell = /** @type {number} */ (stack.pop());
        const ci = cell % w;
        const cj = (cell - ci) / w;
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const ni = ci + di;
          const nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
          const next = nj * w + ni;
          if (ids[next] >= 0 || !isPetal(ni, nj)) continue;
          ids[next] = count;
          stack.push(next);
        }
      }
      count++;
    }
  }
  return { ids, count, w };
}

/**
 * Decodifica una fila run-length de la rejilla del mapa: `".*3,1g*2,5"` → `[null, null, null,
 * 52, 52, 5]`. Cada valor está en base 36 (índice de municipio); `.` es mar.
 * @param {string} row
 * @returns {(number | null)[]}
 */
export function decodeRunLength(row) {
  /** @type {(number | null)[]} */
  const cells = [];
  for (const token of row.split(',')) {
    const [value, times = '1'] = token.split('*');
    const count = Number(times);
    if (!value || !Number.isInteger(count) || count < 1) {
      throw new Error(`Segmento inválido en la rejilla: "${token}"`);
    }
    const index = value === EMPTY ? null : parseInt(value, 36);
    if (Number.isNaN(index)) throw new Error(`Valor inválido en la rejilla: "${value}"`);
    for (let k = 0; k < count; k++) cells.push(index);
  }
  return cells;
}
