// @ts-check
// assets-src/** → public/img (AVIF y WebP en varios anchos, con hash) + images-manifest.json.
// Solo codifica lo que falta: el hash del nombre cambia si cambia el original o la receta.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import sharp from 'sharp';
import { contentHash, planImage } from './images/plan.js';

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'assets-src');
const PUBLIC = join(ROOT, 'public');
const OUT = join(PUBLIC, 'img');
const MANIFEST = join(ROOT, 'images-manifest.json');
const RASTER = /\.(webp|png|jpe?g)$/i;
const OG = { src: 'assets-src/brand/og-royat.png', width: 1200, height: 630 };

/** @type {Record<'avif' | 'webp', (s: import('sharp').Sharp) => import('sharp').Sharp>} */
const ENCODERS = {
  avif: (s) => s.avif({ quality: 55, effort: 4 }),
  webp: (s) => s.webp({ quality: 78, effort: 5 }),
};

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** @param {string} file */
const toPosix = (file) => relative(ROOT, file).split('\\').join('/');

/** @param {string} file @param {() => Promise<Buffer>} make */
async function writeOnce(file, make) {
  const target = join(PUBLIC, file);
  if (existsSync(target)) return false;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, await make());
  return true;
}

const started = performance.now();
/** @type {Record<string, unknown>} */
const manifest = {};
/** @type {Set<string>} */
const produced = new Set();
let encoded = 0;

for (const file of walk(SOURCE)) {
  const src = toPosix(file);
  const bytes = readFileSync(file);
  const hash = contentHash(bytes);

  if (src.endsWith('.svg')) {
    const out = `img/${posix.relative('assets-src', src).replace(/\.svg$/, `.${hash}.svg`)}`;
    if (await writeOnce(out, async () => bytes)) encoded++;
    produced.add(out);
    manifest[src] = { src: `/${out}`, svg: true };
    continue;
  }
  if (!RASTER.test(src)) continue;

  const { width = 0, height = 0 } = await sharp(bytes).metadata();
  const plan = planImage(src, { width, height, hash });
  const results = await Promise.all(
    plan.variants.map((v) =>
      writeOnce(v.file, () =>
        ENCODERS[v.format](sharp(bytes).resize({ width: v.width })).toBuffer(),
      ),
    ),
  );
  encoded += results.filter(Boolean).length;
  plan.variants.forEach((v) => produced.add(v.file));
  manifest[src] = {
    width,
    height,
    variants: plan.variants.map((v) => ({ ...v, file: `/${v.file}` })),
  };
}

// Imagen para compartir (Open Graph): 1200×630 recortada al centro, en JPEG por compatibilidad.
const ogBytes = readFileSync(join(ROOT, OG.src));
const ogFile = `img/og.${contentHash(ogBytes)}.jpg`;
if (
  await writeOnce(ogFile, () =>
    sharp(ogBytes)
      .resize({ width: OG.width, height: OG.height, fit: 'cover' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer(),
  )
) {
  encoded++;
}
produced.add(ogFile);
manifest.og = { src: `/${ogFile}`, width: OG.width, height: OG.height };

// Borra variantes viejas para que public/img no crezca con cada cambio.
let removed = 0;
if (existsSync(OUT)) {
  for (const file of walk(OUT)) {
    if (!produced.has(toPosix(file).replace(/^public\//, ''))) {
      rmSync(file);
      removed++;
    }
  }
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(
  `✔ imágenes: ${Object.keys(manifest).length} en el manifest, ${encoded} codificadas, ${removed} borradas (${seconds} s)`,
);
