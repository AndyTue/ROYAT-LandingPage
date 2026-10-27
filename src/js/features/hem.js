// @ts-check
import { drawLeg, MAX_DPR, shade } from '../stitch/renderer.js';

/**
 * Celda de las guirnaldas del prototipo: la misma que la del Hero (`S` de `layout()`), que
 * depende del tamaño de la pantalla.
 * @param {number} W ancho de la pantalla
 * @param {number} H alto de la pantalla
 */
export const hemCell = (W, H) => Math.max(3.6, Math.min(6.4, Math.min(W / 262, H / 128)));

/**
 * Borda una guirnalda a todo el ancho en un canvas (prototipo `drawHem`): cada puntada con su
 * sombra y su brillo, sin animación.
 * @param {HTMLCanvasElement} canvas
 * @param {readonly string[]} rows un periodo de la banda
 * @param {readonly string[]} palette
 * @param {number} cell px por celda
 * @param {{ exact?: boolean }} [options] `exact`: el canvas mide un número entero de celdas y no
 *   se estira al ancho (la banda del pie); si no, se estira como las guirnaldas del prototipo.
 */
export function drawHem(canvas, rows, palette, cell, { exact = false } = {}) {
  const h = rows.length;
  const w = h ? rows[0].length : 0;
  if (!w) return;
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  canvas.style.width = '';
  const width = (exact ? canvas.parentElement?.clientWidth : canvas.clientWidth) ?? 0;
  const cols = exact ? Math.max(1, Math.floor(width / cell)) : Math.ceil(width / cell) + 1;
  if (exact) canvas.style.width = `${cols * cell}px`;
  canvas.width = Math.ceil(cols * cell * dpr);
  canvas.height = Math.ceil(h * cell * dpr);
  canvas.style.height = `${h * cell}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  const p = cell * 0.16;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < cols; i++) {
      const ch = rows[j][i % w];
      if (ch === '.') continue;
      const col = palette[ch.charCodeAt(0) - 97];
      const x = i * cell;
      const y = j * cell;
      drawLeg(ctx, x + p, y + cell - p, x + cell - p, y + p, shade(col, -0.06), cell);
      drawLeg(ctx, x + p, y + p, x + cell - p, y + cell - p, shade(col, 0.04), cell);
    }
  }
}
