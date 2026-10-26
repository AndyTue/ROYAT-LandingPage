// @ts-check
import { describe, expect, it } from 'vitest';
import { attrs, escapeHtml, html, raw, SafeHtml } from '../../../src/templates/html.js';

describe('html', () => {
  it('escapa los valores interpolados', () => {
    const name = '<img src=x onerror="alert(1)">';
    expect(String(html`<p>${name}</p>`)).toBe(
      '<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>',
    );
  });

  it('no vuelve a escapar HTML de confianza ni listas de fragmentos', () => {
    const items = ['a', 'b'].map((x) => html`<li>${x}</li>`);
    expect(String(html`<ul>${items}</ul>`)).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(String(html`${raw('<b>ok</b>')}`)).toBe('<b>ok</b>');
  });

  it('omite null, undefined y booleanos para permitir condicionales', () => {
    expect(String(html`[${null}${undefined}${false}${true}${0}]`)).toBe('[0]');
  });

  it('devuelve SafeHtml', () => {
    expect(html`x`).toBeInstanceOf(SafeHtml);
  });
});

describe('escapeHtml', () => {
  it('escapa los cinco caracteres especiales', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});

describe('attrs', () => {
  it('escribe, omite y escapa atributos', () => {
    expect(String(attrs({ alt: 'a "b"', hidden: true, lang: null, open: false, width: 3 }))).toBe(
      ' alt="a &quot;b&quot;" hidden width="3"',
    );
  });
});
