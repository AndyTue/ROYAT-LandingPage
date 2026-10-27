// @ts-check
// Geometría y línea de tiempo del Hero: funciones puras (sin DOM) para poder probarlas aparte.
import { clamp, easeOutCubic, EASE, range } from '../core/motion.js';
import { heroProgress } from '../stitch/presets.js';

/** Celdas de cada patrón de `assets-src/stitch/patterns.json`. */
export const LOGO = { cols: 220, rows: 122 };
export const ROSE = { cols: 87, rows: 134 };
/** La rosa girada 90° es la guirnalda del móvil: 134 de ancho × 87 de alto. */
export const GARLAND = { cols: 134, rows: 87 };

/** Línea de tiempo de la intro, en ms (DESIGN-TOKENS › Movimiento). */
export const TIMELINE = {
  pop: [150, 900],
  fly: [1500, 2300],
  stitch: [1500, 3700],
  cue: [4300, 4900],
  end: 4900,
};

/** El logo se borda a 0.7 del tamaño de celda de las rosas (prototipo). */
const LOGO_SCALE = 0.7;

/**
 * @typedef {{ x: number, y: number, cell: number, w: number, h: number }} Box
 * @typedef {{
 *   mode: 'roses' | 'garlands',
 *   logo: Box,
 *   left?: Box,
 *   right?: Box,
 *   top?: Box,
 *   bottom?: Box,
 *   crew: { w: number, h: number, bottom: number },
 *   end: { shiftY: number, scale: number },
 * }} Geometry
 */

/**
 * Posiciones y tamaños del Hero para una pantalla.
 * @param {{ W: number, H: number, compact: boolean, crewAspect: number }} input
 * @returns {Geometry}
 */
export function heroGeometry({ W, H, compact, crewAspect }) {
  if (compact) return compactGeometry(W, H, crewAspect);
  const S = clamp(Math.min(W / 262, H / 128), 3.6, 6.4);
  const snap = (/** @type {number} */ v) => Math.round(v / S) * S;
  const logoCell = S * LOGO_SCALE;
  const lw = LOGO.cols * logoCell;
  const lh = LOGO.rows * logoCell;
  const logo = {
    x: snap((W - lw) / 2),
    y: snap((H - lh) / 2 - H * 0.05),
    cell: logoCell,
    w: lw,
    h: lh,
  };
  const fw = ROSE.cols * S;
  const fh = ROSE.rows * S;
  const show = Math.min(fw, (W - lw) / 2 - S * 2);
  const inset = W * 0.055;
  const y = snap((H - fh) / 2);
  // El grupo mide 984×633 a 1536×800 (el prototipo) y tapa la parte baja del logo.
  const crewH = Math.min(H * 0.79, (W * 0.66) / crewAspect);
  const crew = { w: crewH * crewAspect, h: crewH, bottom: H * 0.015 };
  return {
    mode: 'roses',
    logo,
    left: { x: snap(show - fw + inset), y, cell: S, w: fw, h: fh },
    right: { x: snap(W - show - inset), y, cell: S, w: fw, h: fh },
    crew,
    // Al final el logo sube un poco y casi no se encoge: lo cubre el grupo, no se aparta.
    end: { shiftY: -H * 0.09, scale: 0.95 },
  };
}

/**
 * @param {number} W
 * @param {number} H
 * @param {number} crewAspect
 * @returns {Geometry}
 */
function compactGeometry(W, H, crewAspect) {
  const gCell = W / GARLAND.cols;
  const gh = GARLAND.rows * gCell;
  const logoCell = (W * 0.9) / LOGO.cols;
  const lw = LOGO.cols * logoCell;
  const lh = LOGO.rows * logoCell;
  const logo = { x: (W - lw) / 2, y: H * 0.52 - lh / 2, cell: logoCell, w: lw, h: lh };
  const crewH = W / crewAspect;
  // El grupo se para sobre la guirnalda de abajo.
  const crew = { w: W, h: crewH, bottom: gh * 0.95 };
  const endTop = H * 0.165;
  const crewTop = H - crew.bottom - crewH;
  const room = crewTop - endTop - H * 0.03;
  return {
    mode: 'garlands',
    logo,
    top: { x: 0, y: 0, cell: gCell, w: GARLAND.cols * gCell, h: gh },
    bottom: { x: 0, y: H - gh, cell: gCell, w: GARLAND.cols * gCell, h: gh },
    crew,
    end: { shiftY: endTop - logo.y, scale: clamp(room / lh, 0.3, 1) },
  };
}

/**
 * @typedef {{
 *   stitch: { roses: number, logo: number },
 *   pop: number,
 *   cue: number,
 *   logo: { ty: number, scale: number },
 *   left: { tx: number, opacity: number },
 *   right: { tx: number, opacity: number },
 *   top: { ty: number },
 *   crew: { ty: number, opacity: number },
 * }} HeroFrame
 */

/**
 * Estado visual del Hero en un instante.
 * @param {Geometry} geo
 * @param {{ t: number, s: number }} time `t` ms de intro y `s` avance del scroll (0–1)
 * @returns {HeroFrame}
 */
export function heroFrame(geo, { t, s }) {
  const pop = EASE.out(range(t, TIMELINE.pop[0], TIMELINE.pop[1]));
  const fly = easeOutCubic(range(t, TIMELINE.fly[0], TIMELINE.fly[1]));
  const e = EASE.inOut(s);
  const crewIn = EASE.out(range(s, 0.05, 0.85));
  const H = geo.crew.h + geo.crew.bottom;
  // En escritorio las rosas se quedan en su lugar; en móvil la guirnalda de arriba se retira.
  const fade = geo.mode === 'roses' ? 0.1 : 0.5;
  const frame = {
    stitch: heroProgress(range(t, TIMELINE.stitch[0], TIMELINE.stitch[1])),
    pop,
    cue: range(t, TIMELINE.cue[0], TIMELINE.cue[1]) * (1 - clamp(s * 6)),
    // El logo "vuela" a su lugar durante la intro y luego sube con el scroll.
    logo: {
      ty: (1 - fly) * geo.logo.h * 0.12 + geo.end.shiftY * e,
      scale: 1 + (geo.end.scale - 1) * e,
    },
    left: { tx: 0, opacity: pop * (1 - fade * e) },
    right: { tx: 0, opacity: pop * (1 - fade * e) },
    top: { ty: -e * (geo.top?.h ?? 0) * 0.7 },
    crew: { ty: (1 - crewIn) * (H + 24), opacity: clamp(crewIn * 4) },
  };
  return frame;
}
