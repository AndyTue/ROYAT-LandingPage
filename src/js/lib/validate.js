// @ts-check
import { placeMode } from './contact.js';

/**
 * @typedef {import('./contact.js').ContactData} ContactData
 * @typedef {'name' | 'detail' | 'date' | 'municipality' | 'state' | 'country' | 'phone'} Field
 * @typedef {{ field: Field, message: string }} FieldError
 * @typedef {Record<'name' | 'detail' | 'date' | 'datePast' | 'municipality' | 'alcaldia' | 'city' | 'state' | 'country' | 'phone' | 'phoneAbroad', string>} ErrorText
 */

/** Dígitos mínimos del teléfono: 10 en México; fuera, al menos 8 con lada del país. */
export const MIN_PHONE_DIGITS = { mexico: 10, abroad: 8 };

/** @param {string} phone */
export const phoneDigits = (phone) => phone.replace(/\D/g, '').length;

/**
 * Valida el formulario (CON-3…5). Devuelve los errores en el orden de la carta, para enfocar
 * el primero. Los datos deben venir sin espacios sobrantes.
 * @param {ContactData} data
 * @param {{ today: string, errors: ErrorText, capital: string }} options `today` en ISO
 * @returns {FieldError[]}
 */
export function validateContact(data, { today, errors, capital }) {
  const mode = placeMode(data.state, capital);
  /** @type {FieldError[]} */
  const found = [];
  /** @param {Field} field @param {string} message */
  const fail = (field, message) => found.push({ field, message });

  if (!data.name) fail('name', errors.name);
  if (data.eventType === 'privado' && !data.detail) fail('detail', errors.detail);
  if (!data.date) fail('date', errors.date);
  else if (data.date < today) fail('date', errors.datePast);
  if (!data.municipality) {
    const key = mode === 'abroad' ? 'city' : mode === 'capital' ? 'alcaldia' : 'municipality';
    fail('municipality', errors[key]);
  }
  if (!data.state) fail('state', errors.state);
  if (mode === 'abroad' && !data.country) fail('country', errors.country);
  const min = mode === 'abroad' ? MIN_PHONE_DIGITS.abroad : MIN_PHONE_DIGITS.mexico;
  if (phoneDigits(data.phone) < min) {
    fail('phone', mode === 'abroad' ? errors.phoneAbroad : errors.phone);
  }
  return found;
}
