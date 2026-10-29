// @ts-check
import { find, findAll } from '../lib/dom.js';
import { drawLeg, setupCanvas, shade } from '../stitch/renderer.js';
import {
  buildGrid,
  cellAt,
  cellsByPlace,
  countByState,
  countLabel,
  labelPercent,
  placeNear,
  revealedAt,
  revealOrder,
  threadColor,
  tipTexts,
} from './map-math.js';

/**
 * @typedef {import('../core/engine.js').ScrollState} ScrollState
 * @typedef {import('../core/layout.js').Metrics} Metrics
 * @typedef {import('./map-math.js').Place} Place
 * @typedef {import('./map-math.js').MapGrid} MapGrid
 */

/** Municipios con nombre fijo sobre el mapa (MAP-3); el primero es la cuna de la ROYAT. */
const LABELED = [
  'Tizimín',
  'Mérida',
  'Valladolid',
  'Benito Juárez',
  'Bacalar',
  'Calkiní',
  'Felipe Carrillo Puerto',
];
const LAND = '#EFE5CC';
const FLOWER = {
  rows: ['.e.e.', 'eejee', '.jkj.', 'eejee', '.e.e.'],
  colors: { e: '#2E9BD6', j: '#F6CD1F', k: '#FBF7EE' },
};

/**
 * Mapa de Presencia (MAP-1…6): la península bordada en capas (tierra, municipios con
 * presencia y resalte) que se va cosiendo con el scroll; tooltip con el cursor, tarjeta con
 * el toque, filtros por estado y clic hacia el formulario de Contacto.
 * @param {{
 *   root: HTMLElement,
 *   grid: MapGrid,
 *   places: Place[],
 *   states: string[],
 *   text: Record<string, string>,
 *   getMetrics: () => Metrics,
 *   reduced: boolean,
 * }} options
 * @returns {import('../core/engine.js').Section & { yFor: (id: string) => number | null }}
 */
export function createMap({ root, grid: data, places, states, text, getMetrics, reduced }) {
  const stage = find(root, '[data-presence-stage]', HTMLElement);
  const mapEl = find(root, '[data-map]', HTMLElement);
  const layers = {
    base: find(mapEl, '[data-map-canvas="base"]', HTMLCanvasElement),
    pres: find(mapEl, '[data-map-canvas="pres"]', HTMLCanvasElement),
    hi: find(mapEl, '[data-map-canvas="hi"]', HTMLCanvasElement),
  };
  const tip = find(root, '[data-map-tip]', HTMLElement);
  const card = find(root, '[data-map-card]', HTMLElement);
  const buttons = findAll(root, '[data-filter]', HTMLButtonElement);

  const { W, H, S } = data;
  const grid = buildGrid(data.rows, W);
  const cells = cellsByPlace(grid, places.length);
  const order = revealOrder(places);
  const cradle = places.findIndex((p) => p.municipio === 'Tizimín');
  const ctx = {
    base: setupCanvas(layers.base, W, H, S, window.devicePixelRatio),
    pres: setupCanvas(layers.pres, W, H, S, window.devicePixelRatio),
    hi: setupCanvas(layers.hi, W, H, S, window.devicePixelRatio),
  };
  // setupCanvas fija el tamaño en px; el mapa es fluido y escala con su contenedor.
  for (const canvas of Object.values(layers)) {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }
  const on = new Uint8Array(places.length);
  /** @type {{ id: number, el: HTMLElement }[]} */
  const labels = [];
  let revealed = -1;
  let filter = -1;
  let hover = -1;
  let selected = -1;
  let pinned = false;
  let touchLast = false;

  const stateIndex = (/** @type {Place} */ p) => states.indexOf(p.state);
  const colorOf = (/** @type {Place} */ p) => threadColor(p, states, data.palette);

  /** Una celda bordada: las dos patas de la X, la de arriba un poco más clara. */
  function stitchCell(
    /** @type {CanvasRenderingContext2D} */ c,
    /** @type {number} */ k,
    /** @type {string} */ color,
    lift = 0,
  ) {
    const x = (k % W) * S;
    const y = Math.floor(k / W) * S;
    const pad = S * 0.16;
    drawLeg(c, x + pad, y + S - pad, x + S - pad, y + pad, shade(color, lift - 0.05), S);
    drawLeg(c, x + pad, y + pad, x + S - pad, y + S - pad, shade(color, lift + 0.05), S);
  }

  /** La tierra en hilo pálido y las líneas de estado con pespunte (se dibuja una sola vez). */
  function drawLand() {
    const c = ctx.base;
    const pad = S * 0.16;
    c.globalAlpha = 0.24;
    c.strokeStyle = LAND;
    c.lineWidth = S * 0.36;
    c.beginPath();
    grid.forEach((id, k) => {
      if (id < 0) return;
      const x = (k % W) * S;
      const y = Math.floor(k / W) * S;
      c.moveTo(x + pad, y + S - pad);
      c.lineTo(x + S - pad, y + pad);
      c.moveTo(x + pad, y + pad);
      c.lineTo(x + S - pad, y + S - pad);
    });
    c.stroke();
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(241,238,231,.55)';
    c.lineWidth = 1.3;
    c.setLineDash([3, 2.5]);
    c.beginPath();
    const stateOf = (/** @type {number} */ k) => places[grid[k]].state;
    grid.forEach((id, k) => {
      if (id < 0) return;
      const i = k % W;
      const j = Math.floor(k / W);
      const x = i * S;
      const y = j * S;
      if (i < W - 1 && grid[k + 1] >= 0 && stateOf(k + 1) !== stateOf(k)) {
        c.moveTo(x + S, y);
        c.lineTo(x + S, y + S);
      }
      if (j < H - 1 && grid[k + W] >= 0 && stateOf(k + W) !== stateOf(k)) {
        c.moveTo(x, y + S);
        c.lineTo(x + S, y + S);
      }
    });
    c.stroke();
    c.setLineDash([]);
  }

  /** Nombres fijos: estados y algunos municipios (aparecen al coserse). */
  function createLabels() {
    for (const [key, name] of /** @type {const} */ ([
      ['yuc', 0],
      ['qroo', 1],
      ['camp', 2],
    ])) {
      const pos = data.lab[key];
      if (!pos) continue;
      const el = document.createElement('span');
      el.className = `mp-state mp-state--${key}`;
      el.textContent = states[name];
      const { left, top } = labelPercent(pos, data);
      el.style.left = `${left}%`;
      el.style.top = `${top}%`;
      mapEl.append(el);
    }
    for (const name of LABELED) {
      const place = places.find((p) => p.municipio === name);
      if (!place) continue;
      const el = document.createElement('span');
      el.className = `mp-lab${place.i === cradle ? ' mp-lab--cradle' : ''}`;
      el.append(place.label);
      if (place.i === cradle) {
        const small = document.createElement('small');
        small.textContent = text.cradle;
        el.append(' ', small);
      }
      const { left, top } = labelPercent(place.labelPos, data);
      el.style.left = `${left}%`;
      el.style.top = `${top}%`;
      mapEl.append(el);
      labels.push({ id: place.i, el });
    }
  }

  /** @param {number} from primer municipio a dibujar (0 = todo) */
  function drawPresence(from) {
    const c = ctx.pres;
    if (from === 0) c.clearRect(0, 0, W * S, H * S);
    const dim = (/** @type {Place} */ p) => (filter < 0 || filter === stateIndex(p) ? 1 : 0.2);
    for (let n = from; n < revealed; n++) {
      const place = places[order[n]];
      on[place.i] = 1;
      c.globalAlpha = dim(place);
      for (const k of cells[place.i]) stitchCell(c, k, colorOf(place));
    }
    c.globalAlpha = 1;
    // Pespunte entre pueblos vecinos: solo los bordes de los municipios nuevos.
    c.strokeStyle = 'rgba(16,24,48,.7)';
    c.lineWidth = 1.2;
    c.beginPath();
    for (let n = from; n < revealed; n++) {
      for (const k of cells[order[n]]) {
        const i = k % W;
        const x = i * S;
        const y = Math.floor(k / W) * S;
        const me = grid[k];
        if (i < W - 1 && grid[k + 1] >= 0 && grid[k + 1] !== me) {
          c.moveTo(x + S, y);
          c.lineTo(x + S, y + S);
        }
        if (i > 0 && grid[k - 1] >= 0 && grid[k - 1] !== me && !on[grid[k - 1]]) {
          c.moveTo(x, y);
          c.lineTo(x, y + S);
        }
        if (k + W < grid.length && grid[k + W] >= 0 && grid[k + W] !== me) {
          c.moveTo(x, y + S);
          c.lineTo(x + S, y + S);
        }
        if (k - W >= 0 && grid[k - W] >= 0 && grid[k - W] !== me && !on[grid[k - W]]) {
          c.moveTo(x, y);
          c.lineTo(x + S, y);
        }
      }
    }
    c.stroke();
    if (on[cradle]) {
      // Tizimín lleva una florecita.
      const [lx, ly] = places[cradle].labelPos;
      const ci = Math.round(lx / S - 0.5);
      const cj = Math.round(ly / S - 0.5);
      FLOWER.rows.forEach((row, dj) =>
        [...row].forEach((ch, di) => {
          if (ch !== '.')
            stitchCell(
              c,
              (cj + dj - 2) * W + (ci + di - 2),
              FLOWER.colors[/** @type {'e' | 'j' | 'k'} */ (ch)],
            );
        }),
      );
    }
    for (const label of labels) label.el.classList.toggle('on', Boolean(on[label.id]));
  }

  /** El municipio resaltado (bajo el cursor o tocado) con un contorno blanco. */
  function drawHighlight() {
    const c = ctx.hi;
    c.clearRect(0, 0, W * S, H * S);
    const id = selected >= 0 ? selected : hover;
    if (id < 0) return;
    const place = places[id];
    const shown = place.presence && on[id] === 1;
    for (const k of cells[id]) stitchCell(c, k, shown ? colorOf(place) : LAND, shown ? 0.3 : 0);
    c.strokeStyle = '#FBF7EE';
    c.lineWidth = 2;
    c.setLineDash(shown ? [] : [3, 2.5]);
    c.beginPath();
    for (const k of cells[id]) {
      const x = (k % W) * S;
      const y = Math.floor(k / W) * S;
      if (k % W === W - 1 || grid[k + 1] !== id) {
        c.moveTo(x + S, y);
        c.lineTo(x + S, y + S);
      }
      if (k % W === 0 || grid[k - 1] !== id) {
        c.moveTo(x, y);
        c.lineTo(x, y + S);
      }
      if (grid[k + W] !== id) {
        c.moveTo(x, y + S);
        c.lineTo(x + S, y + S);
      }
      if (k - W < 0 || grid[k - W] !== id) {
        c.moveTo(x, y);
        c.lineTo(x + S, y);
      }
    }
    c.stroke();
    c.setLineDash([]);
  }

  function updateCounters() {
    const counts = countByState(places, order, revealed, states);
    for (const button of buttons) {
      const index = Number(button.dataset.filter);
      const cap = button.dataset.cap ? Number(button.dataset.cap) : undefined;
      const number = find(button, '[data-count]', HTMLElement);
      number.textContent = countLabel(counts[index], cap);
    }
  }

  /** @param {number} next */
  function reveal(next) {
    const total = order.length;
    const target = Math.min(total, Math.max(0, next));
    if (target === revealed) return;
    const from = target > revealed && revealed >= 0 ? revealed : 0;
    if (from === 0) on.fill(0);
    revealed = target;
    drawPresence(from);
    updateCounters();
    if (hover >= 0 || selected >= 0) drawHighlight();
  }

  /**
   * @param {number} id
   * @param {boolean} touch
   */
  function fillTexts(id, touch) {
    const place = places[id];
    return tipTexts({ place, shown: on[id] === 1, isCradle: id === cradle, touch, text });
  }

  /** @param {number} id @param {PointerEvent | MouseEvent} event */
  function showTip(id, event) {
    const texts = fillTexts(id, false);
    find(tip, 'b', HTMLElement).textContent = texts.title;
    find(tip, 'small', HTMLElement).textContent = texts.sub;
    find(tip, 'span', HTMLElement).textContent = texts.body;
    tip.classList.add('on');
    const stageRect = stage.getBoundingClientRect();
    let x = event.clientX - stageRect.left + 18;
    let y = event.clientY - stageRect.top + 18;
    if (x + tip.offsetWidth > stageRect.width - 16) x -= tip.offsetWidth + 36;
    if (y + tip.offsetHeight > stageRect.height - 70) y -= tip.offsetHeight + 36;
    tip.style.transform = `translate3d(${x.toFixed(0)}px, ${y.toFixed(0)}px, 0)`;
  }

  function closeCard() {
    selected = -1;
    card.hidden = true;
    drawHighlight();
  }

  /** @param {number} id */
  function goToContact(id) {
    const place = places[id];
    const target = document.getElementById('contacto');
    target?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    document.dispatchEvent(
      new CustomEvent('contact:prefill', {
        detail: { municipality: place.municipio, state: place.state, delay: reduced ? 0 : 1100 },
      }),
    );
  }

  /** @param {PointerEvent | MouseEvent} event */
  function cellFromEvent(event) {
    return cellAt(event.clientX, event.clientY, mapEl.getBoundingClientRect(), W, H);
  }

  mapEl.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const cell = cellFromEvent(event);
    const id = cell ? grid[cell.j * W + cell.i] : -1;
    if (id !== hover) {
      hover = id;
      mapEl.classList.toggle('is-over', id >= 0);
      drawHighlight();
      if (id < 0) tip.classList.remove('on');
    }
    if (id >= 0) showTip(id, event);
  });
  mapEl.addEventListener('pointerleave', () => {
    hover = -1;
    mapEl.classList.remove('is-over');
    tip.classList.remove('on');
    drawHighlight();
  });
  mapEl.addEventListener('pointerdown', (event) => {
    touchLast = event.pointerType !== 'mouse';
  });
  mapEl.addEventListener('click', (event) => {
    const cell = cellFromEvent(event);
    if (!touchLast) {
      if (hover >= 0) goToContact(hover);
      return;
    }
    // Con el dedo: el primer toque elige el pueblo y abre su tarjeta; no navega.
    const id = cell ? placeNear(grid, W, H, cell, 3) : -1;
    if (id < 0) return closeCard();
    selected = id;
    const texts = fillTexts(id, true);
    find(card, '[data-card-title]', HTMLElement).textContent = texts.title;
    find(card, '[data-card-sub]', HTMLElement).textContent = texts.sub;
    find(card, '[data-card-body]', HTMLElement).textContent = texts.body;
    find(card, '[data-card-go]', HTMLElement).firstChild?.replaceWith(texts.button);
    card.hidden = false;
    drawHighlight();
  });
  find(card, '[data-card-close]', HTMLElement).addEventListener('click', closeCard);
  find(card, '[data-card-go]', HTMLElement).addEventListener('click', () => {
    if (selected >= 0) goToContact(selected);
    closeCard();
  });
  document.addEventListener('click', (event) => {
    if (selected < 0 || !(event.target instanceof Node)) return;
    if (!card.contains(event.target) && !mapEl.contains(event.target)) closeCard();
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && selected >= 0) closeCard();
  });

  for (const button of buttons) {
    button.disabled = false;
    button.addEventListener('click', () => {
      const index = Number(button.dataset.filter);
      filter = filter === index ? -1 : index;
      for (const other of buttons)
        other.setAttribute('aria-pressed', String(Number(other.dataset.filter) === filter));
      if (filter < 0) root.removeAttribute('data-f');
      else root.setAttribute('data-f', String(filter));
      const current = revealed;
      revealed = -1;
      on.fill(0);
      reveal(current);
    });
  }

  drawLand();
  createLabels();
  root.classList.add('presence--live');

  const section = {
    id: 'presencia',
    start: 0,
    end: 0,
    /** Fija la sección si su contenido cabe en una pantalla; si no, queda en el flujo normal. */
    measure() {
      const block = getMetrics().blocks.find((b) => b.id === 'presencia');
      const before = pinned;
      root.classList.toggle('presence--pinned', !reduced);
      pinned = !reduced && stage.scrollHeight <= stage.clientHeight + 1;
      root.classList.toggle('presence--pinned', pinned);
      section.start = block?.top ?? 0;
      section.end = block?.bottom ?? 0;
      return before !== pinned;
    },
    /**
     * Scroll de destino para la navegación: donde el mapa ya está bordado completo, con todos
     * los lugares y los datos a la vista (al final de la pantalla fija).
     * @param {string} id
     * @returns {number | null}
     */
    yFor(id) {
      if (id !== 'presencia') return null;
      const { vh } = getMetrics();
      const span = Math.max(1, section.end - section.start);
      if (pinned) return section.start + Math.max(1, span - vh);
      // Sin pantalla fija se borda al entrar: se llega al punto donde ya está completo.
      return Math.min(section.start - vh * 0.3 + span * 0.72, section.end - vh);
    },
    /** @param {ScrollState} state */
    update(state) {
      if (reduced) return reveal(order.length);
      const { vh } = getMetrics();
      const run = Math.max(1, section.end - section.start - vh);
      const total = order.length;
      if (pinned) reveal(revealedAt({ y: state.y, start: section.start, run, vh, total }));
      else {
        // Sin pantalla fija: se borda según la sección entra a la vista.
        const span = Math.max(1, section.end - section.start);
        reveal(revealedAt({ y: state.y, start: section.start - vh * 0.3, run: span, vh, total }));
      }
    },
  };
  return section;
}
