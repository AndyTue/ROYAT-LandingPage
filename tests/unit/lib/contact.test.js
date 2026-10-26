// @ts-check
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ABROAD, placeMode, todayISO, trimContact } from '../../../src/js/lib/contact.js';
import { countryNames, createStateLookup, normalizeName } from '../../../src/js/lib/places.js';
import { MIN_PHONE_DIGITS, phoneDigits, validateContact } from '../../../src/js/lib/validate.js';
import { buildMessage, formatLongDate, waUrl } from '../../../src/js/lib/whatsapp.js';

const ui = JSON.parse(readFileSync('content/ui.json', 'utf8')).contact;
const CAPITAL = ui.states.capital;
const TODAY = '2026-10-26';

/** @returns {import('../../../src/js/lib/contact.js').ContactData} */
const base = () => ({
  name: 'María Pech',
  eventType: 'vaqueria',
  detail: '',
  date: '2026-12-12',
  locality: '',
  municipality: 'Tizimín',
  state: 'Yucatán',
  country: '',
  phone: '999 123 4567',
  message: '',
});

describe('buildMessage (CON-7)', () => {
  it('vaquería en un municipio de la península', () => {
    expect(buildMessage(base(), ui.message, CAPITAL)).toBe(
      [
        '¡Hola! Quiero solicitar información para un evento con la Real Orquesta Yucateca.',
        '',
        'Nombre: María Pech',
        'Teléfono: 999 123 4567',
        'Fecha: sábado, 12 de diciembre de 2026',
        'Estado: Yucatán',
        'Municipio: Tizimín',
        'Tipo de evento: Vaquería',
      ].join('\n'),
    );
  });

  it('evento privado con especificación, localidad y mensaje', () => {
    const data = {
      ...base(),
      eventType: /** @type {const} */ ('privado'),
      detail: 'boda',
      locality: 'El Cuyo',
      message: 'Por la noche',
    };
    const lines = buildMessage(data, ui.message, CAPITAL).split('\n');
    expect(lines.slice(5)).toEqual([
      'Estado: Yucatán',
      'Municipio: Tizimín',
      'Localidad: El Cuyo',
      'Tipo de evento: Evento privado (boda)',
      'Mensaje: Por la noche',
    ]);
  });

  it('en la Ciudad de México el municipio es alcaldía', () => {
    const data = { ...base(), state: CAPITAL, municipality: 'Coyoacán' };
    expect(buildMessage(data, ui.message, CAPITAL)).toContain(
      'Estado: Ciudad de México\nAlcaldía: Coyoacán',
    );
  });

  it('fuera de México lleva país y ciudad en lugar de estado y municipio', () => {
    const data = { ...base(), state: ABROAD, country: 'Estados Unidos', municipality: 'Miami' };
    const text = buildMessage(data, ui.message, CAPITAL);
    expect(text).toContain('País: Estados Unidos\nCiudad: Miami');
    expect(text).not.toContain('Estado:');
  });

  it('evento privado sin especificación no deja paréntesis vacíos', () => {
    const data = { ...base(), eventType: /** @type {const} */ ('privado') };
    expect(buildMessage(data, ui.message, CAPITAL)).toMatch(/Tipo de evento: Evento privado$/);
  });
});

describe('formatLongDate', () => {
  it('escribe la fecha completa en español sin moverse de día', () => {
    expect(formatLongDate('2026-12-12')).toBe('sábado, 12 de diciembre de 2026');
    expect(formatLongDate('2027-01-01')).toBe('viernes, 1 de enero de 2027');
  });

  it('deja tal cual una fecha mal formada', () => {
    expect(formatLongDate('mañana')).toBe('mañana');
  });
});

describe('waUrl', () => {
  it('codifica el texto para la URL de WhatsApp', () => {
    expect(waUrl('529995893559', '¡Hola!\nNombre: A & B')).toBe(
      'https://wa.me/529995893559?text=%C2%A1Hola!%0ANombre%3A%20A%20%26%20B',
    );
  });
});

describe('validateContact (CON-3…5)', () => {
  const options = { today: TODAY, errors: ui.errors, capital: CAPITAL };
  /** @param {Partial<import('../../../src/js/lib/contact.js').ContactData>} changes */
  const errorsFor = (changes) => validateContact({ ...base(), ...changes }, options);

  it('acepta un formulario completo', () => {
    expect(errorsFor({})).toEqual([]);
  });

  it('reporta los obligatorios en el orden de la carta', () => {
    const empty = { name: '', date: '', municipality: '', state: '', phone: '' };
    expect(errorsFor(empty).map((e) => e.field)).toEqual([
      'name',
      'date',
      'municipality',
      'state',
      'phone',
    ]);
  });

  it('el evento privado exige especificación', () => {
    expect(errorsFor({ eventType: 'privado' })).toEqual([
      { field: 'detail', message: ui.errors.detail },
    ]);
    expect(errorsFor({ eventType: 'privado', detail: 'XV años' })).toEqual([]);
  });

  it('la fecha no puede ser pasada, pero hoy sí vale', () => {
    expect(errorsFor({ date: '2026-10-25' })).toEqual([
      { field: 'date', message: ui.errors.datePast },
    ]);
    expect(errorsFor({ date: TODAY })).toEqual([]);
  });

  it('el mensaje de municipio vacío cambia con el lugar', () => {
    expect(errorsFor({ municipality: '' })[0].message).toBe(ui.errors.municipality);
    expect(errorsFor({ municipality: '', state: CAPITAL })[0].message).toBe(ui.errors.alcaldia);
    expect(errorsFor({ municipality: '', state: ABROAD, country: 'Cuba' })[0].message).toBe(
      ui.errors.city,
    );
  });

  it('fuera de México pide país y acepta 8 dígitos', () => {
    expect(errorsFor({ state: ABROAD }).map((e) => e.field)).toEqual(['country']);
    expect(errorsFor({ state: ABROAD, country: 'Cuba', phone: '+53 5 123 456' })).toEqual([]);
    expect(errorsFor({ state: ABROAD, country: 'Cuba', phone: '1234567' })).toEqual([
      { field: 'phone', message: ui.errors.phoneAbroad },
    ]);
  });

  it('en México el teléfono necesita 10 dígitos', () => {
    expect(errorsFor({ phone: '999 123 456' })).toEqual([
      { field: 'phone', message: ui.errors.phone },
    ]);
    expect(phoneDigits('(999) 123-45-67')).toBe(MIN_PHONE_DIGITS.mexico);
  });
});

describe('contact helpers', () => {
  it('placeMode', () => {
    expect(placeMode('Yucatán', CAPITAL)).toBe('mexico');
    expect(placeMode(CAPITAL, CAPITAL)).toBe('capital');
    expect(placeMode(ABROAD, CAPITAL)).toBe('abroad');
  });

  it('trimContact quita espacios de cada campo', () => {
    expect(trimContact({ ...base(), name: '  Ana ' }).name).toBe('Ana');
  });

  it('todayISO usa la fecha local', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('places', () => {
  it('normaliza acentos, mayúsculas y espacios', () => {
    expect(normalizeName('  Tizimín ')).toBe('tizimin');
    expect(normalizeName('RÍO   Lagartos')).toBe('rio lagartos');
  });

  it('encuentra el estado del municipio sin importar acentos; gana el primero', () => {
    const lookup = createStateLookup([
      { name: 'Tizimín', state: 'Yucatán' },
      { name: 'Bacalar', state: 'Quintana Roo' },
      { name: 'Tizimin', state: 'Campeche' },
    ]);
    expect(lookup('tizimin')).toBe('Yucatán');
    expect(lookup('BACALAR')).toBe('Quintana Roo');
    expect(lookup('Puebla')).toBeUndefined();
  });

  it('lista países en español, ordenados y sin México', () => {
    const names = new Intl.DisplayNames(['es'], { type: 'region', fallback: 'none' });
    const list = countryNames((code) => names.of(code));
    expect(list).toContain('Estados Unidos');
    expect(list).toContain('España');
    expect(list).not.toContain('México');
    expect(list).toEqual([...list].sort((a, b) => a.localeCompare(b, 'es')));
  });

  it('descarta códigos sin nombre', () => {
    expect(countryNames((code) => (code === 'AR' ? 'Argentina' : code))).toEqual(['Argentina']);
  });
});
