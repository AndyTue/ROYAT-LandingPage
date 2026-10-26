// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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

export default defineConfig({
  plugins: [contentPages()],
  // `vite preview` sirve dist/ con los encabezados de producción: así las pruebas e2e
  // detectan cualquier violación de la CSP antes de llegar a Cloudflare.
  preview: { headers: headersFor(headerRules, '/') },
});
