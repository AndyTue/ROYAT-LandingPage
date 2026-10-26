// @ts-check
import { describe, expect, it } from 'vitest';
import { createRng } from '../../../src/js/lib/random.js';
import { orderStitches } from '../../../src/js/stitch/order.js';
import { parsePattern } from '../../../src/js/stitch/patterns.js';
import {
  createStitchLayer,
  drawLeg,
  setupCanvas,
  shade,
  stitchCounts,
} from '../../../src/js/stitch/renderer.js';

/** Contexto falso que registra cada trazo como texto para comparar dibujos. */
function fakeContext() {
  /** @type {string[]} */
  const log = [];
  let path = '';
  const ctx = {
    strokeStyle: '',
    lineWidth: 1,
    beginPath() {
      path = '';
    },
    /** @param {number} x @param {number} y */
    moveTo(x, y) {
      path += `M${x.toFixed(2)},${y.toFixed(2)}`;
    },
    /** @param {number} x @param {number} y */
    lineTo(x, y) {
      path += `L${x.toFixed(2)},${y.toFixed(2)}`;
    },
    stroke() {
      log.push(`${ctx.strokeStyle}|${ctx.lineWidth.toFixed(3)}|${path}`);
    },
  };
  return { ctx: /** @type {any} */ (ctx), log };
}

const STROKES_PER_LEG = 3;
const pattern = parsePattern(['abab', 'baba', 'abab'], ['#E98B1E', '#1C2C55']);
const ordered = orderStitches(pattern.stitches, {
  w: pattern.w,
  h: pattern.h,
  mode: 'lr',
  rng: createRng(3),
});

/** @param {(layer: import('../../../src/js/stitch/renderer.js').StitchLayer) => void} steps */
function draw(steps) {
  const { ctx, log } = fakeContext();
  steps(createStitchLayer(ctx, ordered, { cell: 6 }));
  return log;
}

describe('shade', () => {
  it('aclara hacia blanco y oscurece hacia negro', () => {
    expect(shade('#808080', 0)).toBe('rgb(128,128,128)');
    expect(shade('#808080', 1)).toBe('rgb(255,255,255)');
    expect(shade('#808080', -1)).toBe('rgb(0,0,0)');
    expect(shade('#000000', 0.5)).toBe('rgb(128,128,128)');
  });
});

describe('stitchCounts', () => {
  it('el segundo trazo va detrás del primero hasta terminar', () => {
    expect(stitchCounts(0, 100)).toEqual({ rise: 0, fall: 0 });
    expect(stitchCounts(0.5, 100)).toEqual({ rise: 50, fall: 49 });
    expect(stitchCounts(0.5, 1000)).toEqual({ rise: 500, fall: 485 });
    expect(stitchCounts(1, 100)).toEqual({ rise: 100, fall: 100 });
  });

  it('acota el avance fuera de rango o inválido', () => {
    expect(stitchCounts(-1, 10)).toEqual({ rise: 0, fall: 0 });
    expect(stitchCounts(2, 10)).toEqual({ rise: 10, fall: 10 });
    expect(stitchCounts(Number.NaN, 10)).toEqual({ rise: 0, fall: 0 });
  });
});

describe('drawLeg', () => {
  it('traza sombra, hilo y brillo', () => {
    const { ctx, log } = fakeContext();
    drawLeg(ctx, 0, 6, 6, 0, '#abcdef', 6);
    expect(log).toHaveLength(3);
    expect(log[1]).toMatch(/^#abcdef\|2\.640\|M0\.00,6\.00L6\.00,0\.00$/);
  });
});

describe('createStitchLayer', () => {
  it('completa todas las puntadas al llegar a 1', () => {
    const log = draw((layer) => layer.advance(1));
    expect(log).toHaveLength(ordered.length * 2 * STROKES_PER_LEG);
  });

  it('es idempotente: repetir el mismo avance no dibuja de nuevo', () => {
    const once = draw((layer) => layer.advance(0.5));
    const twice = draw((layer) => {
      layer.advance(0.5);
      layer.advance(0.5);
    });
    expect(twice).toEqual(once);
  });

  it('avanzar por partes dibuja lo mismo que avanzar de una vez', () => {
    const direct = draw((layer) => layer.advance(0.8));
    const steps = draw((layer) => [0.1, 0.25, 0.25, 0.6, 0.8].forEach((p) => layer.advance(p)));
    expect(new Set(steps)).toEqual(new Set(direct));
    expect(steps).toHaveLength(direct.length);
  });

  it('es determinista con la misma semilla', () => {
    const again = orderStitches(pattern.stitches, {
      w: pattern.w,
      h: pattern.h,
      mode: 'lr',
      rng: createRng(3),
    });
    const { ctx: a, log: logA } = fakeContext();
    const { ctx: b, log: logB } = fakeContext();
    createStitchLayer(a, ordered, { cell: 6 }).advance(0.7);
    createStitchLayer(b, again, { cell: 6 }).advance(0.7);
    expect(logA).toEqual(logB);
  });

  it('no deshace puntadas si el avance retrocede', () => {
    const log = draw((layer) => {
      layer.advance(0.6);
      layer.advance(0.2);
    });
    expect(log).toEqual(draw((layer) => layer.advance(0.6)));
  });

  it('drawAll borda todo de una vez (reduced-motion) y reset permite volver a empezar', () => {
    const { ctx, log } = fakeContext();
    const layer = createStitchLayer(ctx, ordered, { cell: 6 });
    layer.drawAll();
    expect(layer.drawn).toBe(layer.size);
    const full = log.length;
    layer.reset();
    expect(layer.drawn).toBe(0);
    layer.advance(1);
    expect(log).toHaveLength(full * 2);
  });

  it('omite las puntadas recortadas', () => {
    const { ctx } = fakeContext();
    const layer = createStitchLayer(ctx, ordered, { cell: 6, skip: (s) => s.i === 0 });
    expect(layer.size).toBe(ordered.length - 3);
  });
});

describe('setupCanvas', () => {
  /** @param {number} dpr */
  function setup(dpr) {
    /** @type {any[]} */
    const transforms = [];
    const ctx = {
      lineCap: 'butt',
      /** @param {...number} args */
      setTransform: (...args) => transforms.push(args),
    };
    const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx };
    const result = setupCanvas(/** @type {any} */ (canvas), 10, 4, 6, dpr);
    return { canvas, ctx: result, transforms };
  }

  it('escala el búfer a la densidad de pantalla, con tope de 2', () => {
    const { canvas, ctx, transforms } = setup(3);
    expect(canvas).toMatchObject({
      width: 120,
      height: 48,
      style: { width: '60px', height: '24px' },
    });
    expect(transforms[0]).toEqual([2, 0, 0, 2, 0, 0]);
    expect(ctx.lineCap).toBe('round');
    expect(setup(0).canvas.width).toBe(60);
  });

  it('falla con claridad si no hay canvas 2D', () => {
    const canvas = { style: {}, getContext: () => null };
    expect(() => setupCanvas(/** @type {any} */ (canvas), 1, 1, 6, 1)).toThrow(/Canvas 2D/);
  });
});
