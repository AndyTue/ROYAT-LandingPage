// @ts-check
// Empareja los archivos de audio de un disco con sus pistas de `content/discography.json`.

/**
 * Palabras que los masters agregan al nombre y no son parte del título.
 */
const NOISE = [
  /en vivo desde la vaqueria de tizimin/g,
  /\bmaster\b/g,
  /\broyat\b/g,
  /\bft\b.*$/g,
  /\bfeat\b.*$/g,
];

/**
 * Abreviaturas de los nombres de archivo.
 * @type {[RegExp, string][]}
 */
const ALIASES = [[/\bhmnos\b/g, 'hermanos']];

/**
 * Nombre comparable: sin acentos, sin extensión ni numeración inicial, sin ruido y solo
 * letras y números ("11. Héctor Rolando (ft. Ángel Moo) - En vivo…" → "hectorrolando").
 * @param {string} name
 */
export function comparable(name) {
  let text = name
    .replace(/\.(wav|mp3|flac|m4a|aiff?)$/i, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/^\s*\d+\s*[.\-_)]\s*/, '')
    .replace(/\([^)]*\)/g, (/** @type {string} */ group) =>
      /\b(ft|feat)\b/.test(group) ? '' : group,
    )
    .replace(/[_/·]/g, ' ');
  for (const [pattern, replacement] of ALIASES) text = text.replace(pattern, replacement);
  for (const pattern of NOISE) text = text.replace(pattern, '');
  return text.replace(/[^a-z0-9]/g, '');
}

/**
 * Para cada pista, el archivo que le corresponde: primero por nombre idéntico y, si no hay,
 * por contener o estar contenido (nombres como "La Angaripola" y "Angaripola"). Falla si una
 * pista queda sin archivo, si dos pistas toman el mismo, o si hay más de un candidato.
 * @param {readonly string[]} files nombres de archivo
 * @param {readonly { title: string }[]} tracks
 * @returns {string[]} un archivo por pista, en el orden de las pistas
 */
export function matchTracks(files, tracks) {
  const keys = files.map((file) => ({ file, key: comparable(file) }));
  /** @type {Set<string>} */
  const used = new Set();
  return tracks.map(({ title }) => {
    const key = comparable(title);
    const exact = keys.filter((f) => f.key === key);
    const loose = keys.filter((f) => f.key && key && (f.key.includes(key) || key.includes(f.key)));
    const found = exact.length ? exact : loose;
    if (found.length !== 1) {
      const options = found.map((f) => f.file).join(' | ') || 'ninguno';
      throw new Error(`La pista "${title}" tiene ${found.length} candidatos: ${options}`);
    }
    const [{ file }] = found;
    if (used.has(file)) throw new Error(`El archivo "${file}" se asignó a dos pistas`);
    used.add(file);
    return file;
  });
}
