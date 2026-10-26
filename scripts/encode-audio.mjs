// @ts-check
// Convierte los masters de la ROYAT (WAV/MP3) en AAC para la web: public/audio/<spotifyId>/NN.m4a
//
//   node scripts/encode-audio.mjs <carpeta-de-masters>
//
// Requiere ffmpeg en el PATH o en la variable FFMPEG. Los .m4a no se versionan (ADR-007): se
// suben al bucket de audio y `site.audio.baseUrl` apunta a él. Salta lo que ya existe.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from './content/load.js';
import { matchTracks } from './audio/match.js';

/** Carpeta de masters → disco (por título y tipo) en discography.json. */
const SOURCES = [
  { folder: 'La Fiesta de Yucatán', title: 'La Fiesta de Yucatán', type: 'Álbum' },
  { folder: 'JUBILEO DE ORO', title: 'Jubileo de Oro', type: 'Álbum' },
  {
    folder: '¡A Bailar En Tizimín! - En Vivo Desde La Vaquería De Tizimín 2024',
    title: '¡A Bailar en Tizimín!',
    type: 'Álbum en vivo',
  },
];
/** Sencillos: un archivo suelto en `Singles/` por disco. */
const SINGLES = [
  ['Britany Adriana.mp3', 'Britany Adriana'],
  ['El niño de San Felipe.mp3', 'El niño de San Felipe'],
  ['La Flor del Oriente.mp3', 'La Flor del Oriente'],
  ['Linda Elizabeth.mp3', 'Linda Elizabeth'],
  ['Mi Lindo Sucilá.mp3', 'Mi Lindo Sucilá'],
  ['Miguel Eduardo.mp3', 'Miguel Eduardo'],
  ['¡A Bailar en Tizimín!.mp3', '¡A Bailar en Tizimín!'],
];
/** AAC-LC estéreo a 128 kbps, nivelado a -14 LUFS para que no haya saltos entre discos. */
const FFMPEG_ARGS = [
  '-vn',
  '-map_metadata',
  '-1',
  '-af',
  'loudnorm=I=-14:TP=-1.5:LRA=11',
  '-c:a',
  'aac',
  '-b:a',
  '128k',
  '-ac',
  '2',
  '-movflags',
  '+faststart',
];

const source = process.argv[2];
if (!source || !existsSync(source)) {
  console.error('Uso: node scripts/encode-audio.mjs <carpeta-de-masters>');
  process.exit(1);
}
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
const { discs } = loadContent().discography;
const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');

/** @param {string} title @param {string} type */
function findDisc(title, type) {
  const disc = discs.find((/** @type {any} */ d) => d.title === title && d.type === type);
  if (!disc) throw new Error(`No hay disco "${title}" (${type}) en discography.json`);
  return disc;
}

/** @type {{ input: string, output: string }[]} */
const jobs = [];
for (const { folder, title, type } of SOURCES) {
  const disc = findDisc(title, type);
  const dir = join(source, folder);
  const files = readdirSync(dir).filter((f) => /\.(wav|mp3|flac)$/i.test(f));
  const matched = matchTracks(files, disc.tracks);
  matched.forEach((file, i) =>
    jobs.push({
      input: join(dir, file),
      output: join('public', 'audio', disc.spotifyId, `${pad(i + 1)}.m4a`),
    }),
  );
}
for (const [file, title] of SINGLES) {
  const disc = findDisc(title, 'Sencillo');
  jobs.push({
    input: join(source, 'Singles', file),
    output: join('public', 'audio', disc.spotifyId, '01.m4a'),
  });
}

// DRY=1 solo muestra qué archivo corresponde a cada pista.
if (process.env.DRY) {
  for (const job of jobs)
    console.log(`${job.input.split(/[\\/]/).slice(-2).join('/')}  →  ${job.output}`);
  process.exit(0);
}

let done = 0;
let skipped = 0;
for (const { input, output } of jobs) {
  if (existsSync(output) && statSync(output).size > 0) {
    skipped++;
    continue;
  }
  mkdirSync(join(output, '..'), { recursive: true });
  const result = spawnSync(
    ffmpeg,
    ['-y', '-loglevel', 'error', '-i', input, ...FFMPEG_ARGS, output],
    {
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );
  if (result.status !== 0) {
    console.error(`✖ falló ${input}`);
    process.exit(1);
  }
  done++;
  console.log(`✔ ${done + skipped}/${jobs.length} ${output}`);
}
console.log(`✔ audio: ${done} codificados, ${skipped} ya existían, ${jobs.length} pistas`);
