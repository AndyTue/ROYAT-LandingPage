// @ts-check
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { headersFor, parseHeaders } from '../../scripts/headers.js';

describe('parseHeaders', () => {
  it('agrupa los encabezados bajo su ruta e ignora comentarios', () => {
    const rules = parseHeaders(
      '# comentario\n/*\n  X-Test: uno\n\n/assets/*\n  Cache-Control: max-age=1\n',
    );
    expect(rules).toEqual([
      { pattern: '/*', headers: { 'x-test': 'uno' } },
      { pattern: '/assets/*', headers: { 'cache-control': 'max-age=1' } },
    ]);
  });

  it('conserva los dos puntos que forman parte del valor', () => {
    const [rule] = parseHeaders('/*\n  Link: <https://example.com>; rel=preconnect\n');
    expect(rule.headers.link).toBe('<https://example.com>; rel=preconnect');
  });

  it('rechaza un encabezado sin ruta', () => {
    expect(() => parseHeaders('  X-Test: uno\n')).toThrow(/inválida/);
  });
});

describe('headersFor', () => {
  const rules = parseHeaders('/*\n  A: 1\n/assets/*\n  B: 2\n');

  it('aplica solo las reglas cuyo patrón coincide', () => {
    expect(headersFor(rules, '/')).toEqual({ a: '1' });
    expect(headersFor(rules, '/assets/main-abc.js')).toEqual({ a: '1', b: '2' });
  });
});

describe('public/_headers', () => {
  const site = headersFor(parseHeaders(readFileSync('public/_headers', 'utf8')), '/');
  const csp = site['content-security-policy'] ?? '';

  it('declara los encabezados de seguridad obligatorios', () => {
    for (const name of [
      'content-security-policy',
      'strict-transport-security',
      'x-content-type-options',
      'referrer-policy',
      'permissions-policy',
    ]) {
      expect(site, name).toHaveProperty(name);
    }
    expect(site['x-content-type-options']).toBe('nosniff');
  });

  it('tiene una CSP sin unsafe-inline, unsafe-eval ni frames de terceros', () => {
    expect(csp).not.toMatch(/unsafe-(inline|eval)/);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('solo permite enviar el formulario de respaldo a WhatsApp', () => {
    expect(csp).toContain('form-action https://wa.me');
  });

  it('cachea para siempre los archivos con hash de /assets', () => {
    const assets = headersFor(
      parseHeaders(readFileSync('public/_headers', 'utf8')),
      '/assets/x.js',
    );
    expect(assets['cache-control']).toContain('immutable');
  });
});
