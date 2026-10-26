// @ts-check

/**
 * Versión estática de un bordado en SVG: cada color es una figura rellena con un patrón que
 * dibuja la X de la puntada. Pesa unos pocos KB y se ve sin JavaScript, con reduced-motion y
 * desde el primer pintado; el canvas animado se monta encima cuando hay JS.
 */

/**
 * Celdas consecutivas del mismo color en cada fila, agrupadas por color.
 * @param {readonly string[]} rows
 * @returns {Map<string, { i: number, j: number, length: number }[]>} por letra de hilo
 */
export function colorRuns(rows) {
  /** @type {Map<string, { i: number, j: number, length: number }[]>} */
  const runs = new Map();
  rows.forEach((row, j) => {
    let i = 0;
    while (i < row.length) {
      const letter = row[i];
      let end = i + 1;
      while (end < row.length && row[end] === letter) end++;
      if (letter !== '.') {
        const list = runs.get(letter) ?? [];
        list.push({ i, j, length: end - i });
        runs.set(letter, list);
      }
      i = end;
    }
  });
  return runs;
}

/** @param {string} text */
const escapeAttribute = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {readonly string[]} rows
 * @param {readonly string[]} palette
 * @param {{ id: string, label?: string, className?: string }} options
 *   `id` hace únicos los patrones si hay varios SVG en la página. Sin `label` el SVG es decorativo.
 * @returns {string}
 */
export function stitchSvg(rows, palette, { id, label, className }) {
  const h = rows.length;
  const w = h ? rows[0].length : 0;
  const defs = [];
  const paths = [];
  for (const [letter, runs] of colorRuns(rows)) {
    const color = palette[letter.charCodeAt(0) - 97];
    if (!color) throw new Error(`El hilo "${letter}" no existe en la paleta`);
    const pattern = `${id}-${letter}`;
    // Celda de 1×1 unidades: la X con un margen y grosor como los del canvas (renderer.js).
    defs.push(
      `<pattern id="${pattern}" width="1" height="1" patternUnits="userSpaceOnUse">` +
        `<path d="M.16 .84L.84 .16M.16 .16L.84 .84" stroke="${color}" stroke-width=".44" stroke-linecap="round"/>` +
        `</pattern>`,
    );
    const d = runs.map((r) => `M${r.i} ${r.j}h${r.length}v1h-${r.length}z`).join('');
    paths.push(`<path fill="url(#${pattern})" d="${d}"/>`);
  }
  const a11y = label ? `role="img" aria-label="${escapeAttribute(label)}"` : 'aria-hidden="true"';
  const cls = className ? ` class="${className}"` : '';
  return (
    `<svg${cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ${a11y} focusable="false">` +
    `<defs>${defs.join('')}</defs>${paths.join('')}</svg>`
  );
}
