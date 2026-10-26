// @ts-check
import { describe, expect, it } from 'vitest';
import { colorRuns, stitchBandSvg, stitchSvg } from '../../../src/js/stitch/svg.js';

describe('stitchBandSvg', () => {
  it('repite un periodo con un pattern del tamaño de la banda', () => {
    const svg = stitchBandSvg(['a.', '.b'], ['#111111', '#222222'], {
      id: 'b',
      cell: 6,
      className: 'band',
    });
    expect(svg).toMatch(/^<svg class="band"/);
    expect(svg).toContain('height="12" aria-hidden="true"');
    expect(svg).toContain('<pattern id="b" width="12" height="12" patternUnits="userSpaceOnUse">');
    expect(svg).toContain('<path d="M0.16 0.84L0.84 0.16M0.16 0.16L0.84 0.84" stroke="#111111"/>');
    expect(svg).toContain('stroke="#222222"');
    expect(svg).toContain('fill="url(#b)"');
  });

  it('rechaza hilos fuera de la paleta', () => {
    expect(() => stitchBandSvg(['z'], ['#111111'], { id: 'b', cell: 6 })).toThrow(/"z"/);
  });
});

const PAL = ['#111111', '#222222'];

describe('colorRuns', () => {
  it('agrupa celdas consecutivas del mismo hilo por color', () => {
    const runs = colorRuns(['aab.', '.bba']);
    expect(runs.get('a')).toEqual([
      { i: 0, j: 0, length: 2 },
      { i: 3, j: 1, length: 1 },
    ]);
    expect(runs.get('b')).toEqual([
      { i: 2, j: 0, length: 1 },
      { i: 1, j: 1, length: 2 },
    ]);
  });
});

describe('stitchSvg', () => {
  it('dibuja un patrón de X por color y una figura por color', () => {
    const svg = stitchSvg(['ab'], PAL, { id: 'p', label: 'Logo' });
    expect(svg).toContain('viewBox="0 0 2 1"');
    expect(svg).toContain('<pattern id="p-a"');
    expect(svg).toContain('stroke="#222222"');
    expect(svg).toContain('<path fill="url(#p-a)" d="M0 0h1v1h-1z"/>');
    expect(svg).toContain('role="img" aria-label="Logo"');
  });

  it('sin etiqueta es decorativo, y escapa la etiqueta', () => {
    expect(stitchSvg(['a'], PAL, { id: 'p' })).toContain('aria-hidden="true"');
    expect(stitchSvg(['a'], PAL, { id: 'p', label: 'A & "B" <c>' })).toContain(
      'aria-label="A &amp; &quot;B&quot; &lt;c&gt;"',
    );
    expect(stitchSvg(['a'], PAL, { id: 'p', className: 'x' })).toMatch(/^<svg class="x"/);
  });

  it('rechaza hilos fuera de la paleta y acepta un patrón vacío', () => {
    expect(() => stitchSvg(['z'], PAL, { id: 'p' })).toThrow(/"z"/);
    expect(stitchSvg([], PAL, { id: 'p' })).toContain('viewBox="0 0 0 0"');
  });
});
