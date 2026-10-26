// @ts-check
import { describe, expect, it } from 'vitest';
import { colorRuns, stitchSvg } from '../../../src/js/stitch/svg.js';

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
