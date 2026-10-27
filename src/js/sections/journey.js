// @ts-check
// Recorrido del prototipo (ADR-010): Hero + pista horizontal. Es un port de `layout()` y
// `render2()` de reference/prototype/source/Recorrido.dc.html con sus mismas fórmulas y
// constantes; las longitudes se multiplican por U (1 a 1536×800) para escalar a otras pantallas.
import { bus } from '../core/events.js';
import { clamp } from '../core/motion.js';
import { cellFor, mountOrnament } from '../features/ornaments.js';
import { find, findAll } from '../lib/dom.js';
import { createRng } from '../lib/random.js';
import { orderStitches } from '../stitch/order.js';
import { findComponents, parsePattern } from '../stitch/patterns.js';
import { HERO_JITTER, HERO_ORDERS } from '../stitch/presets.js';
import { createStitchLayer, setupCanvas } from '../stitch/renderer.js';
import { createMobileJourney } from './journey-mobile.js';

/**
 * @typedef {import('../core/engine.js').ScrollState} ScrollState
 * @typedef {import('../core/layout.js').Metrics} Metrics
 * @typedef {import('../features/ornaments.js').OrnamentData} OrnamentData
 * @typedef {import('../stitch/renderer.js').StitchLayer} StitchLayer
 * @typedef {{ pal: string[], left: string[], right: string[], logo: string[] }} HeroPatterns
 */

/** Línea de tiempo de la intro, en ms (prototipo `this.T`). */
export const INTRO = {
  pop: [150, 900],
  fly: [1500, 2300],
  stitch: [1500, 3700],
  cue: [4300, 4900],
  end: 4900,
};
/** Scroll del Hero antes de que entre la pista, velocidad de la pista y pausa de Vocalistas (px a U = 1). */
export const T0 = 720;
export const SPEED = 1.3;
export const HOLD = 2600;
/** La escena del prototipo mide 1536×800. */
export const REF = { w: 1536, h: 800 };
/** Ancho mínimo para la escena de escritorio (más angosto, o con poca altura, va en columna). */
const MIN = { w: 768, h: 560 };

const SEED = 2018;

/** @param {number} x */
const out = (x) => 1 - (1 - x) ** 3;
/** @param {number} x */
const inout = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
/** @param {number} a @param {number} b @param {number} k */
const lerp = (a, b, k) => a + (b - a) * k;
/** @param {number} x @param {number} a @param {number} b */
const seg = (x, a, b) => clamp((x - a) / (b - a));

/** Tonos de la pista: bg, fg, fg2, acc, acc2 (prototipo `TONE_HEX`). */
const TONE_HEX = {
  navy: ['#1C2C55', '#F1EEE7', '#C9CFE6', '#F1EEE7', '#E98B1E'],
  paper: ['#ECEAE4', '#151412', '#5F5B53', '#1C2C55', '#B8620F'],
  sand: ['#E3D7BF', '#151412', '#57504A', '#1C2C55', '#9A4C0A'],
  red: ['#9E2430', '#F7EFE3', '#F0D6CC', '#F7EFE3', '#F6CD1F'],
  cream: ['#F4EFE4', '#1C2C55', '#5F5B53', '#1C2C55', '#B8620F'],
};
/** @type {Record<string, number[][]>} */
const TONES = Object.fromEntries(
  Object.entries(TONE_HEX).map(([k, list]) => [
    k,
    list.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))),
  ]),
);

/**
 * Mezcla de tonos bajo el centro de la pantalla (prototipo `applyTone`).
 * @param {{ x: number, w: number, t: number[][] }[]} panels
 * @param {number} tc posición del centro de la pantalla sobre la pista
 * @param {number} W ancho de la pantalla
 */
export function toneMix(panels, tc, W) {
  let i = 0;
  while (i < panels.length - 1 && tc >= panels[i].x + panels[i].w) i++;
  const p = panels[i];
  const band = W * 0.32;
  const toEnd = p.x + p.w - tc;
  const fromStart = tc - p.x;
  let a = p.t;
  let b = p.t;
  let k = 0;
  if (i < panels.length - 1 && toEnd < band) {
    b = panels[i + 1].t;
    k = 0.5 * (1 - toEnd / band);
  } else if (i > 0 && fromStart < band && fromStart >= 0) {
    a = panels[i - 1].t;
    k = 0.5 + 0.5 * (fromStart / band);
  }
  k = k * k * (3 - 2 * k);
  return a.map((c, j) => c.map((v, ch) => Math.round(v + (b[j][ch] - v) * k)));
}

/**
 * Posición de la pista para un scroll (prototipo `render2`): `s` avance, `tx` traslado, `vp`
 * avance de la pausa de Vocalistas.
 * @param {number} y scroll suavizado
 * @param {{ t0: number, speed: number, trackW: number, hold: number, sHold: number, W: number }} g
 */
export function trackPose(y, g) {
  const r = clamp((y - g.t0) * g.speed, 0, g.trackW + g.hold);
  const s = r <= g.sHold ? r : r <= g.sHold + g.hold ? g.sHold : r - g.hold;
  return { r, s, tx: g.W - s, vp: clamp((r - g.sHold) / g.hold) };
}

/**
 * @param {{
 *   root: HTMLElement,
 *   patterns: HeroPatterns,
 *   data: OrnamentData,
 *   getMetrics: () => Metrics,
 *   reduced: boolean,
 * }} options
 */
export function createJourney({ root, patterns, data, getMetrics, reduced }) {
  const track = find(root, '[data-journey-track]', HTMLElement);
  const hero = find(root, '[data-hero]', HTMLElement);
  const logoCanvas = find(hero, '[data-hero-logo]', HTMLCanvasElement);
  const roseL = find(hero, '[data-hero-rose="left"]', HTMLCanvasElement);
  const roseR = find(hero, '[data-hero-rose="right"]', HTMLCanvasElement);
  const crew = find(hero, '[data-hero-crew]', HTMLElement);
  const cue = find(hero, '[data-hero-cue]', HTMLElement);
  const skip = find(hero, '[data-hero-skip]', HTMLButtonElement);
  const panelsEl = findAll(track, '.j-panel', HTMLElement);
  const placed = findAll(root, '[data-at]', HTMLElement);
  const vtw = track.querySelector('[data-vtw]');
  const vcap = track.querySelector('[data-vcap]');
  const word = track.querySelector('.j-word');
  const pre = word?.closest('.j-panel');
  const voc = vtw?.closest('.j-panel');

  // Letras sueltas: cada carácter de un elemento con `data-lt` en su <span class="ch">.
  for (const el of findAll(track, '[data-lt]', HTMLElement)) splitChars(el);

  let live = false;
  /** @type {ReturnType<typeof createMobileJourney> | null} */
  let mobile = null;
  let U = 1;
  let W = REF.w;
  let H = REF.h;
  const intro = {
    t0: /** @type {number | null} */ (null),
    t: reduced ? INTRO.end : 0,
    done: reduced,
  };
  /** @type {Record<string, StitchLayer & { cut?: (s: any) => boolean }>} */
  let layers = {};
  let stitched = -1;
  /** Geometría medida (prototipo `this.A`). */
  let A = /** @type {Record<string, number>} */ ({});
  /** @type {{ e: HTMLElement, x: number, w: number, k: number, vy: number, spin: number, r: number, hasR: boolean, fr: { e2: number } | null }[]} */
  let px = [];
  /** @type {{ e: HTMLElement, x: number, w: number, dir: number, e2: number }[]} */
  let frs = [];
  /** @type {{ e: HTMLElement, x: number, i: number, amp: number, h1: number, h2: number }[]} */
  let chs = [];
  /** @type {{ e: HTMLElement, img: boolean }[]} */
  let oos = [];
  /** @type {{ e: HTMLElement, img: HTMLElement | null, a: number, y: number }[]} */
  let vfs = [];
  /** @type {{ x: number, w: number, t: number[][] }[]} */
  let panels = [];
  /** @type {{ o: NonNullable<ReturnType<typeof mountOrnament>>, x: number, w: number, p: number }[]} */
  let xs = [];
  let toneKey = '';
  let logoC = 0;

  /** Coloca cada pieza con los valores del prototipo × --u. */
  /** @param {boolean} on */
  function place(on) {
    for (const el of placed) {
      const [x, y, w, h, fs] = (el.dataset.at ?? '')
        .split(' ')
        .map((v) => (v === '' ? NaN : Number(v)));
      const u = (/** @type {number | undefined} */ v) =>
        v === undefined || Number.isNaN(v) || !on ? '' : `calc(${v} * var(--u))`;
      if (el.classList.contains('j-panel')) {
        el.style.width = u(w);
        continue;
      }
      el.style.left = u(x);
      el.style.top = u(y);
      el.style.width = u(w);
      el.style.height = u(h);
      el.style.fontSize = u(fs);
    }
    for (const lab of findAll(track, '[data-color]', HTMLElement))
      lab.style.background = lab.dataset.color ?? '';
  }

  /** Capas del Hero (rosas y logo) con el corte en óvalo del prototipo. */
  function buildHero() {
    const S = clamp(Math.min(W / 262, H / 128), 3.6, 6.4);
    const snap = (/** @type {number} */ v) => Math.round(v / S) * S;
    /**
     * @param {HTMLCanvasElement} c @param {string[]} rows @param {number} cell
     * @param {import('../stitch/order.js').OrderFn} order @param {number} seed
     * @param {(s: any) => boolean} [cut]
     */
    const mk = (c, rows, cell, order, seed, cut) => {
      const pattern = parsePattern(rows, patterns.pal);
      const ctx = setupCanvas(c, pattern.w, pattern.h, cell, window.devicePixelRatio);
      c.hidden = false;
      const st = orderStitches(pattern.stitches, {
        w: pattern.w,
        h: pattern.h,
        mode: order,
        rng: createRng(SEED + seed),
        jitter: HERO_JITTER,
      });
      return { layer: createStitchLayer(ctx, st, { cell, skip: cut }), w: pattern.w, h: pattern.h };
    };
    const logo = parsePattern(patterns.logo, patterns.pal);
    const lw = logo.w * S * 0.7;
    const lh = logo.h * S * 0.7;
    const left = parsePattern(patterns.left, patterns.pal);
    const fw = left.w * S;
    const fh = left.h * S;
    const show = Math.min(fw, (W - lw) / 2 - S * 2);
    const IN = W * 0.055;
    A = {
      ...A,
      S,
      lw,
      lh,
      logoX: snap((W - lw) / 2),
      logoY: snap((H - lh) / 2 - H * 0.05),
      lX: snap(show - fw + IN),
      rX: snap(W - show - IN),
      fY: snap((H - fh) / 2),
      lsEnd: 0.8,
      lyEnd: 30 * U,
    };
    // Las guirnaldas se retiran en un óvalo para que el logo y la foto queden en un cartucho.
    const ex = W / 2;
    const ey = H * 0.5;
    const ea = W * 0.36;
    const eb = H * 0.74;
    const rad = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ ph) => {
      const uu = (x - ex) / ea;
      const v = (y - ey) / eb;
      const th = Math.atan2(v, uu);
      return (
        Math.hypot(uu, v) /
        (1 +
          0.055 * Math.sin(3 * th + ph) +
          0.035 * Math.sin(7 * th + ph * 2.3) +
          0.02 * Math.sin(13 * th + ph * 0.7))
      );
    };
    const hash = (/** @type {number} */ i, /** @type {number} */ j) => {
      const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const cutter = (
      /** @type {string[]} */ rows,
      /** @type {number} */ ox,
      /** @type {number} */ oy,
      /** @type {number} */ ph,
    ) => {
      const comp = findComponents(rows);
      const inn = new Float32Array(comp.count);
      const tot = new Float32Array(comp.count);
      const pat = parsePattern(rows, patterns.pal);
      for (const st of pat.stitches) {
        const id = comp.ids[st.j * pat.w + st.i];
        if (id < 0) continue;
        tot[id]++;
        if (rad(ox + (st.i + 0.5) * S, oy + (st.j + 0.5) * S, ph) < 1) inn[id]++;
      }
      const drop = Array.from(tot, (t, k) => inn[k] / t > 0.42);
      return (/** @type {{ i: number, j: number }} */ st) => {
        const id = comp.ids[st.j * pat.w + st.i];
        if (id >= 0) return drop[id];
        return (
          rad(ox + (st.i + 0.5) * S, oy + (st.j + 0.5) * S, ph) <
          1 + (hash(st.i >> 1, st.j >> 1) - 0.5) * 0.07
        );
      };
    };
    layers = {
      L: mk(roseL, patterns.left, S, HERO_ORDERS.left, 1, cutter(patterns.left, A.lX, A.fY, 0.6))
        .layer,
      R: mk(roseR, patterns.right, S, HERO_ORDERS.right, 2, cutter(patterns.right, A.rX, A.fY, 2.1))
        .layer,
      Logo: mk(logoCanvas, patterns.logo, S * 0.7, HERO_ORDERS.logo, 3).layer,
    };
    stitched = -1;
    const hatLine = A.lyEnd + lh * A.lsEnd * 0.56;
    const img = crew.querySelector('img');
    const AR = img
      ? Number(img.getAttribute('height')) / Number(img.getAttribute('width'))
      : 1286 / 2000;
    let crewH = H - hatLine + 40 * U;
    let crewW = crewH / AR;
    if (crewW > W * 0.92) {
      crewW = W * 0.92;
      crewH = crewW * AR;
    }
    crew.style.width = `${crewW}px`;
    A.crewEnd = H - crewH + 40 * U;
  }

  /** Medidas de la pista (prototipo `layout()`): sin transformaciones, en px de la pista. */
  function measureTrack() {
    if (pre && word)
      // El panel mide lo que la palabra más 760 px, y nunca menos que el ancho declarado en el
      // prototipo (4560 px): con la tipografía real la palabra mide menos y el último sobre
      // («Tres voces», a 4170 px) quedaría fuera del panel, recortado.
      /** @type {HTMLElement} */ (pre).style.width =
        `${Math.max(word.getBoundingClientRect().width + 760 * U, 4560 * U)}px`;
    track.style.transform = 'none';
    if (vtw instanceof HTMLElement) vtw.style.transform = 'none';
    const motion = findAll(track, '[data-k],[data-vy],[data-spin]', HTMLElement);
    const letters = findAll(track, '.ch', HTMLElement);
    const frames = findAll(track, '.j-frame', HTMLElement);
    for (const e of motion) e.style.transform = e.dataset.r ? `rotate(${e.dataset.r}deg)` : 'none';
    for (const e of letters) e.style.transform = 'none';
    for (const e of frames) e.style.clipPath = 'none';
    const tb = track.getBoundingClientRect();
    const box = (/** @type {Element} */ e) => {
      const r = e.getBoundingClientRect();
      return { x: r.left - tb.left, w: r.width };
    };
    frs = frames.map((e, i) => ({ e, ...box(e), dir: i % 2, e2: 1 }));
    px = motion.map((e) => {
      const b = box(e);
      const fi = e.classList.contains('j-frame__img')
        ? frames.indexOf(/** @type {HTMLElement} */ (e.parentElement))
        : -1;
      return {
        e,
        ...b,
        k: Number(e.dataset.k ?? 0),
        vy: Number(e.dataset.vy ?? 0),
        spin: Number(e.dataset.spin ?? 0),
        r: Number(e.dataset.r ?? 0),
        hasR: e.dataset.r !== undefined,
        fr: fi >= 0 ? frs[fi] : null,
      };
    });
    chs = letters.map((e) => {
      const b = box(e);
      const grp = /** @type {HTMLElement} */ (e.closest('[data-lt]'));
      const i = [...grp.querySelectorAll('.ch')].indexOf(e);
      return {
        e,
        x: b.x + b.w / 2,
        i,
        amp: Number(grp.dataset.lt) * U,
        h1: ((i * 9301 + 49297) % 233280) / 233280,
        h2: ((i * 4271 + 1013) % 9973) / 9973,
      };
    });
    panels = panelsEl.map((p) => ({
      x: p.offsetLeft,
      w: p.offsetWidth,
      t: TONES[p.dataset.tone ?? 'paper'] ?? TONES.paper,
    }));
    toneKey = '';
    vfs = findAll(track, '[data-vfig]', HTMLElement).map((e, i) => ({
      e,
      img: e.querySelector('picture'),
      a: 0.12 + i * 0.15,
      y: Number(e.dataset.vfigY ?? 0) * U,
    }));
    oos = findAll(track, '.j-oo', HTMLElement).map((e) => ({
      e,
      img: e.classList.contains('j-oo--logo'),
    }));
    if (word instanceof HTMLElement) {
      // Cada "o" gira sobre el centro de su glifo, no sobre la caja de la línea.
      const cs = getComputedStyle(word);
      const fs = parseFloat(cs.fontSize);
      const lh = parseFloat(cs.lineHeight) || fs;
      const ctx = document.createElement('canvas').getContext('2d');
      if (ctx) {
        ctx.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
        const mo = ctx.measureText('o');
        const mb = ctx.measureText('Hg');
        const asc = mb.fontBoundingBoxAscent || fs * 0.9;
        const desc = mb.fontBoundingBoxDescent || fs * 0.25;
        const base = (lh - (asc + desc)) / 2 + asc;
        const oy = base - (mo.actualBoundingBoxAscent - mo.actualBoundingBoxDescent) / 2;
        for (const o of oos)
          o.e.style.transformOrigin = o.img ? '50% 50%' : `50% ${oy.toFixed(1)}px`;
      }
      const lg = oos.find((o) => o.img);
      logoC = lg ? box(lg.e).x + box(lg.e).w / 2 : 0;
    }
    A.trackW = track.scrollWidth;
    A.secI = /** @type {HTMLElement} */ (track.querySelector('#integrantes'))?.offsetLeft ?? 0;
    A.secH = /** @type {HTMLElement} */ (track.querySelector('#historia'))?.offsetLeft ?? 0;
    A.hold = HOLD * U;
    A.sHold = Math.min((voc instanceof HTMLElement ? voc.offsetLeft : A.trackW) + W, A.trackW);
    A.t0 = T0 * U;
    xs = findAll(track, '[data-ornament]', HTMLElement).flatMap((slot, i) => {
      const o = mountOrnament(slot, 700 + i, data, cellFor(false) * U);
      if (!o) return [];
      const b = box(slot);
      return [{ o, x: b.x, w: b.w, p: 0 }];
    });
    if (reduced) for (const x of xs) x.o.layer.drawAll();
    const height = `${Math.round(H + A.t0 + (A.trackW + A.hold) / SPEED)}px`;
    const grew = root.style.height !== height;
    root.style.height = height;
    return grew;
  }

  function measure() {
    const { vw, vh } = getMetrics();
    W = vw;
    H = vh;
    const want = W >= MIN.w && H >= MIN.h;
    const changed = want !== live;
    live = want;
    root.classList.toggle('journey--live', live);
    if (!live) {
      place(false);
      root.style.height = '';
      root.style.removeProperty('--u');
      track.style.transform = '';
      // Columna del prototipo móvil (también la usa el zoom en pantallas anchas).
      root.classList.add('journey--m');
      mobile ??= createMobileJourney({ root, track, hero, patterns, tones: TONES, reduced, intro });
      mobile.measure(W, H);
      const block = getMetrics().blocks.find((b) => b.id === 'inicio');
      section.start = block?.top ?? 0;
      section.end = section.start + root.offsetHeight;
      mobile.render(window.scrollY, window.scrollY);
      return changed;
    }
    if (root.classList.contains('journey--m')) {
      root.classList.remove('journey--m');
      mobile?.reset();
    }
    U = Math.min(H / REF.h, W / 1100);
    root.style.setProperty('--u', `${U}px`);
    place(true);
    buildHero();
    const grew = measureTrack();
    const block = getMetrics().blocks.find((b) => b.id === 'inicio');
    section.start = block?.top ?? 0;
    section.end = section.start + root.offsetHeight;
    render(window.scrollY);
    // Solo si cambió el alto hay que volver a medir el resto de la página.
    return changed || grew;
  }

  /** @param {number} y */
  function render(y) {
    if (!live) return;
    const t = intro.t;
    const yy = y - section.start;
    // ---------- Hero ----------
    const rise = inout(clamp(yy / (560 * U)));
    const sp = out(seg(t, INTRO.stitch[0], INTRO.stitch[1]));
    if (sp !== stitched) {
      stitched = sp;
      layers.L?.advance(clamp(sp * 1.08));
      layers.R?.advance(clamp(sp * 1.08));
      layers.Logo?.advance(clamp((sp - 0.16) / 0.84));
    }
    logoCanvas.style.transformOrigin = '50% 0';
    logoCanvas.style.transform = `translate(${A.logoX}px,${lerp(A.logoY, A.lyEnd, rise)}px) scale(${lerp(1, A.lsEnd, rise)})`;
    roseL.style.transform = `translate(${A.lX - rise * W * 0.012}px,${A.fY - rise * A.S}px)`;
    roseR.style.transform = `translate(${A.rX + rise * W * 0.012}px,${A.fY - rise * A.S}px)`;
    crew.style.transform = `translate(-50%,${lerp(H + 30 * U, A.crewEnd, rise)}px) scale(${lerp(1.08, 1, rise)})`;
    crew.style.opacity = String(clamp(rise * 4));
    cue.style.opacity = String(seg(t, INTRO.cue[0], INTRO.cue[1]) * (1 - clamp(yy / (40 * U))));
    // ---------- Pista ----------
    const { s, tx, vp } = trackPose(yy, {
      t0: A.t0,
      speed: SPEED,
      trackW: A.trackW,
      hold: A.hold,
      sHold: A.sHold,
      W,
    });
    track.style.transform = `translate3d(${tx}px,0,0)`;
    applyTone(s - W / 2);
    const kt = inout(clamp((vp - 0.02) / 0.3));
    if (vtw instanceof HTMLElement)
      vtw.style.transform = `translate3d(${(kt * -208 * U).toFixed(1)}px,${(kt * 132 * U).toFixed(1)}px,0) scale(${lerp(1, 0.42, kt).toFixed(4)})`;
    if (vcap instanceof HTMLElement)
      vcap.style.transform = `translate3d(${(kt * -448 * U).toFixed(1)}px,${(kt * 168 * U).toFixed(1)}px,0)`;
    vfs.forEach((v, i) => {
      const k = out(clamp((vp - v.a) / 0.36));
      v.e.style.transform = `translate3d(0,${lerp(H + 60 * U + i * 50 * U, v.y, k).toFixed(1)}px,0) rotate(${((1 - k) * (i % 2 ? -4 : 4)).toFixed(2)}deg)`;
      if (v.img) v.img.style.transform = `translate3d(0,${((1 - k) * -36 * U).toFixed(1)}px,0)`;
    });
    // Los motivos se bordan, puntada a puntada, al entrar en la pantalla (y se quedan).
    for (const o of xs) {
      if (o.p >= 1) continue;
      const sx = tx + o.x;
      const on = sx + o.w <= W;
      const want = reduced ? (sx < W ? 1 : 0) : on ? 1 : clamp((W * 0.92 - sx) / (W * 0.4));
      const p = reduced ? want : Math.min(want, o.p + 0.025);
      if (p > o.p) {
        o.p = p;
        o.o.layer.advance(p);
      }
    }
    // Las fotos se abren como cortina y se asientan.
    for (const f of frs) {
      const fl = tx + f.x;
      if (fl > W * 1.2 || fl + f.w < -W * 0.2) continue;
      const e = out(clamp((W * 0.98 - fl) / (W * 0.42)));
      f.e2 = e;
      const cut = `${((1 - e) * 100).toFixed(2)}%`;
      f.e.style.clipPath = f.dir ? `inset(0 0 ${cut} 0)` : `inset(${cut} 0 0 0)`;
    }
    // Paralaje, deriva vertical y vinilos que giran.
    for (const p of px) {
      const c = tx + p.x + p.w / 2;
      if (c < -W || c > 2 * W) continue;
      const d = c - W / 2;
      let tf = `translate3d(${(d * p.k).toFixed(1)}px,${(d * p.vy).toFixed(1)}px,0)`;
      if (p.hasR || p.spin) tf += ` rotate(${(p.r + d * p.spin).toFixed(2)}deg)`;
      if (p.fr) tf += ` scale(${(1 + (1 - p.fr.e2) * 0.28).toFixed(3)})`;
      p.e.style.transform = tf;
    }
    // Las letras se juntan al llegar y se dispersan al salir.
    for (const ch of chs) {
      const cx = tx + ch.x;
      if (cx < -W * 0.5 || cx > W * 1.5) continue;
      const pin = out(clamp((W * 1.05 - cx - ch.i * 12 * U) / (W * 0.3)));
      const pex = clamp((W * 0.15 - cx) / (W * 0.5));
      const dy =
        (1 - pin) * ch.amp * (ch.h1 > 0.5 ? 1 : -0.8) * (0.6 + 0.4 * ch.h2) -
        pex * ch.amp * (ch.h2 - 0.5) * 1.4;
      const rot = (1 - pin) * (ch.h2 - 0.5) * 24 + pex * (ch.h1 - 0.5) * 14;
      ch.e.style.transform = `translate3d(0,${dy.toFixed(1)}px,0) rotate(${rot.toFixed(1)}deg)`;
    }
    oos.forEach((o, i) => {
      const a = o.img ? -(s - logoC - W / 2) * 0.14 : -(s * 0.14) - i * 9;
      o.e.style.transform = `rotate(${a.toFixed(1)}deg)`;
    });
  }

  /** @param {number} tc */
  function applyTone(tc) {
    if (!panels.length) return;
    const mix = toneMix(panels, tc, W);
    const css = mix.map((c) => `rgb(${c.join(',')})`);
    const key = css[0] + css[1];
    if (key === toneKey) return;
    toneKey = key;
    const st = track.style;
    const bg = mix[0];
    const lum = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) / 255;
    const l = clamp((lum - 0.35) / 0.45);
    st.setProperty('--xo', (0.9 - 0.24 * l).toFixed(2));
    st.setProperty('--gl', `rgba(255,255,255,${(0.035 + 0.345 * l).toFixed(3)})`);
    ['--bg', '--fg', '--fg2', '--acc', '--acc2'].forEach((k, i) => st.setProperty(k, css[i]));
  }

  function finishIntro() {
    if (intro.done) return;
    intro.done = true;
    intro.t = INTRO.end;
    section.alwaysTick = false;
    skip.hidden = true;
    bus.emit('intro:done');
  }

  const section = {
    id: 'journey',
    start: 0,
    end: 0,
    alwaysTick: !reduced,
    measure,
    /** @param {ScrollState} state */
    update(state) {
      if (!intro.done) {
        if (intro.t0 === null) intro.t0 = state.now;
        intro.t = state.now - intro.t0;
        if (state.target - section.start > 4 || intro.t >= INTRO.end) finishIntro();
      }
      if (live) render(state.y);
      else mobile?.render(state.y, state.target);
    },
    /**
     * Scroll de cada destino de la navegación (prototipo `yFor`).
     * @param {string} name
     */
    yFor(name) {
      if (!live) return null;
      if (name === 'inicio') return section.start;
      if (name === 'vocalistas') return section.start + A.t0 + (A.sHold + A.hold) / SPEED;
      const L = name === 'historia' ? A.secH : A.secI;
      return section.start + A.t0 + (W + L) / SPEED;
    },
    /**
     * Inicio de Historia o Integrantes para `activeSection` (que marca una sección al pasar el
     * 40 % de la pantalla): la marca cambia donde la cambia el prototipo.
     * @param {string} id
     * @param {number} vh
     */
    blockTop(id, vh) {
      if (!live) return null;
      if (id === 'historia')
        return /** @type {number} */ (section.yFor('historia')) - 400 * U + vh * 0.4;
      if (id === 'integrantes')
        return /** @type {number} */ (section.yFor('integrantes')) - (W * 0.5) / SPEED + vh * 0.4;
      return null;
    },
    /** Unidad de escala (1 a 1536×800). */
    unit: () => U,
    isLive: () => live,
  };

  skip.hidden = reduced;
  skip.addEventListener('click', finishIntro);
  if (window.scrollY > window.innerHeight * 0.5) finishIntro();
  hero.classList.add('hero--live');
  if (intro.done) queueMicrotask(() => bus.emit('intro:done'));
  return section;
}

/**
 * Parte en `<span class="ch">` cada carácter del texto de `el`, conservando `<br>` y otros
 * elementos (los textos para lectores de pantalla, `.sr-only`, se dejan intactos).
 * @param {HTMLElement} el
 */
function splitChars(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  /** @type {Text[]} */
  const nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.parentElement?.closest('.sr-only, .j-oo')) nodes.push(/** @type {Text} */ (n));
  }
  for (const node of nodes) {
    const text = node.data;
    if (!text.trim()) continue;
    // Cada palabra va en un `.wd` que no se parte: las letras sueltas (inline-block) no deben
    // repartirse en renglones distintos.
    const frag = document.createDocumentFragment();
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.append(' ');
        continue;
      }
      const wd = document.createElement('span');
      wd.className = 'wd';
      for (const c of part) {
        const span = document.createElement('span');
        span.className = 'ch';
        span.textContent = c;
        wd.append(span);
      }
      frag.append(wd);
    }
    node.replaceWith(frag);
  }
}
