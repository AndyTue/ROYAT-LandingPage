// @ts-check
import { decodeRunLength } from '../../src/js/stitch/patterns.js';

/** @typedef {import('./load.js').Content} Content */

/** Secciones que exige la SPEC (§2), en orden. */
export const SECTION_IDS = ['inicio', 'historia', 'integrantes', 'presencia', 'discografia', 'contacto'];

/**
 * Todas las rutas `assets-src/…` mencionadas en el contenido.
 * @param {unknown} value
 * @param {string[]} [found]
 * @returns {string[]}
 */
export function collectAssetPaths(value, found = []) {
  if (typeof value === 'string') {
    if (value.startsWith('assets-src/')) found.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectAssetPaths(item, found);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectAssetPaths(item, found);
  }
  return found;
}

/**
 * Revisa las referencias entre archivos que un JSON Schema no puede expresar.
 * @param {Content} content
 * @param {(path: string) => boolean} exists
 * @returns {string[]} errores legibles; vacío si todo está bien
 */
export function crossCheck(content, exists) {
  /** @type {string[]} */
  const errors = [];
  const { site, history, members, places, discography, ui } = content;
  const mapGrid = content['map-grid'];

  for (const path of new Set(collectAssetPaths(content))) {
    if (!exists(path)) errors.push(`No existe el archivo ${path}`);
  }

  const navIds = site.nav.map((/** @type {{ id: string }} */ item) => item.id);
  if (navIds.join() !== SECTION_IDS.join()) {
    errors.push(`site.nav debe tener las secciones ${SECTION_IDS.join(', ')} en ese orden`);
  }

  const discIds = new Set(discography.discs.map((/** @type {{ spotifyId: string }} */ d) => d.spotifyId));
  if (discIds.size !== discography.discs.length) errors.push('discography: spotifyId repetido');
  for (const event of history.events) {
    for (const disc of event.discs ?? []) {
      if (!discIds.has(disc.spotifyId)) {
        errors.push(`history: el hito ${event.n} cita el disco ${disc.spotifyId}, que no está en discography`);
      }
    }
  }
  history.events.forEach((/** @type {{ n: number }} */ event, /** @type {number} */ index) => {
    if (event.n !== index + 1) errors.push(`history: el hito en la posición ${index + 1} tiene n=${event.n}`);
  });

  const musicians = [members.director, ...members.sections.flatMap((/** @type {any} */ s) => s.members)];
  musicians.forEach((m, index) => {
    if (m.n !== index + 1) errors.push(`members: ${m.name} tiene n=${m.n} y debería ser ${index + 1}`);
  });

  const states = new Set(places.states);
  places.places.forEach((/** @type {any} */ place, /** @type {number} */ index) => {
    if (place.i !== index) errors.push(`places: ${place.municipio} tiene i=${place.i} en la posición ${index}`);
    if (!states.has(place.state)) errors.push(`places: ${place.municipio} tiene un estado desconocido (${place.state})`);
    if (place.presence && place.colorFamily < 0) errors.push(`places: ${place.municipio} tiene presencia sin color`);
  });
  for (const counter of ui.presence.counters) {
    if (!states.has(counter.state)) errors.push(`ui.presence: contador de un estado desconocido (${counter.state})`);
  }

  if (mapGrid.rows.length !== mapGrid.H) errors.push(`map-grid: ${mapGrid.rows.length} filas y H=${mapGrid.H}`);
  mapGrid.rows.forEach((/** @type {string} */ row, /** @type {number} */ j) => {
    try {
      const cells = decodeRunLength(row);
      if (cells.length !== mapGrid.W) errors.push(`map-grid: la fila ${j} mide ${cells.length} y no ${mapGrid.W}`);
      const unknown = cells.find((cell) => cell !== null && !places.places[cell]);
      if (unknown !== undefined) errors.push(`map-grid: la fila ${j} apunta al municipio ${unknown}, que no existe`);
    } catch (error) {
      errors.push(`map-grid: fila ${j}: ${/** @type {Error} */ (error).message}`);
    }
  });

  return errors;
}
