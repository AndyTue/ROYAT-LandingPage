// @ts-check
// Un solo reloj (ARCHITECTURE §4): un rAF que lee el scroll una vez por frame, lo suaviza y se
// lo reparte a las secciones visibles. Nadie más crea un loop ni lee layout dentro del loop.
import { smooth } from './motion.js';

/**
 * @typedef {{
 *   y: number,
 *   target: number,
 *   velocity: number,
 *   direction: -1 | 0 | 1,
 *   vh: number,
 *   now: number,
 *   dt: number,
 *   reduced: boolean,
 * }} ScrollState `y` es el scroll suavizado; `target`, el real.
 * @typedef {{
 *   id: string,
 *   start: number,
 *   end: number,
 *   margin?: number,
 *   alwaysTick?: boolean,
 *   update(state: ScrollState): void,
 *   measure?(): boolean | void,
 *   destroy?(): void,
 * }} Section `start` y `end` son posiciones absolutas medidas fuera del loop. Con
 *   `measure` devuelve `true` si cambió el layout de la página (p. ej. activó una pista
 *   horizontal) y hay que volver a medir todo. Con `alwaysTick` la sección recibe cada frame mientras es visible, aunque no haya scroll
 *   (animaciones por tiempo, como la intro).
 * @typedef {{
 *   read: () => number,
 *   viewport: () => number,
 *   schedule: (callback: (now: number) => void) => number,
 *   cancel: (handle: number) => void,
 *   reduced?: boolean,
 *   factor?: number,
 * }} EngineOptions
 */

/** Suavizado del scroll por frame (DESIGN-TOKENS). */
const LERP = 0.12;

/**
 * @param {EngineOptions} options dependencias inyectadas (el navegador las da en `main.js`)
 */
export function createEngine({ read, viewport, schedule, cancel, reduced = false, factor }) {
  // Con reduced-motion no hay suavizado: el scroll se aplica tal cual.
  const step = reduced ? 1 : (factor ?? LERP);
  /** @type {Map<string, Section>} */
  const sections = new Map();
  /** @type {Set<(state: ScrollState) => void>} */
  const watchers = new Set();
  /** @type {ScrollState} */
  const state = {
    y: 0,
    target: 0,
    velocity: 0,
    direction: 0,
    vh: 0,
    now: 0,
    dt: 0,
    reduced,
  };
  let handle = 0;
  let running = false;
  let last = 0;
  let forceNext = true;

  /** @param {Section} section */
  const isVisible = (section) => {
    const margin = section.margin ?? state.vh;
    return state.y + state.vh > section.start - margin && state.y < section.end + margin;
  };

  /** @param {number} now */
  function tick(now) {
    const previous = state.y;
    state.target = read();
    state.vh = viewport();
    state.y = smooth(state.y, state.target, step);
    state.dt = last ? now - last : 0;
    state.now = now;
    last = now;
    state.velocity = state.y - previous;
    state.direction = state.velocity > 0 ? 1 : state.velocity < 0 ? -1 : 0;

    // Sin movimiento no hay nada que repartir, salvo en el primer frame o tras un `invalidate`.
    const moved = forceNext || state.velocity !== 0 || state.y !== state.target;
    for (const watcher of watchers) watcher(state);
    for (const section of sections.values()) {
      if ((moved || section.alwaysTick) && isVisible(section)) section.update(state);
    }
    forceNext = false;
    if (running) handle = schedule(tick);
  }

  return {
    state,
    /** @param {Section} section */
    add(section) {
      sections.set(section.id, section);
      forceNext = true;
    },
    /** @param {string} id */
    remove(id) {
      sections.get(id)?.destroy?.();
      sections.delete(id);
    },
    /**
     * Observa el estado en cada frame (p. ej. la sección activa de la navegación).
     * @param {(state: ScrollState) => void} callback
     */
    watch(callback) {
      watchers.add(callback);
      return () => watchers.delete(callback);
    },
    /**
     * Vuelve a medir todas las secciones (cambió el tamaño o llegaron las fuentes).
     * @returns {boolean} `true` si alguna sección cambió el layout y conviene medir otra vez
     */
    measure() {
      let again = false;
      for (const section of sections.values()) if (section.measure?.() === true) again = true;
      forceNext = true;
      return again;
    },
    /** Fuerza que el siguiente frame reparta el estado aunque no haya scroll. */
    invalidate() {
      forceNext = true;
    },
    /** Salta al scroll real sin suavizado (anclas y primer frame). */
    snap() {
      state.y = state.target = read();
      forceNext = true;
    },
    start() {
      if (running) return;
      running = true;
      last = 0;
      handle = schedule(tick);
    },
    stop() {
      running = false;
      cancel(handle);
    },
    /** Un frame manual (pruebas y reduced-motion). */
    tick,
  };
}
