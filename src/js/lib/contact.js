// @ts-check
// Modelo del formulario de contacto: tipos y lugar (México, CDMX o fuera de México).

/**
 * @typedef {'vaqueria' | 'privado'} EventType
 * @typedef {{
 *   name: string,
 *   eventType: EventType,
 *   detail: string,
 *   date: string,
 *   locality: string,
 *   municipality: string,
 *   state: string,
 *   country: string,
 *   phone: string,
 *   message: string,
 * }} ContactData `date` en ISO (AAAA-MM-DD); `state` es el valor del select.
 * @typedef {'mexico' | 'capital' | 'abroad'} PlaceMode
 */

/** Valor del select para "Fuera de México". */
export const ABROAD = '__ext';

/**
 * Cómo se nombra el lugar: en CDMX el municipio es "alcaldía"; fuera de México, "ciudad"
 * y además se pide el país (CON-4, CON-5).
 * @param {string} state
 * @param {string} capital nombre de la Ciudad de México en la lista de estados
 * @returns {PlaceMode}
 */
export function placeMode(state, capital) {
  if (state === ABROAD) return 'abroad';
  return state === capital ? 'capital' : 'mexico';
}

/**
 * Copia de los datos sin espacios sobrantes al inicio y al final.
 * @param {ContactData} data
 * @returns {ContactData}
 */
export function trimContact(data) {
  return /** @type {ContactData} */ (
    Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.trim()]))
  );
}

/**
 * Fecha local de hoy en ISO (AAAA-MM-DD), el mínimo del campo de fecha.
 * @param {Date} now
 */
export function todayISO(now) {
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
