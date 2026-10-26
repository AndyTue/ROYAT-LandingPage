// @ts-check
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { collectAssetPaths, crossCheck } from '../../../scripts/content/checks.js';
import { loadContent } from '../../../scripts/content/load.js';

/** Copia profunda del contenido real para modificarlo en cada prueba. */
const fresh = () => structuredClone(loadContent());
const always = () => true;

describe('collectAssetPaths', () => {
  it('encuentra las rutas en cualquier nivel', () => {
    expect(collectAssetPaths({ a: 'assets-src/x.webp', b: [{ c: 'assets-src/y.png' }, 'otro'] })).toEqual([
      'assets-src/x.webp',
      'assets-src/y.png',
    ]);
  });
});

describe('crossCheck', () => {
  it('el contenido real es coherente', () => {
    expect(crossCheck(fresh(), existsSync)).toEqual([]);
  });

  it('detecta archivos que no existen', () => {
    const errors = crossCheck(fresh(), (path) => !path.endsWith('chemax.webp'));
    expect(errors).toEqual(['No existe el archivo assets-src/history/chemax.webp']);
  });

  it('exige las seis secciones de la SPEC en orden', () => {
    const content = fresh();
    content.site.nav.reverse();
    expect(crossCheck(content, always)[0]).toMatch(/site\.nav/);
  });

  it('detecta un disco citado en la historia que no existe', () => {
    const content = fresh();
    content.history.events.find((/** @type {any} */ e) => e.discs).discs[0].spotifyId = 'x'.repeat(22);
    expect(crossCheck(content, always).join()).toMatch(/cita el disco x{22}/);
  });

  it('detecta numeraciones fuera de orden', () => {
    const content = fresh();
    content.history.events[1].n = 9;
    content.members.sections[0].members[0].n = 99;
    const errors = crossCheck(content, always).join('\n');
    expect(errors).toMatch(/hito en la posición 2/);
    expect(errors).toMatch(/n=99/);
  });

  it('detecta municipios inconsistentes', () => {
    const content = fresh();
    content.places.places[0].i = 7;
    content.places.places[1].state = 'Tabasco';
    const presence = content.places.places.find((/** @type {any} */ p) => p.presence);
    presence.colorFamily = -1;
    const errors = crossCheck(content, always).join('\n');
    expect(errors).toMatch(/i=7/);
    expect(errors).toMatch(/estado desconocido \(Tabasco\)/);
    expect(errors).toMatch(/presencia sin color/);
  });

  it('detecta contadores de un estado desconocido', () => {
    const content = fresh();
    content.ui.presence.counters[0].state = 'Hidalgo';
    expect(crossCheck(content, always).join()).toMatch(/contador de un estado desconocido/);
  });

  it('valida la rejilla del mapa', () => {
    const content = fresh();
    const grid = content['map-grid'];
    grid.rows[0] = '.*3';
    grid.rows[1] = `.*154,${(999).toString(36)}`;
    grid.rows[2] = 'a*0';
    grid.rows.pop();
    const errors = crossCheck(content, always).join('\n');
    expect(errors).toMatch(/filas y H=/);
    expect(errors).toMatch(/fila 0 mide 3/);
    expect(errors).toMatch(/municipio 999/);
    expect(errors).toMatch(/fila 2: Segmento inválido/);
  });

  it('detecta discos repetidos', () => {
    const content = fresh();
    content.discography.discs.push(content.discography.discs[0]);
    expect(crossCheck(content, always).join()).toMatch(/spotifyId repetido/);
  });
});
