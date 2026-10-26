// @ts-check
// Plantillas como funciones puras: todo valor interpolado se escapa salvo que ya sea SafeHtml.

/** HTML de confianza (generado por nuestras plantillas), que no se vuelve a escapar. */
export class SafeHtml {
  /** @param {string} value */
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

/** @type {Record<string, string>} */
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Escapa texto para usarlo en contenido o en atributos entre comillas.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}

/**
 * @typedef {SafeHtml | string | number | boolean | null | undefined | readonly Interpolation[]} Interpolation
 */

/** @param {Interpolation} value @returns {string} */
function render(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(value);
}

/**
 * Etiqueta de plantilla: `html\`<p>${texto}</p>\``. `null`, `undefined` y booleanos no
 * imprimen nada, lo que permite `${condición && html\`…\`}`.
 * @param {TemplateStringsArray} strings
 * @param {...Interpolation} values
 * @returns {SafeHtml}
 */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += render(value) + strings[i + 1];
  });
  return new SafeHtml(out);
}

/**
 * Marca como confiable un HTML que no viene de datos externos (p. ej. un SVG generado).
 * @param {string} markup
 */
export const raw = (markup) => new SafeHtml(markup);

/**
 * Atributos a partir de un objeto: `true` escribe el atributo vacío; `false`, `null` y
 * `undefined` lo omiten.
 * @param {Record<string, string | number | boolean | null | undefined>} attributes
 * @returns {SafeHtml}
 */
export function attrs(attributes) {
  let out = '';
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) continue;
    out += value === true ? ` ${name}` : ` ${name}="${escapeHtml(value)}"`;
  }
  return new SafeHtml(out);
}
