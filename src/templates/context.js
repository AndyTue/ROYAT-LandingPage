// @ts-check

/**
 * @typedef {{ width: number, format: 'avif' | 'webp', file: string }} ImageVariant
 * @typedef {{ width: number, height: number, variants: ImageVariant[] }} ImageEntry
 * @typedef {Record<string, any>} Content contenido de `content/*.json` por nombre de archivo
 * @typedef {{ pal: string[], logo: string[] } & Record<string, any>} StitchPatterns `assets-src/stitch/patterns.json`
 * @typedef {{ content: Content, patterns: StitchPatterns, image: (src: string) => ImageEntry, ogImage: { src: string, width: number, height: number } }} RenderContext
 */

/**
 * Crea el contexto de render a partir del contenido y del manifest de imágenes.
 * @param {Content} content
 * @param {Record<string, any>} manifest `images-manifest.json`
 * @param {StitchPatterns} patterns
 * @returns {RenderContext}
 */
export function createContext(content, manifest, patterns) {
  if (!manifest.og) {
    throw new Error('Falta la imagen OG en images-manifest.json (¿corriste build:images?)');
  }
  return {
    content,
    patterns,
    image(src) {
      const entry = manifest[src];
      if (!entry?.variants?.length) {
        throw new Error(
          `La imagen ${src} no está en images-manifest.json (¿corriste build:images?)`,
        );
      }
      return entry;
    },
    ogImage: manifest.og,
  };
}
