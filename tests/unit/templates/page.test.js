// @ts-check
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../../scripts/content/load.js';
import { structuredData } from '../../../src/templates/head.js';
import { createContext, renderPage, SECTIONS } from '../../../src/templates/index.js';
import { placeText, presenceCount } from '../../../src/templates/places.js';

const content = loadContent();
const motifs = JSON.parse(readFileSync('assets-src/stitch/motifs.json', 'utf8'));
const patterns = {
  ...JSON.parse(readFileSync('assets-src/stitch/patterns.json', 'utf8')),
  motifs: motifs.motifs,
  bands: motifs.bands,
};
const template = readFileSync('index.html', 'utf8');

/** Manifest falso: cada imagen tiene 2 anchos en AVIF y WebP (no requiere build:images). */
const manifest = new Proxy(
  { og: { src: '/img/og.test.jpg', width: 1200, height: 630 } },
  {
    get(target, key) {
      if (key in target) return target[/** @type {'og'} */ (key)];
      const name = String(key)
        .replace(/^assets-src\//, '')
        .replace(/\.\w+$/, '');
      return {
        width: 1000,
        height: 800,
        variants: [480, 1000].flatMap((w) =>
          ['avif', 'webp'].map((format) => ({
            width: w,
            format,
            file: `/img/${name}-${w}.${format}`,
          })),
        ),
      };
    },
  },
);
const ctx = createContext(content, manifest, patterns);
const page = renderPage(template, ctx);

/** @param {RegExp} re */
const count = (re) => (page.match(re) ?? []).length;

describe('renderPage', () => {
  it('reemplaza todos los marcadores y no deja valores sin resolver', () => {
    expect(page).not.toContain('@section:');
    expect(page).not.toMatch(/undefined|\[object |NaN/);
  });

  it('tiene un h1 y las seis secciones con su id', () => {
    expect(count(/<h1[\s>]/g)).toBe(1);
    for (const id of [
      'inicio',
      'historia',
      'integrantes',
      'presencia',
      'discografia',
      'contacto',
    ]) {
      expect(page).toContain(`id="${id}"`);
    }
  });

  it('incluye los 14 hitos, los 16 músicos, los 10 discos y todas las pistas', () => {
    expect(count(/class="event event--[ab]" id="hito-/g)).toBe(content.history.events.length);
    expect(count(/class="member"/g)).toBe(16);
    expect(count(/class="disc" id="disco-/g)).toBe(content.discography.discs.length);
    const tracks = content.discography.discs.reduce(
      (/** @type {number} */ n, /** @type {any} */ d) => n + d.tracks.length,
      0,
    );
    expect(count(/class="track"/g)).toBe(tracks);
  });

  it('cada imagen tiene alt, dimensiones y AVIF + WebP', () => {
    const imgs = page.match(/<img\b[^>]*>/g) ?? [];
    expect(imgs.length).toBeGreaterThan(40);
    for (const img of imgs) {
      expect(img).toMatch(/\salt="/);
      expect(img).toMatch(/\swidth="\d+"/);
      expect(img).toMatch(/\sheight="\d+"/);
    }
    expect(count(/type="image\/avif"/g)).toBe(count(/type="image\/webp"/g));
  });

  it('solo la foto del hero se carga de inmediato', () => {
    expect(count(/fetchpriority="high"/g)).toBe(1);
    expect(count(/loading="eager"/g)).toBe(1);
  });

  it('los enlaces externos abren en pestaña nueva con noopener', () => {
    const external = page.match(/<a\b[^>]*href="https:[^"]*"[^>]*>/g) ?? [];
    expect(external.length).toBeGreaterThan(10);
    for (const a of external) {
      expect(a).toMatch(/target="_blank"/);
      expect(a).toMatch(/rel="noopener"/);
    }
  });

  it('el formulario de respaldo abre WhatsApp con el número del sitio', () => {
    expect(page).toContain(`action="https://wa.me/${content.site.contact.whatsapp}"`);
    expect(page).toMatch(/<textarea[^>]*name="text"/);
  });

  it('escapa el contenido', () => {
    const tricky = structuredClone(content);
    tricky.history.events[0].title = '<script>alert(1)</script>';
    const html = renderPage(template, createContext(tricky, manifest, patterns));
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)');
  });

  it('avisa si index.html pide una sección inexistente o le falta alguna', () => {
    expect(() => renderPage(`${template}<!-- @section:otra -->`, ctx)).toThrow(/"otra"/);
    expect(() => renderPage(template.replace('<!-- @section:footer -->', ''), ctx)).toThrow(
      /footer/,
    );
    expect(Object.keys(SECTIONS)).toContain('head');
  });

  it('falla con claridad si falta una imagen en el manifest', () => {
    expect(() => createContext(content, {}, patterns)).toThrow(/build:images/);
    const noPhotos = createContext(content, { og: manifest.og }, patterns);
    expect(() => renderPage(template, noPhotos)).toThrow(/build:images/);
  });
});

describe('head', () => {
  it('JSON-LD válido con integrantes, redes y discos', () => {
    const json = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    const data = JSON.parse(json ?? '');
    expect(data['@type']).toBe('MusicGroup');
    expect(data.member).toHaveLength(16);
    expect(data.album).toHaveLength(content.discography.discs.length);
    expect(data.sameAs).toHaveLength(content.site.social.length);
    expect(data.image).toBe(`${content.site.url}/img/og.test.jpg`);
    expect(structuredData(ctx).foundingDate).toBe('2018');
  });

  it('canonical y Open Graph con URL absoluta', () => {
    expect(page).toContain(`<link rel="canonical" href="${content.site.url}/"`);
    expect(page).toContain(
      `<meta property="og:image" content="${content.site.url}/img/og.test.jpg"`,
    );
  });
});

describe('places', () => {
  const places = /** @type {any[]} */ (content.places.places);

  it('los contadores se topan como en el diseño', () => {
    expect(presenceCount(places, 'Yucatán', 50)).toBe('+50');
    expect(presenceCount(places, 'Quintana Roo', 5)).toBe('+5');
    expect(presenceCount(places, 'Campeche')).toBe('2');
  });

  it('describe nombre, municipio y comisarías', () => {
    const base = { i: 0, state: 'Yucatán', presence: true };
    expect(placeText({ ...base, municipio: 'A', label: 'A', comisarias: [] }, 'Comisarías')).toBe(
      'A',
    );
    expect(
      placeText(
        { ...base, municipio: 'Benito Juárez', label: 'Cancún', comisarias: ['X', 'Y'] },
        'Comisarías',
      ),
    ).toBe('Cancún (Benito Juárez). Comisarías: X y Y');
    expect(
      placeText({ ...base, municipio: 'H', label: 'H', comisarias: ['Puerto: Sisal'] }, 'C'),
    ).toBe('H. Puerto: Sisal');
  });
});
