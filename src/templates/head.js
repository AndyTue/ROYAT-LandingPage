// @ts-check
import { spotifyAlbumUrl } from './discography.js';
import { html, raw } from './html.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */

/**
 * URL absoluta a partir de una ruta del sitio.
 * @param {string} base
 * @param {string} path
 */
const absolute = (base, path) => new URL(path, `${base.replace(/\/$/, '')}/`).href;

/**
 * Datos estructurados (SEO): MusicGroup con integrantes, redes y discos.
 * @param {RenderContext} ctx
 */
export function structuredData(ctx) {
  const { site, members, discography } = ctx.content;
  const musicians = [
    members.director,
    ...members.sections.flatMap((/** @type {any} */ s) => s.members),
  ];
  const largestWebp = (/** @type {string} */ src) =>
    ctx
      .image(src)
      .variants.filter((v) => v.format === 'webp')
      .at(-1)?.file ?? '';
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: site.name,
    alternateName: site.shortName,
    url: absolute(site.url, '/'),
    image: absolute(site.url, ctx.ogImage.src),
    foundingDate: String(site.founded),
    foundingLocation: { '@type': 'Place', name: site.hometown },
    sameAs: site.social.map((/** @type {{ url: string }} */ s) => s.url),
    member: musicians.map((m) => ({
      '@type': 'OrganizationRole',
      member: { '@type': 'Person', name: m.name },
      roleName: m.role,
    })),
    album: discography.discs.map((/** @type {any} */ d) => ({
      '@type': 'MusicAlbum',
      name: d.title,
      datePublished: String(d.year),
      numTracks: d.tracks.length,
      url: spotifyAlbumUrl(d.spotifyId),
      image: absolute(site.url, largestWebp(d.cover)),
    })),
  };
}

/**
 * Metadatos del `<head>`: descripción, canonical, Open Graph, Twitter y JSON-LD.
 * El JSON-LD es un bloque de datos, no se ejecuta, así que la CSP no lo bloquea.
 * @param {RenderContext} ctx
 */
export function head(ctx) {
  const { site, history } = ctx.content;
  const title = `${site.shortName} · ${site.name}`;
  const description = history.intro.paragraphs[0];
  const url = absolute(site.url, '/');
  const og = ctx.ogImage;
  // `<` escapado: el JSON no puede cerrar el <script> aunque un texto lo contenga.
  const json = JSON.stringify(structuredData(ctx)).replace(/</g, '\\u003c');
  return html`<title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="es_MX" />
    <meta property="og:site_name" content="${site.shortName}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${absolute(site.url, og.src)}" />
    <meta property="og:image:width" content="${og.width}" />
    <meta property="og:image:height" content="${og.height}" />
    <meta property="og:image:alt" content="${history.intro.photo.alt}" />
    <meta name="twitter:card" content="summary_large_image" />
    <script type="application/ld+json">
      ${raw(json)}
    </script>`;
}

/**
 * `sitemap.xml` de una sola URL.
 * @param {RenderContext} ctx
 * @param {Date} lastModified
 */
export function sitemap(ctx, lastModified) {
  const url = absolute(ctx.content.site.url, '/');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${url}</loc><lastmod>${lastModified.toISOString().slice(0, 10)}</lastmod></url>
</urlset>
`;
}

/**
 * `robots.txt` con la ubicación del sitemap.
 * @param {RenderContext} ctx
 */
export function robots(ctx) {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absolute(ctx.content.site.url, '/sitemap.xml')}\n`;
}
