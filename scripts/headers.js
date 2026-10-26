// @ts-check

/**
 * @typedef {{ pattern: string, headers: Record<string, string> }} HeaderRule
 */

/**
 * Lee un archivo `_headers` de Cloudflare Pages: una ruta sin sangría y debajo
 * sus encabezados con sangría (`Nombre: valor`). Las líneas con `#` son comentarios.
 * @param {string} source
 * @returns {HeaderRule[]}
 */
export function parseHeaders(source) {
  /** @type {HeaderRule[]} */
  const rules = [];
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: trimmed, headers: {} });
      continue;
    }
    const rule = rules.at(-1);
    const colon = trimmed.indexOf(':');
    if (!rule || colon < 1) throw new Error(`Línea de _headers inválida: "${trimmed}"`);
    rule.headers[trimmed.slice(0, colon).trim().toLowerCase()] = trimmed.slice(colon + 1).trim();
  }
  return rules;
}

/**
 * Une los encabezados de todas las reglas que aplican a `path`. Igual que en
 * Cloudflare, `*` cubre cualquier secuencia de caracteres.
 * @param {HeaderRule[]} rules
 * @param {string} path
 * @returns {Record<string, string>}
 */
export function headersFor(rules, path) {
  /** @type {Record<string, string>} */
  const merged = {};
  for (const { pattern, headers } of rules) {
    const regex = new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`);
    if (regex.test(path)) Object.assign(merged, headers);
  }
  return merged;
}

/** @param {string} text */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
