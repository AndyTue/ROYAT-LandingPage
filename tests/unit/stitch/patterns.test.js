// @ts-check
import { describe, expect, it } from 'vitest';
import mapGrid from '../../../content/map-grid.json';
import motifs from '../../../assets-src/stitch/motifs.json';
import patterns from '../../../assets-src/stitch/patterns.json';
import {
  decodeRunLength,
  findComponents,
  flipRows,
  parseColorMap,
  parsePattern,
  tileBand,
} from '../../../src/js/stitch/patterns.js';

const PAL = ['#000001', '#000002', '#000003'];

describe('parsePattern', () => {
  it('convierte cada letra en una puntada con el color de la paleta', () => {
    const { w, h, stitches } = parsePattern(['a.', '.c'], PAL);
    expect({ w, h }).toEqual({ w: 2, h: 2 });
    expect(stitches).toEqual([
      { i: 0, j: 0, color: '#000001' },
      { i: 1, j: 1, color: '#000003' },
    ]);
  });

  it('reasigna hilos con el mapa de color', () => {
    const { stitches } = parsePattern(['ab'], PAL, { colorMap: parseColorMap('bc,x') });
    expect(stitches.map((s) => s.color)).toEqual(['#000001', '#000003']);
  });

  it('refleja el motivo en x y en y', () => {
    expect(flipRows(['ab', 'c.'], 'x')).toEqual(['ba', '.c']);
    expect(flipRows(['ab', 'c.'], 'y')).toEqual(['c.', 'ab']);
    expect(flipRows(['ab', 'c.'], 'xy')).toEqual(['.c', 'ba']);
    const { stitches } = parsePattern(['a.'], PAL, { flip: 'x' });
    expect(stitches[0].i).toBe(1);
  });

  it('rechaza filas de distinto ancho y hilos fuera de la paleta', () => {
    expect(() => parsePattern(['aa', 'a'], PAL)).toThrow(/fila 1/);
    expect(() => parsePattern(['z'], PAL)).toThrow(/"z"/);
  });

  it('acepta un patrón vacío', () => {
    expect(parsePattern([], PAL)).toEqual({ w: 0, h: 0, stitches: [] });
  });
});

describe('tileBand', () => {
  it('repite la banda a lo ancho', () => {
    const { w, stitches } = tileBand(['a.'], PAL, 5);
    expect(w).toBe(5);
    expect(stitches.map((s) => s.i)).toEqual([0, 2, 4]);
  });

  it('continúa la fase de un panel al siguiente', () => {
    const shifted = tileBand(['a.'], PAL, 4, 1);
    expect(shifted.stitches.map((s) => s.i)).toEqual([1, 3]);
    expect(tileBand(['a.'], PAL, 2, -1).stitches.map((s) => s.i)).toEqual([1]);
  });

  it('una banda vacía no produce puntadas', () => {
    expect(tileBand([], PAL, 3).stitches).toEqual([]);
  });
});

describe('findComponents', () => {
  it('agrupa pétalos conectados e ignora tallos y hojas', () => {
    const { ids, count, w } = findComponents(['bb.c', '.a.c', 'bbdc']);
    expect(count).toBe(3);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[1 * w + 1]).toBe(-1); // tallo "a"
    expect(ids[3]).toBe(ids[2 * w + 3]); // columna "c" conectada
    expect(ids[2 * w + 0]).not.toBe(ids[0]); // separada por el tallo
  });
});

describe('decodeRunLength', () => {
  it('expande los segmentos en base 36', () => {
    expect(decodeRunLength('.*2,1g*2,5')).toEqual([null, null, 52, 52, 5]);
  });

  it('rechaza segmentos mal formados', () => {
    expect(() => decodeRunLength('a*0')).toThrow(/Segmento/);
    expect(() => decodeRunLength('*3')).toThrow(/Segmento/);
    expect(() => decodeRunLength('!*2')).toThrow(/Valor/);
  });
});

describe('datos reales', () => {
  it('el logo, las rosas y el dobladillo se decodifican completos', () => {
    for (const key of /** @type {const} */ (['logo', 'left', 'right', 'hem'])) {
      const rows = patterns[key];
      const { w, h, stitches } = parsePattern(rows, patterns.pal);
      expect(w * h).toBeGreaterThan(0);
      const filled = rows.join('').replaceAll('.', '').length;
      expect(stitches).toHaveLength(filled);
    }
  });

  it('todos los motivos y bandas usan hilos de la paleta', () => {
    for (const rows of [...Object.values(motifs.motifs), ...Object.values(motifs.bands)]) {
      expect(() => parsePattern(rows, patterns.pal)).not.toThrow();
    }
  });

  it('cada fila de la rejilla del mapa mide W celdas', () => {
    expect(mapGrid.rows).toHaveLength(mapGrid.H);
    for (const row of mapGrid.rows) expect(decodeRunLength(row)).toHaveLength(mapGrid.W);
  });
});
