// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import cascadeLayers from '@csstools/postcss-cascade-layers';
import { defineConfig } from 'vite';
import { loadContent } from './scripts/content/load.js';
import { headersFor, parseHeaders } from './scripts/headers.js';

const headerRules = parseHeaders(readFileSync('public/_headers', 'utf8'));
const MANIFEST = 'images-manifest.json';
const TEMPLATES = '/src/templates/index.js';
const MARKER = '<!-- @section:';
const PATTERNS = 'assets-src/stitch/patterns.json';
const MOTIFS = 'assets-src/stitch/motifs.json';

/** @param {string} file */
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const readPatterns = () => {
  const { motifs, bands } = readJson(MOTIFS);
  return { ...readJson(PATTERNS), motifs, bands };
};

function readManifest() {
  if (!existsSync(MANIFEST))
    throw new Error('Falta images-manifest.json: corre `npm run build:images`');
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

/**
 * Genera el HTML de las secciones a partir de content/ (ADR-002), y sitemap.xml y robots.txt.
 * @returns {import('vite').Plugin}
 */
function contentPages() {
  /** @type {import('vite').ViteDevServer | undefined} */
  let server;
  // En dev se cargan con ssrLoadModule para tomar los cambios de las plantillas sin reiniciar.
  const templates = async () =>
    /** @type {typeof import('./src/templates/index.js')} */ (
      server
        ? await server.ssrLoadModule(TEMPLATES)
        : await import(pathToFileURL(resolve(`.${TEMPLATES}`)).href)
    );
  return {
    name: 'royat-content',
    configureServer(devServer) {
      server = devServer;
      devServer.watcher.add(['content', MANIFEST, PATTERNS, MOTIFS]);
      devServer.watcher.on('change', (file) => {
        if (/[\\/](content|templates)[\\/]|images-manifest\.json$/.test(file)) {
          devServer.ws.send({ type: 'full-reload' });
        }
      });
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        if (!html.includes(MARKER)) return html;
        const { createContext, renderPage } = await templates();
        return renderPage(html, createContext(loadContent(), readManifest(), readPatterns()));
      },
    },
    async generateBundle() {
      const { createContext, robots, sitemap } = await templates();
      const ctx = createContext(loadContent(), readManifest(), readPatterns());
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(ctx, new Date()) });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots(ctx) });
    },
  };
}

/**
 * Navegadores que deben ver el sitio completo. Incluye el de la Nintendo Switch (WebKit de la
 * época de Safari 12/13) y iPads que ya no se actualizan: sin estos destinos, el CSS sale con
 * `@layer` y rangos en `@media` (que ignoran por completo) y el JS con sintaxis que no leen.
 */
const LEGACY = ['safari12', 'ios12', 'chrome80', 'firefox78', 'edge88'];

/**
 * `svh`/`dvh` no existen antes de Safari 15.4: cada declaración que los usa recibe antes una
 * copia en `vh`. Una propiedad personalizada no se descarta al leerse, así que la suya va
 * en un `@supports not` aparte. Corre antes del polyfill de capas para que las copias hereden
 * su capa.
 * @returns {import('postcss').Plugin}
 */
function viewportFallback() {
  const UNITS = /(\d)[sdl]vh\b/g;
  return {
    postcssPlugin: 'royat-viewport-fallback',
    Declaration(decl) {
      if (!/\d[sdl]vh\b/.test(decl.value)) return;
      const value = decl.value.replace(UNITS, '$1vh');
      if (!decl.prop.startsWith('--')) {
        decl.cloneBefore({ value });
        return;
      }
      const rule = decl.parent;
      if (rule?.type !== 'rule') return;
      const fallback = /** @type {import('postcss').Rule} */ (rule).clone({
        nodes: [],
      });
      fallback.append(decl.clone({ value }));
      rule.after({
        name: 'supports',
        params: 'not (height: 1dvh)',
        nodes: [fallback],
      });
    },
  };
}
viewportFallback.postcss = true;

/**
 * Lightning CSS baja `inset` y las propiedades lógicas para Safari < 14.1, salvo cuando el valor
 * usa `var()` (no sabe cuántos valores trae). Aquí se bajan esas a físicas: el sitio es solo
 * `ltr` y horizontal, así que el resultado es idéntico en los navegadores modernos.
 * @returns {import('postcss').Plugin}
 */
function logicalFallback() {
  const SIDE = {
    'block-start': 'top',
    'block-end': 'bottom',
    'inline-start': 'left',
    'inline-end': 'right',
  };
  const AXIS = { block: ['top', 'bottom'], inline: ['left', 'right'] };
  const LOGICAL = /^(inset|margin|padding)(?:-(block|inline)(?:-(start|end))?)?$/;
  return {
    postcssPlugin: 'royat-logical-fallback',
    Declaration(decl, { list }) {
      const match = LOGICAL.exec(decl.prop);
      if (!match || !decl.value.includes('var(')) return;
      const [, kind, axis, edge] = match;
      if (!axis && kind !== 'inset') return;
      const name = (/** @type {string} */ side) => (kind === 'inset' ? side : `${kind}-${side}`);
      const values = list.space(decl.value);
      /** @type {[string, string][]} */
      let out;
      if (edge) {
        out = [[name(SIDE[/** @type {keyof typeof SIDE} */ (`${axis}-${edge}`)]), decl.value]];
      } else if (axis) {
        const [a, b] = AXIS[/** @type {keyof typeof AXIS} */ (axis)];
        out = [
          [name(a), values[0]],
          [name(b), values[1] ?? values[0]],
        ];
      } else {
        const [t, r = t, b = t, l = r] = values;
        out = [
          ['top', t],
          ['right', r],
          ['bottom', b],
          ['left', l],
        ];
      }
      for (const [prop, value] of out) decl.cloneBefore({ prop, value });
      decl.remove();
    },
  };
}
logicalFallback.postcss = true;

export default defineConfig({
  plugins: [contentPages()],
  css: {
    postcss: {
      plugins: [viewportFallback(), logicalFallback(), cascadeLayers()],
    },
  },
  build: { target: LEGACY, cssTarget: LEGACY, cssMinify: 'lightningcss' },
  // `vite preview` sirve dist/ con los encabezados de producción: así las pruebas e2e
  // detectan cualquier violación de la CSP antes de llegar a Cloudflare.
  preview: { headers: headersFor(headerRules, '/') },
});
