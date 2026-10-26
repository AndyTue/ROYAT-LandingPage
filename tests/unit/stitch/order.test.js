// @ts-check
import { describe, expect, it } from 'vitest';
import { createRng } from '../../../src/js/lib/random.js';
import { orderStitches } from '../../../src/js/stitch/order.js';
import { parsePattern } from '../../../src/js/stitch/patterns.js';

const PAL = ['#111111'];
const square = parsePattern(['aaaaa', 'aaaaa', 'aaaaa', 'aaaaa', 'aaaaa'], PAL);
const fixed = () => 0.5;

/** @param {import('../../../src/js/stitch/order.js').OrderMode | import('../../../src/js/stitch/order.js').OrderFn} mode */
const order = (mode, rng = fixed, jitter = 0) =>
  orderStitches(square.stitches, { w: 5, h: 5, mode, rng, jitter });

describe('orderStitches', () => {
  it('lr cose de izquierda a derecha', () => {
    const cols = order('lr').map((s) => s.i);
    expect(cols).toEqual([...cols].sort((a, b) => a - b));
  });

  it('down y up cosen por filas en direcciones opuestas', () => {
    const down = order('down').map((s) => s.j);
    expect(down[0]).toBe(0);
    expect(down.at(-1)).toBe(4);
    const up = order('up').map((s) => s.j);
    expect(up[0]).toBe(4);
    expect(up.at(-1)).toBe(0);
  });

  it('out empieza en el centro y termina en las esquinas', () => {
    const out = order('out');
    expect(out[0]).toMatchObject({ i: 2, j: 2 });
    expect([0, 4]).toContain(out.at(-1)?.i);
    expect([0, 4]).toContain(out.at(-1)?.j);
  });

  it('acepta una función de orden propia', () => {
    const first = order((i, j) => -(i + j))[0];
    expect(first).toMatchObject({ i: 4, j: 4 });
  });

  it('agrega una variación de tono acotada a cada puntada', () => {
    for (const s of orderStitches(square.stitches, { w: 5, h: 5, mode: 'lr', rng: createRng(1) })) {
      expect(Math.abs(s.shade)).toBeLessThanOrEqual(0.06);
    }
  });

  it('es determinista con la misma semilla y no muta la entrada', () => {
    const before = JSON.stringify(square.stitches);
    const a = orderStitches(square.stitches, { w: 5, h: 5, mode: 'out', rng: createRng(7) });
    const b = orderStitches(square.stitches, { w: 5, h: 5, mode: 'out', rng: createRng(7) });
    expect(a).toEqual(b);
    expect(JSON.stringify(square.stitches)).toBe(before);
  });

  it('rechaza un orden desconocido', () => {
    // @ts-expect-error: prueba de un valor inválido
    expect(() => order('zigzag')).toThrow(/desconocido/);
  });
});

describe('createRng', () => {
  it('produce la misma secuencia con la misma semilla, en [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seq = Array.from({ length: 1000 }, () => a());
    expect(seq).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(Math.min(...seq)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...seq)).toBeLessThan(1);
    expect(createRng(43)()).not.toBe(seq[0]);
  });
});
