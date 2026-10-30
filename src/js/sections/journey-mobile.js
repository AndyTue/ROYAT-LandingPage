// @ts-check
// Recorrido móvil del prototipo (ADR-010): port de `layout()`, `render2()` y `heroRender()` de
// reference/prototype/source/Recorrido-movil.dc.html. Todo se mide en px del prototipo (390 de
// ancho) y se escala con UM = ancho / 390.
import { mobileUnit } from "../core/layout.js";
import { clamp } from "../core/motion.js";
import { findAll } from "../lib/dom.js";
import { createRng } from "../lib/random.js";
import { MOBILE } from "../journey/layout-mobile.js";
import { orderStitches } from "../stitch/order.js";
import { parsePattern } from "../stitch/patterns.js";
import { HERO_JITTER, HERO_ORDERS } from "../stitch/presets.js";
import {
  createStitchLayer,
  drawLeg,
  MAX_DPR,
  setupCanvas,
  shade,
} from "../stitch/renderer.js";

/** @typedef {import('../stitch/renderer.js').StitchLayer} StitchLayer */

/** @param {number} x */
const out = (x) => 1 - (1 - x) ** 3;
/** @param {number} x */
const inout = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
/** @param {number} a @param {number} b @param {number} k */
const lerp = (a, b, k) => a + (b - a) * k;
/** @param {number} x @param {number} a @param {number} b */
const seg = (x, a, b) => clamp((x - a) / (b - a));

/** Franja de la foto principal que tapa la secundaria (px a 390 de ancho). */
const COVER = 42;

/** Alto del Hero móvil del prototipo (px a 390 de ancho). */
export const HERO_H = 1800;

/**
 * Como `findAll`, sin las piezas que solo se ven en escritorio.
 * @template {Element} T
 * @param {ParentNode} root @param {string} selector @param {new () => T} type
 */
const findLive = (root, selector, type) =>
  findAll(root, selector, type).filter((e) => !e.closest("[data-desk-only]"));

/** Posición de un elemento en el documento (sin transformaciones). */
const docY = (/** @type {Element} */ e) =>
  e.getBoundingClientRect().top + window.scrollY;

/**
 * @param {{
 *   root: HTMLElement,
 *   track: HTMLElement,
 *   hero: HTMLElement,
 *   patterns: { pal: string[], left: string[], right: string[], logo: string[] },
 *   tones: Record<string, number[][]>,
 *   reduced: boolean,
 *   intro: { t: number },
 * }} options
 */
export function createMobileJourney({
  root,
  track,
  hero,
  patterns,
  tones,
  reduced,
  intro,
}) {
  const logoCanvas = /** @type {HTMLCanvasElement} */ (
    hero.querySelector("[data-hero-logo]")
  );
  const roseL = /** @type {HTMLCanvasElement} */ (
    hero.querySelector('[data-hero-rose="left"]')
  );
  const roseR = /** @type {HTMLCanvasElement} */ (
    hero.querySelector('[data-hero-rose="right"]')
  );
  const crew = /** @type {HTMLElement} */ (
    hero.querySelector("[data-hero-crew]")
  );
  const cue = /** @type {HTMLElement} */ (
    hero.querySelector("[data-hero-cue]")
  );
  const events = findAll(track, ".j-event", HTMLElement);
  const panelsEl = findLive(track, ".j-panel", HTMLElement);
  // El glosario y Vocalistas de la pista son de escritorio: en móvil los reemplaza ¡Preciosooo!
  // vertical (`sections/preciosooo.js`).
  const word = track.querySelector(".j-word:not([data-desk-only] .j-word)");
  const glossaryPanel = word?.closest(".j-panel");

  let W = 390;
  let H = 844;
  let UM = 1;
  /** @type {Record<string, any>} */
  let A = {};
  /** @type {Record<string, StitchLayer>} */
  let layers = {};
  let stitched = -1;
  /** @type {{ e: HTMLElement, y: number, i: number, amp: number, h1: number, h2: number, s: string }[]} */
  let chs = [];
  /** @type {{ e: HTMLElement, y: number }[]} */
  let rvs = [];
  /** @type {{ e: HTMLElement, img: HTMLElement | null, y: number, h: number, dir: number, nc: boolean, gr: boolean, lit: boolean }[]} */
  let frs = [];
  /** @type {{ e: HTMLElement, y: number, h: number, r: number, spin: number, py: number, s: string }[]} */
  let px = [];
  /** @type {{ y: number, h: number, t: number[][] }[]} */
  let panels = [];
  /** @type {{ e: HTMLElement, i: number, h1: number, h2: number, s: string }[]} */
  let pws = [];
  /** @type {HTMLElement[]} */
  let oos = [];
  /** @type {{ layer: StitchLayer, y: number, h: number, p: number }[]} */
  let threads = [];
  let toneKey = "";

  /** Datos de movimiento y medidas de cada pieza (tabla del prototipo móvil). */
  function applyTable() {
    /**
     * @param {HTMLElement | null | undefined} el
     * @param {Record<string, any>} d
     */
    const set = (el, d) => {
      if (!el) return;
      for (const [k, v] of Object.entries(d)) {
        if (v === undefined || v === null) continue;
        if (k === "w") el.style.setProperty("--mw", String(v));
        else if (k === "x") el.style.setProperty("--mx", String(v));
        else if (k === "y") el.style.setProperty("--my", String(v));
        else if (k === "right") el.style.setProperty("--mright", String(v));
        else if (k === "wp") el.style.setProperty("--mwp", `${v}%`);
        else el.dataset[`m${k[0].toUpperCase()}${k.slice(1)}`] = String(v);
      }
    };
    events.forEach((li, e) => {
      const ev = MOBILE.events[e];
      if (!ev) return;
      const yr = li.querySelector(".j-yr");
      set(/** @type {HTMLElement} */ (yr), { py: ev.yrPy });
      yr?.classList.toggle("j-yr--sm", Boolean(ev.yrSm));
      const shots = findAll(li, ".j-pf", HTMLElement);
      shots.forEach((pf, k) => set(pf, ev.shots[k] ?? {}));
      li.classList.toggle("j-event--sm", shots.length > 1);
      findAll(li, ".j-vin", HTMLElement).forEach((v, k) =>
        set(v, ev.discs[k] ?? {}),
      );
      li.classList.toggle("j-event--discs", Boolean(ev.discs.length));
      set(
        /** @type {HTMLElement} */ (li.querySelector(".j-badge")),
        ev.badge ?? {},
      );
      if (!li.querySelector(".j-thr")) {
        const c = document.createElement("canvas");
        c.className = "j-thr";
        c.setAttribute("aria-hidden", "true");
        li.prepend(c);
      }
    });
    // Ornamentos del recorrido móvil (otros que los de escritorio).
    const addCx = (
      /** @type {Element | null} */ panel,
      /** @type {any[]} */ list,
    ) => {
      if (!panel || panel.querySelector(".j-mx")) return;
      for (const o of list) {
        const s = document.createElement("span");
        s.className = "ornament j-mx";
        s.setAttribute("aria-hidden", "true");
        s.dataset.ornament = "";
        s.dataset.motif = o.m;
        s.dataset.order = o.ord ?? "out";
        if (o.flip) s.dataset.flip = o.flip;
        if (o.map) s.dataset.map = o.map;
        if (o.s) s.dataset.cellM = String(o.s / 4);
        s.style.setProperty("--mx", String(o.x));
        s.style.setProperty("--my", String(o.y));
        panel.append(s);
      }
    };
    addCx(track.querySelector("#historia"), MOBILE.panels.historia.cx);
    addCx(track.querySelector("#integrantes"), MOBILE.panels.integrantes.cx);
    addCx(
      track.querySelector('.j-panel[data-tone="red"]'),
      MOBILE.panels.director.cx,
    );
    addCx(glossaryPanel ?? null, MOBILE.panels.glossary.cx);
    const bandsEl = panelsEl.filter((p) => p.id.startsWith("seccion-"));
    bandsEl.slice(0, 4).forEach((p, i) => addCx(p, MOBILE.bands[i]?.cx ?? []));
    addCx(bandsEl[4] ?? null, MOBILE.panels.vocals.cx);
    events.forEach((li, e) => addCx(li, MOBILE.events[e]?.cx ?? []));
    bandsEl.slice(0, 4).forEach((p, i) => {
      const b = MOBILE.bands[i];
      if (!b) return;
      set(/** @type {HTMLElement} */ (p.querySelector(".j-rn")), {
        py: b.rnPy,
      });
      findAll(p, ".j-fig", HTMLElement)
        .slice(1)
        .forEach((f, k) => set(f, { py: b.memPy[k] }));
    });
    findAll(track, ".j-card", HTMLElement).forEach((c, k) =>
      set(c, MOBILE.cards[k] ?? {}),
    );
    const voc = bandsEl[4];
    if (voc)
      findAll(voc, ".j-vfig", HTMLElement)
        .slice(1)
        .forEach((f, k) => set(f, { py: MOBILE.vocals.memPy[k] }));
    set(/** @type {HTMLElement} */ (track.querySelector(".j-num--big")), {
      py: MOBILE.director.numPy,
    });
  }

  /** Hilo de la línea de tiempo: una estrella en el marcador y un zigzag hasta el siguiente. */
  function threadLayer(
    /** @type {HTMLCanvasElement} */ c,
    /** @type {number} */ hPx,
  ) {
    const z = 4 * UM;
    const w = 5;
    const hc = Math.max(8, Math.floor(hPx / z));
    const star = ["..f..", ".fkf.", "fkjkf", ".fkf.", "..f.."];
    const Z = ["m..", ".m.", "..m", ".m."];
    const rows = [];
    for (let j = 0; j < hc; j++) {
      let row = "";
      for (let i = 0; i < w; i++) {
        let ch = ".";
        if (j < 5) ch = star[j][i];
        else if (j > 6 && i >= 1 && i <= 3) ch = Z[(j - 7) % 4][i - 1];
        row += ch;
      }
      rows.push(row);
    }
    const pattern = parsePattern(rows, patterns.pal);
    const ctx = setupCanvas(c, w, hc, z, window.devicePixelRatio);
    const st = orderStitches(pattern.stitches, {
      w,
      h: hc,
      mode: "down",
      rng: createRng(SEEDS++),
    });
    return createStitchLayer(ctx, st, { cell: z });
  }
  let SEEDS = 3100;

  /**
   * Posiciones finales del Hero que dependen del alto de la pantalla. Aparte de `buildHero` para
   * recalcularlas sin rehacer los bordados cuando iOS oculta o muestra la barra del navegador.
   */
  function heroTargets() {
    A.logoY = Math.round(A.fw + (H - 2 * A.fw - A.lh) / 2);
    const crewImg = crew.querySelector("img");
    const AR = crewImg
      ? Number(crewImg.getAttribute("height")) /
        Number(crewImg.getAttribute("width"))
      : 1286 / 2000;
    const crewH = heroWidth() * AR;
    A.crewEnd = Math.round(H - A.fw + 22 * UM - crewH);
    A.lyEnd = Math.max(
      Math.round(A.fw * 0.38 + 12 * UM),
      Math.round((A.fw * 0.38 + A.crewEnd - A.lh * A.lsEnd) / 2),
    );
  }

  /**
   * Ancho del Hero: el de la pantalla en teléfono. En tableta vertical las flores, que se
   * escalan con este ancho, taparían el logo (la pantalla es más ancha en proporción al alto):
   * se limita a 0.58 del alto y el bordado queda centrado.
   */
  const heroWidth = () => Math.min(W, H * 0.58);

  function buildHero() {
    const S = Math.min(3, W / 150);
    const HW = heroWidth();
    root.style.setProperty("--s", `${S}px`);
    const rose = parsePattern(patterns.left, patterns.pal);
    const logo = parsePattern(patterns.logo, patterns.pal);
    const roseCell = HW / rose.h;
    const logoCell = (HW * 0.92) / logo.w;
    /**
     * @param {HTMLCanvasElement} c @param {string[]} rows @param {number} cell
     * @param {import('../stitch/order.js').OrderFn} order @param {number} seed
     */
    const mk = (c, rows, cell, order, seed) => {
      const p = parsePattern(rows, patterns.pal);
      const ctx = setupCanvas(c, p.w, p.h, cell, window.devicePixelRatio);
      c.hidden = false;
      const st = orderStitches(p.stitches, {
        w: p.w,
        h: p.h,
        mode: order,
        rng: createRng(2018 + seed),
        jitter: HERO_JITTER,
      });
      return createStitchLayer(ctx, st, { cell });
    };
    layers = {
      L: mk(roseL, patterns.left, roseCell, HERO_ORDERS.left, 1),
      R: mk(roseR, patterns.right, roseCell, HERO_ORDERS.right, 2),
      Logo: mk(logoCanvas, patterns.logo, logoCell, HERO_ORDERS.logo, 3),
    };
    stitched = -1;
    const lw = logo.w * logoCell;
    const lh = logo.h * logoCell;
    const fw = rose.w * roseCell;
    const fh = rose.h * roseCell;
    A = {
      W,
      H,
      lw,
      lh,
      logoX: (W - lw) / 2,
      logoY: 0,
      fw,
      fh,
      lsEnd: 0.9,
    };
    heroTargets();
    crew.style.width = `${HW}px`;
    A.heroH = hero.offsetHeight;
    A.heroY = docY(hero);
  }

  /**
   * La foto secundaria debe tapar solo una franja inferior de la principal: se reserva bajo la
   * principal todo su alto menos esa franja (el alto de cada una depende de su proporción).
   */
  function fitSecondaryPhotos() {
    for (const li of events) {
      const small = li.querySelector(".j-pf--sm");
      const main = li.querySelector(".j-pf:not(.j-pf--sm)");
      if (!(small instanceof HTMLElement) || !(main instanceof HTMLElement))
        continue;
      main.style.marginBlockEnd = "0px";
      main.style.marginBlockEnd = `${Math.max(0, small.offsetHeight - COVER * UM).toFixed(1)}px`;
    }
  }

  function measure(/** @type {number} */ vw, /** @type {number} */ vh) {
    W = vw;
    H = vh;
    // En pantallas anchas sin escena de escritorio (tableta vertical, zoom) la columna crece
    // con tope por alto y se centra (journey-mobile.css).
    UM = mobileUnit(W, H);
    root.style.setProperty("--um", `${UM}px`);
    applyTable();
    fitSecondaryPhotos();
    buildHero();
    chs = findLive(track, "[data-lt] .ch", HTMLElement).map((e) => {
      e.style.transform = "none";
      const grp = /** @type {HTMLElement} */ (e.closest("[data-lt]"));
      const i = [...grp.querySelectorAll(".ch")].indexOf(e);
      return {
        e,
        y: docY(e),
        i,
        amp: Number(grp.dataset.mlt ?? grp.dataset.lt) * 0.7 * UM,
        h1: ((i * 9301 + 49297) % 233280) / 233280,
        h2: ((i * 4271 + 1013) % 9973) / 9973,
        s: "",
      };
    });
    rvs = findLive(track, ".j-rv:not(.in)", HTMLElement).map((e) => ({
      e,
      y: docY(e),
    }));
    frs = findLive(track, ".j-frame, .j-vframe", HTMLElement).map((e, i) => {
      e.style.clipPath = "none";
      return {
        e,
        img: e.querySelector("picture"),
        y: docY(e),
        h: e.offsetHeight,
        dir: i % 2,
        nc: !e.closest(".j-event"),
        gr: e.classList.contains("j-frame--gr"),
        lit: false,
      };
    });
    px = findLive(track, "[data-m-py], [data-m-spin]", HTMLElement).map((e) => {
      e.style.transform = "";
      return {
        e,
        y: docY(e),
        h: e.offsetHeight,
        r: Number(e.dataset.mR ?? 0),
        spin: Number(e.dataset.mSpin ?? 0),
        py: Number(e.dataset.mPy ?? 0),
        s: "",
      };
    });
    panels = panelsEl.map((p) => ({
      y: docY(p),
      h: p.offsetHeight,
      t: tones[p.dataset.tone ?? "paper"] ?? tones.paper,
    }));
    toneKey = "";
    oos = findLive(track, ".j-oo", HTMLElement);
    if (word instanceof HTMLElement && glossaryPanel instanceof HTMLElement) {
      word.style.top = `${Math.max(16, Math.round((H - word.offsetHeight) / 2))}px`;
      A.preY = docY(glossaryPanel);
      A.preH = glossaryPanel.offsetHeight;
      pws = findAll(word, ".ch", HTMLElement).map((e, i) => ({
        e,
        i,
        h1: ((i * 9301 + 49297) % 233280) / 233280,
        h2: ((i * 4271 + 1013) % 9973) / 9973,
        s: "",
      }));
    }
    threads = events.map((li) => {
      const c = /** @type {HTMLCanvasElement} */ (li.querySelector(".j-thr"));
      const h = li.offsetHeight;
      const layer = threadLayer(c, h);
      if (reduced) layer.drawAll();
      return { layer, y: docY(li), h, p: reduced ? 1 : 0 };
    });
  }

  /** Hero móvil (prototipo `heroRender`). @param {number} y */
  function renderHero(y) {
    const p = clamp((y - A.heroY) / Math.max(1, A.heroH - H));
    const t = intro.t;
    const sp = out(seg(t, 1500, 3700));
    if (sp !== stitched) {
      stitched = sp;
      layers.L?.advance(clamp(sp * 1.08));
      layers.R?.advance(clamp(sp * 1.08));
      layers.Logo?.advance(clamp((sp - 0.16) / 0.84));
    }
    const rise = inout(clamp(p / 0.6));
    logoCanvas.style.transformOrigin = "50% 0";
    logoCanvas.style.transform = `translate(${A.logoX}px,${lerp(A.logoY, A.lyEnd, rise)}px) scale(${lerp(1, A.lsEnd, rise)})`;
    const X = (W - A.fh) / 2;
    roseR.style.transformOrigin = "0 0";
    roseL.style.transformOrigin = "0 0";
    roseR.style.transform = `translate(${X}px,${A.fw - rise * A.fw * 0.62}px) rotate(-90deg)`;
    roseL.style.transform = `translate(${X}px,${H}px) rotate(-90deg)`;
    crew.style.transform = `translate(-50%,${lerp(H + 30 * UM, A.crewEnd, rise)}px) scale(${lerp(1.08, 1, rise)})`;
    crew.style.opacity = String(clamp(rise * 4));
    cue.style.opacity = String(seg(t, 4300, 4900) * (1 - clamp(p / 0.06)));
    // Siempre al pie de la pantalla (sobre las flores de abajo), no sobre el logo.
    cue.style.bottom = `${14 * UM}px`;
  }

  /** @param {number} y suavizado @param {number} yr real */
  function render(y, yr) {
    // La barra de Safari iOS cambia el alto visible sin cambiar el del <body>, así que no hay
    // resize que remida: el escenario mide 100dvh y el Hero se acomoda a ese alto cada vez.
    const vh = window.innerHeight;
    if (Math.abs(vh - H) > 1 && A.fw) {
      H = vh;
      heroTargets();
    }
    if (yr < A.heroY + A.heroH + 40) renderHero(y);
    for (const ch of chs) {
      const top = ch.y - y;
      if (top < -H * 0.6 || top > H * 1.2) continue;
      const pin = reduced
        ? 1
        : out(clamp((H * 0.96 - top - ch.i * 9 * UM) / (H * 0.3)));
      const pex = reduced ? 0 : clamp((H * 0.1 - top) / (H * 0.45));
      const dy =
        (1 - pin) * ch.amp * (ch.h1 > 0.5 ? 1 : -0.8) * (0.6 + 0.4 * ch.h2) -
        pex * ch.amp * (ch.h2 - 0.5) * 1.4;
      const rot = (1 - pin) * (ch.h2 - 0.5) * 24 + pex * (ch.h1 - 0.5) * 14;
      const s =
        pin >= 1 && pex <= 0
          ? "none"
          : `translate3d(0,${dy.toFixed(1)}px,0) rotate(${rot.toFixed(1)}deg)`;
      if (s !== ch.s) {
        ch.s = s;
        ch.e.style.transform = s;
      }
    }
    for (let i = rvs.length - 1; i >= 0; i--) {
      if (rvs[i].y - yr < H * 0.9) {
        rvs[i].e.classList.add("in");
        rvs.splice(i, 1);
      }
    }
    for (const f of frs) {
      const top = f.y - y;
      if (top > H * 1.15 || top + f.h < -H * 0.15) continue;
      const e = reduced ? 1 : out(clamp((H * 0.98 - top) / (H * 0.45)));
      const cut = `${((1 - e) * 100).toFixed(1)}%`;
      f.e.style.clipPath =
        e >= 1 ? "none" : f.dir ? `inset(0 0 ${cut} 0)` : `inset(${cut} 0 0 0)`;
      if (f.gr) {
        const lit = Math.abs(top + f.h / 2 - H / 2) < H * 0.24;
        if (lit !== f.lit) {
          f.lit = lit;
          f.e.classList.toggle("lit", lit);
        }
      }
      if (f.img && !reduced && !f.nc)
        f.img.style.transform = `translate3d(0,${((top + f.h / 2 - H / 2) * -0.05).toFixed(1)}px,0) scale(${(1 + (1 - e) * 0.2).toFixed(3)})`;
    }
    for (const p of px) {
      const d = p.y + p.h / 2 - y - H / 2;
      if (Math.abs(d) > H * 1.2) continue;
      const ty = reduced ? 0 : d * p.py;
      const s = `translate3d(0,${ty.toFixed(1)}px,0) rotate(${(p.r + (reduced ? 0 : d * p.spin)).toFixed(2)}deg)`;
      if (s !== p.s) {
        p.s = s;
        p.e.style.transform = s;
      }
    }
    applyTone(y + H * 0.5);
    if (A.preY !== undefined && y > A.preY - H * 1.2 && y < A.preY + A.preH) {
      const st0 = A.preY - y;
      for (const w of pws) {
        const pin = reduced
          ? 1
          : out(
              clamp((H * 0.95 - st0 - 110 * UM - w.i * 22 * UM) / (H * 0.32)),
            );
        const dx =
          (1 - pin) * 30 * UM * (w.h1 > 0.5 ? 1 : -1) * (0.6 + 0.4 * w.h2);
        const rot = (1 - pin) * (w.h2 - 0.5) * 30;
        const s =
          pin >= 1
            ? "none"
            : `translate3d(${dx.toFixed(1)}px,0,0) rotate(${rot.toFixed(1)}deg)`;
        if (s !== w.s) {
          w.s = s;
          w.e.style.transform = s;
        }
      }
      oos.forEach((o, i) => {
        const isLogo = o.classList.contains("j-oo--logo");
        const travel = y - (A.preY - H * 0.2);
        const a = reduced
          ? 0
          : isLogo
            ? Math.max(0, 360 - travel * 0.6)
            : travel * 0.5 + i * 40;
        o.style.transform = `rotate(${a.toFixed(1)}deg)`;
      });
    }
    for (const t of threads) {
      if (t.p >= 1) continue;
      const want = reduced
        ? t.y - yr < H
          ? 1
          : 0
        : clamp((yr + H * 0.8 - t.y) / t.h);
      const p = reduced ? want : Math.min(want, t.p + 0.03);
      if (p > t.p) {
        t.p = p;
        t.layer.advance(p);
      }
    }
  }

  /** Mezcla de tonos entre paneles a media pantalla (prototipo `applyTone` vertical). */
  function applyTone(/** @type {number} */ tc) {
    const P = panels;
    if (!P.length) return;
    let i = 0;
    while (i < P.length - 1 && tc >= P[i].y + P[i].h) i++;
    const p = P[i];
    const band = H * 0.32;
    const toEnd = p.y + p.h - tc;
    const fromStart = tc - p.y;
    let a = p.t;
    let b = p.t;
    let k = 0;
    if (i < P.length - 1 && toEnd < band) {
      b = P[i + 1].t;
      k = 0.5 * (1 - toEnd / band);
    } else if (i > 0 && fromStart < band && fromStart >= 0) {
      a = P[i - 1].t;
      k = 0.5 + 0.5 * (fromStart / band);
    }
    if (tc < P[0].y) {
      a = b = P[0].t;
      k = 0;
    }
    k = k * k * (3 - 2 * k);
    const mix = a.map((c, j) =>
      c.map((v, ch) => Math.round(v + (b[j][ch] - v) * k)),
    );
    const css = mix.map((c) => `rgb(${c.join(",")})`);
    const key = css[0] + css[1];
    if (key === toneKey) return;
    toneKey = key;
    const st = track.style;
    const bg = mix[0];
    const q = clamp(
      ((0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) / 255 - 0.35) / 0.45,
    );
    st.setProperty("--xo", (0.9 - 0.24 * q).toFixed(2));
    st.setProperty(
      "--gl",
      `rgba(255,255,255,${(0.035 + 0.345 * q).toFixed(3)})`,
    );
    ["--bg", "--fg", "--fg2", "--acc", "--acc2"].forEach((n, j) =>
      st.setProperty(n, css[j]),
    );
  }

  /** Quita los estilos del modo móvil (al pasar a escritorio). */
  function reset() {
    track.removeAttribute("style");
    for (const el of findAll(track, ".j-mx, .j-thr", HTMLElement)) el.remove();
    for (const c of chs) c.e.style.transform = "";
    for (const p of px) p.e.style.transform = "";
    for (const f of frs) f.e.style.clipPath = "";
    root.style.removeProperty("--um");
    root.style.removeProperty("--s");
    chs = [];
    px = [];
    frs = [];
    threads = [];
  }

  return {
    measure,
    render,
    reset,
    heroRange: () => [A.heroY ?? 0, A.heroH ?? 0],
  };
}

/**
 * Guirnalda móvil (prototipo `drawHem(c, 3)`): celdas de 3 px × UM, sin estirar.
 * @param {HTMLCanvasElement} c
 * @param {readonly string[]} rows
 * @param {readonly string[]} pal
 * @param {number} cell
 */
export function drawMobileHem(c, rows, pal, cell) {
  const h = rows.length;
  const w = rows[0].length;
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  const cols = Math.ceil((c.parentElement?.clientWidth || 390) / cell) + 1;
  c.width = Math.ceil(cols * cell * dpr);
  c.height = Math.ceil(h * cell * dpr);
  c.style.width = `${cols * cell}px`;
  c.style.height = `${h * cell}px`;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  const p = cell * 0.16;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < cols; i++) {
      const ch = rows[j][i % w];
      if (ch === ".") continue;
      const col = pal[ch.charCodeAt(0) - 97];
      const x = i * cell;
      const y = j * cell;
      drawLeg(
        ctx,
        x + p,
        y + cell - p,
        x + cell - p,
        y + p,
        shade(col, -0.06),
        cell,
      );
      drawLeg(
        ctx,
        x + p,
        y + p,
        x + cell - p,
        y + cell - p,
        shade(col, 0.04),
        cell,
      );
    }
}
