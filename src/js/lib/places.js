// @ts-check

/**
 * Nombre normalizado para comparar lo que escribe la gente: sin acentos, minúsculas y sin
 * espacios de más ("  tizimin " → "tizimin").
 * @param {string} name
 */
export function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Búsqueda de estado por municipio de la península. Si un nombre se repite en dos estados,
 * gana el primero, como en el prototipo.
 * @param {readonly { name: string, state: string }[]} entries
 * @returns {(name: string) => string | undefined}
 */
export function createStateLookup(entries) {
  /** @type {Map<string, string>} */
  const byName = new Map();
  for (const { name, state } of entries) {
    const key = normalizeName(name);
    if (!byName.has(key)) byName.set(key, state);
  }
  return (name) => byName.get(normalizeName(name));
}

/**
 * Nombres de países en español para las sugerencias de "Fuera de México" (CON-5), a partir
 * de `Intl.DisplayNames`. Se omite México y los códigos sin nombre.
 * @param {(code: string) => string | undefined} nameOf
 * @param {string} [exclude]
 * @returns {string[]}
 */
export function countryNames(nameOf, exclude = 'MX') {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  /** @type {Set<string>} */
  const names = new Set();
  for (const a of letters) {
    for (const b of letters) {
      const code = a + b;
      if (code === exclude) continue;
      const name = nameOf(code);
      if (name && name !== code && !/^[A-Z]{2}$/.test(name)) names.add(name);
    }
  }
  return [...names].sort((x, y) => x.localeCompare(y, 'es'));
}
