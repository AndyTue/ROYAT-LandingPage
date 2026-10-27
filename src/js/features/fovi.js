// @ts-check
import { fill } from '../lib/format.js';
import {
  centered,
  factTopic,
  inZone,
  joinZones,
  LEGS,
  legPose,
  nextLine,
  otherSide,
  placeBubble,
  stayAside,
  stepToward,
} from '../lib/fovi.js';
import { clamp } from '../core/motion.js';

/**
 * @typedef {import('../core/engine.js').ScrollState} ScrollState
 * @typedef {import('../core/events.js').Bus} Bus
 * @typedef {import('../core/layout.js').Metrics} Metrics
 * @typedef {import('../lib/fovi.js').Zone} Zone
 * @typedef {{
 *   generic: string[][],
 *   facts: Record<string, string[]>,
 *   lines: Record<string, string[]>,
 * }} FoviData
 */

/** Lo que cambia entre escritorio y móvil (MOV-9: en móvil mide ~60 % y camina por las orillas). */
const PROFILES = {
  desktop: { scale: 1, edge: 70, gap: 74, ribbon: 800, player: 850, nap: 22000 },
  mobile: { scale: 0.6, edge: 58, gap: 0, ribbon: 0, player: 0, nap: 24000 },
};
const SIZE = { width: 140, height: 108 };
const SVG = 'http://www.w3.org/2000/svg';
const HEART = 'M8 14.2S1 9.7 1 5.1A3.6 3.6 0 0 1 8 3.6a3.6 3.6 0 0 1 7 1.5c0 4.6-7 9.1-7 9.1z';
/** Altura del suelo en móvil sobre el borde inferior: libre el botón del menú y la barra del reproductor (px). */
const MOBILE_GROUND = 76;
const MOBILE_PLAYER = 98;
/** El anuncio a lectores de pantalla es poco frecuente: un dato cada 30 s como máximo. */
const LIVE_EVERY = 30000;

/**
 * Fovi Rodríguez: gato que camina por el borde inferior, duerme, se deja acariciar y cuenta datos
 * de la sección (FOV-1…4). Se mueve solo con `transform`; lo que mide del DOM lo mide en
 * `measure()`, no en el loop.
 * @param {{
 *   root: HTMLElement,
 *   bubble: HTMLElement,
 *   fx: HTMLElement,
 *   live: HTMLElement,
 *   data: FoviData,
 *   bus: Bus,
 *   doc: Document,
 *   getMetrics: () => Metrics,
 *   nowPlaying: () => string | null,
 *   reduced: boolean,
 *   random?: () => number,
 * }} options
 * @returns {import('../core/engine.js').Section}
 */
export function createFovi({
  root,
  bubble,
  fx,
  live,
  data,
  bus,
  doc,
  getMetrics,
  nowPlaying,
  reduced,
  random = Math.random,
}) {
  /** @param {string} selector @param {ParentNode} [scope] */
  const query = (selector, scope = root) =>
    /** @type {HTMLElement} */ (scope.querySelector(selector));
  const inner = query('[data-fovi-in]');
  const tail = query('.fovi__tail');
  const text = query('[data-fovi-text]', bubble);
  const sub = query('[data-fovi-sub]', bubble);
  /** @type {Record<string, HTMLElement>} */
  const legEls = Object.fromEntries(LEGS.map((leg) => [leg.key, query(`.fovi__leg--${leg.key}`)]));
  const html = doc.documentElement;
  const header = /** @type {HTMLElement | null} */ (doc.querySelector('[data-nav]'));

  // Medidas de la página (fuera del loop).
  let vw = 0;
  let heroHeight = 0;
  let contactTop = Infinity;
  let letterTop = Infinity;
  let letterLeft = 0;
  let footerTop = Infinity;
  let footerHeight = 0;

  const f = {
    x: /** @type {number | null} */ (null),
    target: 0,
    mouse: /** @type {number | null} */ (null),
    state: /** @type {'sleep' | 'nap' | 'waking' | 'awake' | 'sit'} */ ('sleep'),
    face: /** @type {1 | -1} */ (-1),
    phase: 0,
    walk: 0,
    last: 0,
    wakeAt: 0,
    lastMove: 0,
    moved: 0,
    hover: false,
    petAcc: 0,
    petLast: 0,
    petUntil: 0,
    pets: 0,
    bubbleUntil: 0,
    bubbleW: 0,
    bubbleH: 0,
    nextAt: 0,
    zAt: 0,
    heartAt: 0,
    greeted: false,
    goBed: false,
    topSince: 0,
    count: 0,
    seen: /** @type {Record<string, number>} */ ({}),
    seenDiscs: false,
    queue: /** @type {string[][]} */ ([]),
    section: '',
    sectionId: 'inicio',
    since: 0,
    sitUntil: 0,
    message: /** @type {string[] | null} */ (null),
    liveAt: 0,
    visible: false,
    introDone: false,
    pressed: false,
    dragged: false,
    px: 0,
    py: 0,
  };

  bus.on('intro:done', () => {
    f.introDone = true;
  });
  bus.on('section:change', ({ id }) => {
    f.sectionId = id;
  });

  // ---------- globo y partículas ----------
  /** @param {string[]} line @param {number} [duration] @param {boolean} [announce] */
  function say([message, extra = ''], duration = 3800, announce = false) {
    text.textContent = message;
    sub.textContent = extra;
    bubble.classList.remove('is-on');
    // Medir una vez por frase (no por frame) reinicia también la animación de aparición.
    f.bubbleW = bubble.offsetWidth;
    f.bubbleH = bubble.offsetHeight;
    bubble.classList.add('is-on');
    f.bubbleUntil = performance.now() + duration;
    const now = performance.now();
    if (announce && now - f.liveAt > LIVE_EVERY) {
      f.liveAt = now;
      live.textContent = message;
    }
  }

  /** @param {'z' | 'heart'} kind @param {number} x @param {number} y */
  function particle(kind, x, y) {
    const el = doc.createElement('span');
    el.className = kind === 'z' ? 'fovi-fx__p fovi-fx__p--z' : 'fovi-fx__p';
    if (kind === 'z') {
      el.textContent = 'z';
      el.style.fontSize = `${22 + random() * 12}px`;
    } else {
      const svg = doc.createElementNS(SVG, 'svg');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '15');
      svg.setAttribute('viewBox', '0 0 16 15');
      const path = doc.createElementNS(SVG, 'path');
      path.setAttribute('d', HEART);
      path.setAttribute('fill', random() < 0.5 ? '#D9312E' : '#E98B1E');
      svg.append(path);
      el.append(svg);
    }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--dx', `${((random() - 0.5) * 34).toFixed(0)}px`);
    fx.append(el);
    setTimeout(() => el.remove(), 2600);
  }

  /** @param {string} key */
  const lines = (key) => data.lines[key] ?? [];

  // ---------- entradas: ratón, dedo y clic ----------
  /** @param {PointerEvent} event */
  function trackMouse(event) {
    if (event.pointerType !== 'mouse' || getMetrics().compact) return;
    const now = performance.now();
    if (f.mouse !== null) f.moved += Math.abs(event.clientX - f.mouse);
    f.mouse = event.clientX;
    f.lastMove = now;
  }
  window.addEventListener('pointermove', trackMouse, { passive: true });

  root.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    f.hover = true;
    if (f.state === 'awake' && performance.now() > f.petUntil && !reduced)
      say(lines('hover'), 3200);
  });
  root.addEventListener('pointerleave', () => {
    f.hover = false;
    f.petAcc = 0;
  });
  root.addEventListener('pointerdown', (event) => {
    f.pressed = true;
    f.dragged = false;
    f.px = event.clientX;
    f.py = event.clientY;
  });
  root.addEventListener('pointermove', (event) => {
    if (reduced) return;
    const now = performance.now();
    const touch = event.pointerType !== 'mouse';
    if (touch && !f.pressed) return;
    if (!touch && f.state !== 'awake') return;
    if (now - f.petLast > 450) f.petAcc = 0;
    f.petLast = now;
    f.petAcc += Math.abs(event.clientX - f.px) + Math.abs(event.clientY - f.py);
    f.px = event.clientX;
    f.py = event.clientY;
    if (touch && f.petAcc > 14) f.dragged = true;
    if (f.petAcc > (touch ? 60 : 140)) {
      if (now > f.petUntil) {
        const list = lines('pet');
        say([list[f.pets % list.length]], 1800);
        f.pets++;
      }
      f.petUntil = now + 1300;
      f.petAcc = touch ? 20 : 60;
    }
  });
  const release = () => {
    f.pressed = false;
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('click', (event) => {
    // Un deslizamiento para acariciar no es un toque: no navega.
    if (f.dragged) {
      event.preventDefault();
      f.dragged = false;
      return;
    }
    say(lines('click'), 2200);
    // El enlace lleva a Contacto; el foco llega cuando termina el desplazamiento (CON-8).
    doc.dispatchEvent(new CustomEvent('contact:prefill', { detail: { delay: reduced ? 0 : 700 } }));
  });

  // ---------- medidas ----------
  function measure() {
    const metrics = getMetrics();
    vw = metrics.vw;
    const block = (/** @type {string} */ id) => metrics.blocks.find((b) => b.id === id);
    heroHeight = block('inicio')?.height ?? metrics.vh;
    contactTop = block('contacto')?.top ?? Infinity;
    const scroll = window.scrollY;
    const letter = doc.querySelector('.letter');
    if (letter) {
      const rect = letter.getBoundingClientRect();
      letterTop = rect.top + scroll;
      letterLeft = rect.left;
    }
    const footer = doc.querySelector('footer');
    if (footer) {
      const rect = footer.getBoundingClientRect();
      footerTop = rect.top + scroll;
      footerHeight = rect.height;
    }
    return false;
  }

  /**
   * ¿Algo de la interfaz pide que Fovi se aparte? (ficha de disco en móvil, menú, tarjeta del
   * mapa). En escritorio se queda sobre la ficha, como en el prototipo.
   * @param {boolean} compact
   */
  const stepsAside = (compact) =>
    (compact && html.classList.contains('detail-open')) ||
    Boolean(header?.classList.contains('nav--open')) ||
    Boolean(doc.querySelector('.mp-card:not([hidden])'));

  /** @param {ScrollState} state */
  function update(state) {
    const metrics = getMetrics();
    const compact = metrics.compact;
    const profile = compact ? PROFILES.mobile : PROFILES.desktop;
    const W = vw || metrics.vw;
    const H = state.vh;
    const y = state.y;
    const now = state.now;
    const dt = Math.min(0.05, f.last ? (now - f.last) / 1000 : 0);
    f.last = now;
    const K = profile.scale;

    // ¿Se ve? Entra al terminar la intro; en móvil, pasando el Hero y antes de la carta.
    const hasPlayer = html.classList.contains('has-player');
    const groundY = compact ? H - (hasPlayer ? MOBILE_PLAYER : MOBILE_GROUND) : H;
    const visible =
      f.introDone &&
      !stepsAside(compact) &&
      (!compact || (y > heroHeight * 0.55 && y + H * 0.7 < letterTop));
    if (visible !== f.visible) {
      f.visible = visible;
      root.classList.toggle('is-on', visible);
      if (!visible) bubble.classList.remove('is-on');
    }
    if (f.x === null) {
      f.x = compact ? W - profile.edge : Math.round(W * 0.3);
      f.face = -1;
    }
    if (!visible) {
      f.since = now;
      return;
    }

    // Zonas que no pisa en escritorio: listón inferior, reproductor y carta (FOV-2).
    /** @type {Zone[]} */
    const zones = [];
    if (!compact) {
      const topNav = f.sectionId === 'discografia' || f.sectionId === 'contacto';
      const ribbonReady = Boolean(header?.classList.contains('nav--ready'));
      if (hasPlayer) zones.push(centered(W, profile.player));
      if (ribbonReady && !topNav) zones.push(centered(W, profile.ribbon));
      if (y >= contactTop - H * 0.6) zones.push({ left: letterLeft, right: W + 300 });
    }
    const zone = joinZones(zones);
    const frame = { gap: profile.gap, margin: profile.edge, width: W };
    const aside = (/** @type {number} */ x) => (compact ? x : stayAside(x, zone, frame));
    const bed = aside(Math.round(W * 0.3));

    let bob = 0;
    let rot = 0;
    let sx = 1;
    let sy = 1;
    let tailAngle = 0;
    let walking = false;
    let x = f.x;
    const sleeping = f.state === 'sleep' || f.state === 'nap';

    if (reduced) {
      // Con reduced-motion Fovi duerme quieto en su esquina (FOV-4).
      f.state = 'sleep';
      x = f.x = compact ? W - profile.edge : bed;
    } else if (compact) {
      // Móvil: cada sección nueva lo despierta; cruza a la otra orilla y cuenta un dato.
      const inContact = f.sectionId === 'contacto';
      const topic = factTopic(f.sectionId);
      if (topic !== f.section || (f.state === 'sleep' && now - f.since > profile.nap)) {
        const first = !f.section;
        f.section = topic;
        f.since = now;
        if (f.state === 'sleep' || f.state === 'sit') {
          f.state = 'waking';
          f.wakeAt = now;
        }
        f.target = inContact ? profile.edge : otherSide(x, W, profile.edge);
        f.message = first ? lines('greetingTouch') : null;
      }
      if (now < f.petUntil && f.state === 'sleep') {
        f.state = 'waking';
        f.wakeAt = now;
        f.target = x;
      }
      if (f.state === 'waking') {
        const k = (now - f.wakeAt) / 900;
        ({ sx, sy, bob } = wakePose(k, 8));
        root.classList.toggle('is-awake', k >= 0.45);
        if (k >= 1) {
          f.state = 'awake';
        }
      } else if (f.state === 'sleep') {
        root.classList.remove('is-awake');
        sy = 1 + 0.02 * Math.sin(now / 700);
        if (now > f.zAt) {
          f.zAt = now + 1700;
          particle('z', x + (f.face > 0 ? 14 : -22), groundY - 46);
        }
      } else {
        root.classList.add('is-awake');
        const dx = f.target - x;
        if (f.state === 'awake' && Math.abs(dx) > 3) {
          walking = true;
          f.face = dx > 0 ? 1 : -1;
          const speed = 95;
          x = f.x = stepToward(x, f.target, speed, dt);
          f.phase += (dt * Math.PI * 2 * speed) / 34;
          bob = -Math.abs(Math.sin(f.phase)) * 1.6;
          rot = Math.sin(f.phase * 2) * 0.9;
          tailAngle = Math.sin(f.phase * 0.5) * 8;
        } else {
          if (f.state === 'awake') {
            // Llegó: se sienta y dice algo.
            f.state = 'sit';
            f.sitUntil = now + 5600;
            f.face = x > W / 2 ? -1 : 1;
            const spoken = f.message ?? chooseLine(topic);
            f.message = null;
            say(spoken, 4600, true);
          }
          sy = 1 + 0.012 * Math.sin(now / 650);
          tailAngle = now < f.petUntil ? Math.sin(now / 80) * 13 : Math.sin(now / 520) * 6;
          if (now < f.petUntil) {
            rot = -4 * f.face;
            f.sitUntil = Math.max(f.sitUntil, now + 2500);
            hearts(x, groundY - 70, 40);
          }
          if (f.state === 'sit' && now > f.sitUntil && now > f.bubbleUntil) {
            f.state = 'sleep';
            f.since = now;
          }
        }
      }
    } else {
      // Escritorio: despierta con el primer scroll, sigue el cursor y se duerme si lo dejan solo.
      if (f.state === 'sleep' && y > 60) {
        f.state = 'waking';
        f.wakeAt = now;
      }
      if (f.state === 'nap' && ((now - f.lastMove < 300 && f.moved > 60) || inZone(x, zone, 50))) {
        f.state = 'waking';
        f.wakeAt = now;
        f.moved = 0;
      }
      if (f.state === 'awake') {
        if (y < 15) {
          if (!f.topSince) f.topSince = now;
          if (now - f.topSince > 2500) f.goBed = true;
        } else {
          f.topSince = 0;
          f.goBed = false;
        }
        const idle = now - f.lastMove > profile.nap && now > f.bubbleUntil;
        if (!f.goBed && !f.hover && idle && Math.abs(x - f.target) < 8) {
          f.state = 'nap';
          f.moved = 0;
        }
      }
      if (f.state === 'waking') {
        const k = (now - f.wakeAt) / 1100;
        ({ sx, sy, bob } = wakePose(k, 12));
        root.classList.toggle('is-awake', k >= 0.45);
        if (k >= 1) {
          f.state = 'awake';
          f.lastMove = now;
          if (!f.greeted) {
            f.greeted = true;
            say(lines('greeting'), 2600);
            f.queue = [lines('followUp')];
            f.nextAt = now + 2700;
          } else {
            say(lines('wake'), 2600);
            f.nextAt = now + 9000;
          }
        }
      } else if (sleeping) {
        // Si el listón o el reproductor le caen encima, se muda a su cama de al lado.
        if (f.state === 'sleep' && inZone(x, zone, 50)) x = f.x = bed;
        root.classList.remove('is-awake');
        sy = 1 + 0.02 * Math.sin(now / 700);
        if (now > f.zAt) {
          f.zAt = now + 1500;
          particle('z', x + (f.face > 0 ? 1 : -1) * 40, H - 76);
        }
      } else {
        root.classList.add('is-awake');
        // Se pone bajo el cursor, pero nunca detrás del listón ni del reproductor.
        let target = f.goBed ? bed : (f.mouse ?? x);
        target = aside(clamp(target, profile.edge, W - profile.edge));
        if (f.hover || now < f.petUntil) target = x;
        f.target = target;
        const dx = target - x;
        if (Math.abs(dx) > 6) {
          walking = true;
          f.face = dx > 0 ? 1 : -1;
          const speed = Math.abs(dx) > 380 ? 230 : 130;
          const stride = speed > 200 ? 80 : 54;
          x = f.x = stepToward(x, target, speed, dt);
          f.phase += (dt * Math.PI * 2 * speed) / stride;
          bob = -Math.abs(Math.sin(f.phase)) * 2.6;
          rot = Math.sin(f.phase * 2) * 0.9;
          tailAngle = Math.sin(f.phase * 0.5) * 8;
        } else {
          sy = 1 + 0.012 * Math.sin(now / 650);
          tailAngle = now < f.petUntil ? Math.sin(now / 80) * 13 : Math.sin(now / 520) * 6;
          if (f.goBed && Math.abs(x - bed) < 8) {
            f.state = 'sleep';
            f.goBed = false;
            f.topSince = 0;
            f.face = -1;
          } else if (f.mouse !== null && Math.abs(f.mouse - x) > 30 && !f.hover) {
            f.face = f.mouse > x ? 1 : -1;
          }
        }
        if (now < f.petUntil) {
          rot = -4 * f.face;
          hearts(x, H - 108, 50);
        }
        // Frases: saludo, luego un dato de la sección o una suelta, nunca encima de una zona.
        const crossing = inZone(x, zone, 62);
        if (f.sectionId === 'discografia' && !f.seenDiscs && !crossing) {
          f.seenDiscs = true;
          if (now > f.bubbleUntil) {
            say(lines('discs'), 3600);
            f.nextAt = now + 12000;
          }
        }
        if (!f.hover && !crossing && now >= f.nextAt && now > f.bubbleUntil + 300) {
          const queued = f.queue.shift();
          if (queued) {
            say(queued, 2300);
            f.nextAt = now + 9000;
          } else {
            say(chooseLine(factTopic(f.sectionId)), 4200, true);
            f.nextAt = now + 12000 + random() * 5000;
          }
        }
      }
    }

    // Se apoya en el borde inferior; en escritorio sube con el pie de página.
    const footerLift = compact ? 0 : clamp(y + H - footerTop, 0, footerHeight);
    const ground = groundY;
    const lift =
      (f.state === 'sleep' || f.state === 'nap' ? (compact ? 4 : 11) : compact ? 0 : 3) +
      footerLift;
    f.walk += ((walking ? 1 : 0) - f.walk) * Math.min(1, dt * 9);
    for (const leg of LEGS) {
      const pose = legPose(leg, f.phase, f.walk);
      legEls[leg.key].style.transform =
        `translate3d(0,${pose.y.toFixed(2)}px,0) rotate(${pose.deg.toFixed(2)}deg)`;
    }
    const top = ground - SIZE.height - lift + bob;
    root.style.transform = `translate3d(${(x - SIZE.width / 2).toFixed(1)}px,${top.toFixed(1)}px,0)`;
    inner.style.transform = `scale(${((f.face > 0 ? -sx : sx) * K).toFixed(3)},${(sy * K).toFixed(3)}) rotate(${rot.toFixed(2)}deg)`;
    tail.style.transform = `rotate(${tailAngle.toFixed(2)}deg)`;

    // El globo lo sigue; se quita si estorba a una zona.
    if (bubble.classList.contains('is-on')) {
      if (now > f.bubbleUntil || (zone && inZone(x, zone, 62))) {
        bubble.classList.remove('is-on');
      } else {
        placeBubbleAt(x, top, compact, W, zone);
      }
    }
  }

  /** @param {number} k @param {number} jump */
  function wakePose(k, jump) {
    let sx = 1;
    let sy = 1;
    let bob = 0;
    if (k < 0.45) {
      const q = Math.sin((Math.PI * k) / 0.45);
      sx = 1 + 0.14 * q;
      sy = 1 - 0.09 * q;
    } else {
      bob = -jump * Math.sin(Math.PI * Math.min(1, (k - 0.45) / 0.55));
    }
    return { sx, sy, bob };
  }

  /** @param {number} x @param {number} y @param {number} spread */
  function hearts(x, y, spread) {
    const now = performance.now();
    if (now <= f.heartAt) return;
    f.heartAt = now + 240;
    particle('heart', x + (random() - 0.5) * spread, y);
  }

  /** @param {string} topic @returns {string[]} */
  function chooseLine(topic) {
    const playing = nowPlaying();
    if (playing && random() < 0.5) {
      const [first, second] = lines('playing');
      return [first, fill(second, { title: playing })];
    }
    const pair = nextLine(data, { topic, count: f.count, seen: f.seen });
    f.count++;
    return pair;
  }

  /**
   * @param {number} x @param {number} catTop @param {boolean} compact @param {number} W
   * @param {Zone | null} zone
   */
  function placeBubbleAt(x, catTop, compact, W, zone) {
    const bw = f.bubbleW;
    const bh = f.bubbleH;
    const awake = root.classList.contains('is-awake');
    let left;
    let top;
    if (compact) {
      left = clamp(x - bw / 2 + f.face * 10, 8, Math.max(8, W - bw - 8));
      top = catTop + (awake ? 42 : 68) - bh - 10;
      bubble.style.setProperty('--tx', `${clamp(x - left, 14, bw - 14).toFixed(0)}px`);
      bubble.classList.remove('is-left', 'is-right');
    } else {
      const spot = placeBubble({ x, face: f.face, width: W, bw, zone });
      if (spot.mode === 'u') {
        left = clamp(x - bw / 2 + f.face * 24, 8, Math.max(8, W - bw - 8));
        top = Math.max(8, catTop + (awake ? 6 : 44) - bh - 12);
        bubble.style.setProperty(
          '--tx',
          `${clamp(x + f.face * 36 - left, 18, bw - 18).toFixed(0)}px`,
        );
      } else {
        left = clamp(spot.mode === 'r' ? spot.right : spot.left, 8, Math.max(8, W - bw - 8));
        top = Math.max(8, catTop + (awake ? 66 : 96) - bh);
        bubble.style.setProperty(
          '--ty',
          `${clamp(catTop + (awake ? 40 : 84) - top, 16, bh - 16).toFixed(0)}px`,
        );
      }
      bubble.classList.toggle('is-right', spot.mode === 'r');
      bubble.classList.toggle('is-left', spot.mode === 'l');
    }
    bubble.style.transform = `translate3d(${left.toFixed(1)}px,${top.toFixed(1)}px,0)`;
  }

  return { id: 'fovi', start: 0, end: Number.MAX_SAFE_INTEGER, alwaysTick: true, update, measure };
}
