// @ts-check
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Lee las custom properties de tokens.css y resuelve las referencias `var(--x)`. */
function loadTokens() {
  const css = readFileSync('src/styles/tokens.css', 'utf8');
  /** @type {Record<string, string>} */
  const raw = {};
  for (const [, name, value] of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) raw[name] = value.trim();
  /** @param {string} name @returns {string} */
  const resolve = (name) => {
    const value = raw[name];
    if (value === undefined) throw new Error(`Token inexistente: ${name}`);
    const ref = value.match(/^var\((--[\w-]+)\)$/);
    return ref ? resolve(ref[1]) : value;
  };
  return resolve;
}

/** @param {string} hex */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG 2.x entre dos colores `#rrggbb`. */
function contrast(/** @type {string} */ a, /** @type {string} */ b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const token = loadTokens();
const TONES = ['navy', 'paper', 'sand', 'red', 'cream'];
const AA_TEXT = 4.5;
const AA_LARGE_AND_UI = 3;

describe('contraste de los tonos de panel (WCAG 2.2 AA)', () => {
  for (const tone of TONES) {
    const bg = token(`--tone-${tone}-bg`);

    it(`${tone}: texto, texto secundario y acentos son legibles en cualquier tamaño`, () => {
      for (const role of ['fg', 'fg2', 'acc', 'acc2']) {
        expect(contrast(bg, token(`--tone-${tone}-${role}`)), role).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });

    it(`${tone}: el indicador de foco se distingue del fondo`, () => {
      const best = Math.max(
        contrast(bg, token('--focus-color')),
        contrast(bg, token('--focus-ring')),
      );
      expect(best).toBeGreaterThanOrEqual(AA_LARGE_AND_UI);
    });
  }
});

describe('naranja quemado decorativo', () => {
  // --color-burnt se reserva para puntadas y adornos: basta el mínimo de elementos gráficos.
  it('se distingue sobre papel y crema como elemento gráfico', () => {
    for (const bg of ['--color-paper', '--color-cream']) {
      expect(contrast(token(bg), token('--color-burnt'))).toBeGreaterThanOrEqual(AA_LARGE_AND_UI);
    }
  });
});
