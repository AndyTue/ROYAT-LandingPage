// @ts-check
// ¡Preciosooo! móvil vertical (MOV-3b): port de `layout()` y `render()` de
// reference/prototype/preciosooo-vertical.html, con sus mismas fórmulas. Las longitudes del
// prototipo (390×844) se multiplican por `f = min(ancho / 390, 1.2)`.
import { clamp, lerp } from '../core/motion.js';
import { find, findAll } from '../lib/dom.js';
import { createRng } from '../lib/random.js';
import {
  CARD,
  CARDS,
  EDGE,
  HOLD,
  MOTIFS,
  TRIO,
  VOICE_STITCHES,
  WORD_TOP,
} from '../journey/preciosooo-data.js';
import { orderStitches } from '../stitch/order.js';
import { parseColorMap, parsePattern, rotateRows } from '../stitch/patterns.js';
import { createStitchLayer, setupCanvas } from '../stitch/renderer.js';

/**
 * @typedef {import('../core/engine.js').ScrollState} ScrollState
 * @typedef {import('../features/ornaments.js').OrnamentData} OrnamentData
 * @typedef {{ m: string, x: number, y?: number, yo?: number, bottom?: number, ord: string, s: number, rot?: boolean, map?: string, panel: 'pre' | 'voc' }} StitchSpec
 * @typedef {{ spec: StitchSpec, canvas: HTMLCanvasElement, layer: import('../stitch/renderer.js').StitchLayer, w: number, h: number, y: number, p: number }} Stitched
 */

/** Tope del factor de escala (spec: `f = min(ancho / 390, 1.2)`). */
const MAX_SCALE = 1.2;
/** Suma máxima de avance por fotograma al bordar (prototipo). */
const SEW_STEP = 0.025;

/** Tonos de la tira: bg, fg, fg2, acc, acc2 (prototipo `TONE_HEX`). */
const TONE_HEX = {
  navy: ['#1C2C55', '#F1EEE7', '#C9CFE6', '#F1EEE7', '#E98B1E'],
  cream: ['#F4EFE4', '#1C2C55', '#5F5B53', '#1C2C55', '#B8620F'],
};
/** @type {Record<string, number[][]>} */
const TONES = Object.fromEntries(
  Object.entries(TONE_HEX).map(([k, list]) => [
    k,
    list.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))),
  ]),
);

/** @param {number} x */
const out = (x) => 1 - (1 - x) ** 3;
/** Ruido determinista por letra (prototipo: `h1` y `h2`). @param {number} i */
const hash = (i) => [((i * 9301 + 49297) % 233280) / 233280, ((i * 4271 + 1013) % 9973) / 9973];

/**
 * Mezcla de tonos bajo el centro de la pantalla (prototipo `applyTone`, banda de 0.32·H).
 * @param {{ y: number, h: number, t: number[][] }[]} panels
 * @param {number} tc posición del centro de la pantalla sobre la tira
 * @param {number} H
 */
export function stripTone(panels, tc, H) {
  let i = 0;
  while (i < panels.length - 1 && tc >= panels[i].y + panels[i].h) i++;
  const p = panels[i];
  const band = H * 0.32;
  const toEnd = p.y + p.h - tc;
  const fromStart = tc - p.y;
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
 * @param {{
 *   root: HTMLElement,
 *   data: OrnamentData,
 *   reduced: boolean,
 * }} options
 * @returns {import('../core/engine.js').Section}
 */
export function createPreciosooo({ root, data, reduced }) {
  const pin = find(root, '[data-prec-pin]', HTMLElement);
  const stage = find(root, '[data-prec-stage]', HTMLElement);
  const track = find(root, '[data-prec-track]', HTMLElement);
  const pre = find(root, '[data-prec-pre]', HTMLElement);
  const voc = find(root, '[data-prec-voc]', HTMLElement);
  const wordEl = find(pre, '.prec__word', HTMLElement);
  const trioEl = find(voc, '[data-prec-trio]', HTMLElement);
  const trioImg = trioEl.querySelector('picture');
  const hint = find(root, '[data-prec-hint]', HTMLElement);
  const cardEls = findAll(pre, '.card', HTMLElement);
  const oos = findAll(pre, '.oo', HTMLElement);

  /** Medidas de la última medición. @type {Record<string, any>} */
  let A = { active: false };
  /** @type {Stitched[]} */
  let stitched = [];
  let stitchKey = '';
  /** @type {{ e: HTMLElement, y: number, h: number, k: number, r: number, s: string }[]} */
  let cards = [];
  /** @type {{ e: HTMLElement, y: number, i: number, amp: number, side: boolean, end: boolean, h1: number, h2: number, s: string }[]} */
  let letters = [];
  /** @type {{ y: number, h: number, t: number[][] }[]} */
  let panels = [];
  /** @type {{ e: HTMLElement, y: number }[]} */
  let reveals = [];
  let logoC = 0;
  let toneKey = '';
  /** Últimos valores escritos, para no tocar el DOM si no cambian. */
  const last = {
    track: '',
    trio: '',
    trioImg: '',
    hint: '',
  };
  /** @type {string[]} */
  let oosS = [];
  let lastY = Number.NaN;

  /** @param {StitchSpec[]} specs @param {number} f */
  function buildStitches(specs, f) {
    const key = `${f}|${specs.length}|${specs.map((s) => s.m).join()}`;
    if (key === stitchKey) return;
    stitchKey = key;
    const old = stitched;
    for (const o of old) o.canvas.remove();
    stitched = specs.flatMap((spec, i) => {
      let rows = data.motifs[spec.m];
      if (!rows) return [];
      if (spec.rot) rows = rotateRows(rows, 'cw');
      const pattern = parsePattern(rows, data.pal, {
        colorMap: parseColorMap(spec.map ?? ''),
      });
      if (!pattern.w) return [];
      const cell = spec.s * f;
      const canvas = document.createElement('canvas');
      canvas.className = 'prec__cx';
      canvas.setAttribute('aria-hidden', 'true');
      const ctx = setupCanvas(canvas, pattern.w, pattern.h, cell, window.devicePixelRatio);
      const order = orderStitches(pattern.stitches, {
        w: pattern.w,
        h: pattern.h,
        mode: /** @type {import('../stitch/order.js').OrderMode} */ (spec.ord),
        rng: createRng(3200 + i),
      });
      const layer = createStitchLayer(ctx, order, { cell });
      (spec.panel === 'pre' ? pre : voc).append(canvas);
      // Un cambio de escala rehace los lienzos, pero lo ya bordado se queda bordado.
      const p = reduced
        ? 1
        : (old.find((o) => o.spec.m === spec.m && o.spec.x === spec.x && o.spec.y === spec.y)?.p ??
          0);
      if (p > 0) layer.advance(p);
      return [
        {
          spec,
          canvas,
          layer,
          w: pattern.w * cell,
          h: pattern.h * cell,
          y: 0,
          p,
        },
      ];
    });
  }

  function measure() {
    const active = root.offsetHeight > 0;
    A = { active };
    section.start = section.end = Number.MAX_SAFE_INTEGER;
    if (!active) return false;

    const f = Math.min(root.clientWidth / 390, MAX_SCALE);
    root.style.setProperty('--f', `${f}px`);
    stage.classList.add('prec--tn');

    // Se miden las piezas sin transformaciones.
    track.style.transform = 'none';
    last.track = '';
    for (const e of [...findAll(track, '.ch, .oo, .card, [data-prec-trio]', HTMLElement)])
      e.style.transform = 'none';
    trioImg?.style.removeProperty('transform');
    last.trio = last.trioImg = '';
    letters.forEach((l) => (l.s = ''));
    oosS = [];

    const vh = window.innerHeight;
    const H = stage.offsetHeight;
    const wt = Math.round(WORD_TOP * f);
    const L = wordEl.offsetHeight;
    // La tira termina en cuanto pasan la palabra y la última tarjeta: sin hueco antes de Vocalistas.
    const cardsEnd = (CARD.top + (CARDS.length - 1) * CARD.step + 178) * f;
    pre.style.height = `${Math.round(Math.max(wt + L, wt + cardsEnd) + 70 * f)}px`;
    voc.style.height = `${H}px`;
    // Las tarjetas alternan en las bandas laterales de la columna: nunca tapan una letra.
    cardEls.forEach((e, i) => {
      e.style.left = `${(i % 2 ? CARD.right : CARD.left) * f}px`;
      e.style.top = `${Math.round(wt + (CARD.top + i * CARD.step) * f)}px`;
    });
    // La foto del trío sube hasta su sitio sin salirse de pantallas bajas.
    const trioY = Math.min(TRIO.top * f, H - (TRIO.height + 30) * f);
    trioEl.style.setProperty('--trio-y', `${trioY}px`);
    voc.style.setProperty('--cap-y', `${612 * f + (trioY - TRIO.top * f)}px`);

    // ---- bordados
    const preH = pre.offsetHeight;
    /** @type {StitchSpec[]} */
    const specs = [];
    for (let k = 0; EDGE.leftFrom + EDGE.step * k < preH / f; k++) {
      specs.push({
        m: k % 2 ? 'dflor' : 'dzig',
        x: EDGE.left,
        y: EDGE.leftFrom + EDGE.step * k,
        ord: 'down',
        s: 4,
        rot: true,
        panel: 'pre',
      });
    }
    for (let k = 0; EDGE.rightFrom + EDGE.step * k < preH / f; k++) {
      specs.push({
        m: k % 2 ? 'flor5' : 'drombos',
        x: EDGE.right,
        y: EDGE.rightFrom + EDGE.step * k,
        ord: 'down',
        s: 4,
        rot: true,
        panel: 'pre',
      });
    }
    for (const m of MOTIFS)
      specs.push({
        m: m.m,
        x: m.x,
        yo: m.yo,
        ord: 'out',
        s: 5,
        map: m.map,
        panel: 'pre',
      });
    for (const v of VOICE_STITCHES) specs.push({ ...v, panel: 'voc' });
    buildStitches(specs, f);
    const vocY = voc.offsetTop;
    for (const o of stitched) {
      const { spec } = o;
      const top =
        spec.yo !== undefined
          ? wt + spec.yo * f - o.h / 2
          : spec.bottom !== undefined
            ? H - spec.bottom * f
            : /** @type {number} */ (spec.y) * f;
      o.canvas.style.left = `${spec.x * f}px`;
      o.canvas.style.top = `${Math.round(top)}px`;
      o.y = (spec.panel === 'voc' ? vocY : 0) + Math.round(top);
    }

    // ---- piezas que se mueven
    const tb = track.getBoundingClientRect();
    const box = (/** @type {Element} */ e) => {
      const r = e.getBoundingClientRect();
      return { y: r.top - tb.top, h: r.height };
    };
    cards = cardEls.map((e, i) => ({
      e,
      ...box(e),
      k: CARDS[i].k,
      r: CARDS[i].r,
      s: '',
    }));
    letters = findAll(track, '[data-lt] .ch', HTMLElement).map((e) => {
      const grp = /** @type {HTMLElement} */ (e.closest('[data-lt]'));
      const i = [...grp.querySelectorAll('.ch')].indexOf(e);
      const b = box(e);
      const [h1, h2] = hash(i);
      return {
        e,
        y: b.y + b.h / 2,
        i,
        amp: Number(grp.dataset.lt) * f,
        side: wordEl.contains(e),
        end: voc.contains(e),
        h1,
        h2,
        s: '',
      };
    });
    const logo = oos.find((o) => o.tagName === 'PICTURE');
    if (logo) {
      const b = box(logo);
      logoC = b.y + b.h / 2;
    }
    panels = [pre, voc].map((p) => ({
      y: p.offsetTop,
      h: p.offsetHeight,
      t: TONES[p.dataset.tone ?? 'cream'],
    }));
    toneKey = '';

    const trackH = track.offsetHeight;
    const run = Math.max(0, trackH - H);
    const height = H + run + HOLD;
    const grew = pin.style.height !== `${height}px`;
    pin.style.height = `${height}px`;
    const top = root.getBoundingClientRect().top + window.scrollY;
    const rvTop = (/** @type {Element} */ e) =>
      e.getBoundingClientRect().top + window.scrollY - (reduced ? 0 : 26 * f);
    reveals = findAll(root, '.rv:not(.in)', HTMLElement).map((e) => ({
      e,
      y: rvTop(e),
    }));
    A = {
      active,
      f,
      H,
      vh,
      run,
      top,
      vocY,
      trioY,
      trioTop: trioY,
    };
    lastY = Number.NaN;
    section.start = top;
    section.end = top + root.offsetHeight;
    return grew;
  }

  /** @param {number} y scroll suavizado del documento */
  function render(y) {
    const { f, H, run, top } = A;
    const yr = y - top;
    const r = clamp(yr, 0, run + HOLD);
    const s = Math.min(r, run);
    const ty = -s;
    const vp = clamp((r - run) / HOLD);
    const rm = reduced;

    const t = `translate3d(0,${ty.toFixed(1)}px,0)`;
    if (t !== last.track) {
      last.track = t;
      track.style.transform = t;
    }
    applyTone(s + H / 2, H);

    // Los bordados se cosen puntada a puntada al entrar, y se quedan cosidos.
    for (const o of stitched) {
      if (o.p >= 1) continue;
      const sy = ty + o.y;
      const want = rm ? 1 : sy + o.h <= H ? 1 : clamp((H * 0.92 - sy) / (H * 0.4));
      const p = rm ? want : Math.min(want, o.p + SEW_STEP);
      if (p > o.p) {
        o.p = p;
        o.layer.advance(p);
      }
    }

    // Las tarjetas se adelantan a la palabra y se desvían un poco, sin perder su inclinación.
    for (const c of cards) {
      const cy = ty + c.y + c.h / 2;
      if (cy < -H || cy > 2 * H) continue;
      const d = rm ? 0 : cy - H / 2;
      const v = `translate3d(0,${(d * c.k).toFixed(1)}px,0) rotate(${c.r}deg)`;
      if (v !== c.s) {
        c.s = v;
        c.e.style.transform = v;
      }
    }

    // Las letras llegan por los lados y se dispersan al salir; el título de Vocalistas se junta
    // mientras su panel entra, porque la tira se detiene ahí.
    for (const ch of letters) {
      const cy = ty + ch.y;
      if (cy < -H * 0.6 || cy > H * 1.6) continue;
      const pin_ = rm
        ? 1
        : ch.end
          ? out(clamp((s - (A.vocY - H) - ch.i * 6 * f) / (H * 0.5)))
          : out(clamp((H * 1.1 - cy - ch.i * 8 * f) / (H * 0.5)));
      const pex = rm || ch.end ? 0 : clamp((H * 0.1 - cy) / (H * 0.55));
      const dy =
        (1 - pin_) * ch.amp * (ch.h1 > 0.5 ? 1 : -0.8) * (0.6 + 0.4 * ch.h2) -
        pex * ch.amp * (ch.h2 - 0.5) * 1.4;
      const rot = (1 - pin_) * (ch.h2 - 0.5) * 24 + pex * (ch.h1 - 0.5) * 14;
      const v = ch.side
        ? `translate3d(${dy.toFixed(1)}px,0,0) rotate(${rot.toFixed(1)}deg)`
        : `translate3d(0,${dy.toFixed(1)}px,0) rotate(${rot.toFixed(1)}deg)`;
      if (v !== ch.s) {
        ch.s = v;
        ch.e.style.transform = v;
      }
    }

    // Las "o" ruedan con el scroll; el símbolo también y queda derecho al pasar por el centro.
    oos.forEach((o, i) => {
      const a = rm
        ? 0
        : o.tagName === 'PICTURE'
          ? -(s - (logoC - H / 2)) * 0.2
          : -(s * 0.2) - i * 9;
      const v = `rotate(${a.toFixed(1)}deg)`;
      if (v !== oosS[i]) {
        oosS[i] = v;
        o.style.transform = v;
      }
    });

    // Las tres voces suben a su sitio mientras la tira se detiene.
    const k = rm ? (vp > 0 ? 1 : 0) : out(clamp(vp / 0.8));
    const tv = `translate3d(0,${lerp(H - A.trioTop + 32 * f, 0, k).toFixed(1)}px,0) rotate(${((1 - k) * 4).toFixed(2)}deg)`;
    if (tv !== last.trio) {
      last.trio = tv;
      trioEl.style.transform = tv;
      trioEl.style.opacity = k > 0 ? '1' : '0';
    }
    if (trioImg) {
      const ti = `translate3d(0,${((1 - k) * -30 * f).toFixed(1)}px,0)`;
      if (ti !== last.trioImg) {
        last.trioImg = ti;
        trioImg.style.transform = ti;
      }
    }

    const hv = (1 - clamp(s / 60)).toFixed(3);
    if (hv !== last.hint) {
      last.hint = hv;
      hint.style.opacity = hv;
    }

    // Después de la tira, la página sigue hacia abajo: los retratos aparecen con fundido y subida.
    for (let i = reveals.length - 1; i >= 0; i--) {
      if (reveals[i].y - y < H * 0.9) {
        reveals[i].e.classList.add('in');
        reveals.splice(i, 1);
      }
    }
  }

  /** Mezcla del fondo según el panel bajo el centro (solo toca el DOM cuando cambia el color). */
  function applyTone(/** @type {number} */ tc, /** @type {number} */ H) {
    const mix = stripTone(panels, tc, H);
    const css = mix.map((c) => `rgb(${c.join(',')})`);
    const key = css[0] + css[1];
    if (key === toneKey) return;
    toneKey = key;
    const bg = mix[0];
    const lum = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) / 255;
    const q = clamp((lum - 0.35) / 0.45);
    const st = stage.style;
    st.setProperty('--xo', (0.9 - 0.24 * q).toFixed(2));
    st.setProperty('--gl', `rgba(255,255,255,${(0.035 + 0.365 * q).toFixed(3)})`);
    ['--bg', '--fg', '--fg2', '--acc', '--acc2'].forEach((n, j) => st.setProperty(n, css[j]));
  }

  /** @type {import('../core/engine.js').Section} */
  const section = {
    id: 'preciosooo',
    start: Number.MAX_SAFE_INTEGER,
    end: Number.MAX_SAFE_INTEGER,
    // Los bordados se siguen cosiendo aunque el scroll ya se haya detenido.
    alwaysTick: true,
    measure,
    /** @param {ScrollState} state */
    update(state) {
      if (!A.active) return;
      // La barra del navegador móvil cambia el alto visible sin cambiar el del <body>.
      if (Math.abs(state.vh - A.vh) > 1) {
        measure();
        lastY = Number.NaN;
      }
      if (state.y === lastY && stitched.every((o) => o.p >= 1)) return;
      lastY = state.y;
      render(state.y);
    },
  };
  return section;
}
