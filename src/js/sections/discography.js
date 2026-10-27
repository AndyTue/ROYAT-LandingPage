// @ts-check
import { find, findAll } from '../lib/dom.js';
import { fill, formatDuration, pad2 } from '../lib/format.js';
import {
  arcSlot,
  discPose,
  discSeconds,
  guestCount,
  minutesLabel,
  ringOffset,
  wrapIndex,
} from '../lib/disc.js';

/**
 * @typedef {import('../core/engine.js').ScrollState} ScrollState
 * @typedef {import('../core/layout.js').Metrics} Metrics
 * @typedef {import('../lib/disc.js').Disc} Disc
 * @typedef {import('../features/player.js').PlayerState} PlayerState
 */

/** Avance automático: un disco cada 3.8 s sin tocar nada; 6 s de pausa tras un cambio a mano. */
const EVERY = 3.8;
const PAUSE = 6;
/** Scroll que gira un disco dentro de la sección fija (px a U = 1). */
const DSTEP = 200;
/** Distancia mínima de un arrastre para contarlo como deslizamiento (px). */
const SWIPE_PX = 45;
/** Disco con el que abre la galería (prototipo `g.cur`). */
const START = 1;
const SPOTIFY = 'https://open.spotify.com/album/';

/**
 * Discografía (DIS-1…6), port de la galería del prototipo: vinilos en perspectiva que cruzan la
 * pantalla, un paso de scroll por disco, avance automático, tocadiscos al reproducir y la ficha
 * de detalle con cortina.
 * @param {{
 *   root: HTMLElement,
 *   discs: Disc[],
 *   player: ReturnType<typeof import('../features/player.js').createPlayer>,
 *   curtain: ReturnType<typeof import('../features/transition.js').createCurtain>,
 *   text: Record<string, any>,
 *   getMetrics: () => Metrics,
 *   reduced: boolean,
 * }} options
 * @returns {import('../core/engine.js').Section & { goTo(index: number): void, openDetail(index: number): void, covers: Element[], topY(): number | null }}
 */
export function createDiscography({ root, discs, player, curtain, text, getMetrics, reduced }) {
  const stage = find(root, '[data-disco-stage]', HTMLElement);
  const gallery = find(root, '[data-gallery]', HTMLElement);
  const buttons = findAll(root, '[data-g-discs] button[data-i]', HTMLButtonElement);
  const rolls = buttons.map((b) => find(b, '[data-g-roll]', HTMLElement));
  const deck = find(root, '[data-g-deck]', HTMLElement);
  const arm = find(root, '[data-g-arm]', HTMLElement);
  const titleEl = find(root, '[data-g-title]', HTMLElement);
  const countEl = find(root, '[data-g-n]', HTMLElement);
  const timer = find(root, '[data-g-timer]', HTMLElement);
  const more = find(root, '[data-g-more]', HTMLButtonElement);
  const dialog = find(root, '[data-disc-detail]', HTMLElement);
  // El diálogo vive en <body>: así no queda dentro del <main> que se inhabilita al abrirlo.
  document.body.append(dialog);
  const template = find(root, '[data-detail-template]', HTMLTemplateElement);
  const meta = {
    firstK: find(root, '[data-g-first-k]', HTMLElement),
    first: find(root, '[data-g-first]', HTMLElement),
    year: find(root, '[data-g-year]', HTMLElement),
    type: find(root, '[data-g-type]', HTMLElement),
    tracksK: find(root, '[data-g-tracks-k]', HTMLElement),
    tracks: find(root, '[data-g-tracks]', HTMLElement),
    duration: find(root, '[data-g-duration]', HTMLElement),
  };
  const covers = buttons.map((b) => find(b, 'picture', HTMLElement));
  for (const lab of findAll(root, '[data-color]', HTMLElement)) lab.style.background = lab.dataset.color ?? '';
  const count = discs.length;

  let live = false;
  let cur = START;
  let shownTitle = '';
  let U = 1;
  let W = 1536;
  let yDisco = 0;
  let dIdx = -1;
  let idle = 0;
  let pause = 0;
  let last = 0;
  let pointerDown = false;
  let dragFrom = 0;
  let dragged = false;
  let detailIndex = -1;
  let isOpen = false;
  /** @type {HTMLElement | null} */
  let opener = null;
  let lastTimer = '';
  let compactPos = START;

  /** Disco en el tocadiscos (sonando o en pausa) o null. */
  const onDeck = () => (player.state.disc === null ? null : player.state.disc);

  /**
   * Título que entra letra por letra (prototipo `setLetters`).
   * @param {string} value
   * @param {boolean} animate
   */
  function setTitle(value, animate) {
    if (!animate || reduced) {
      titleEl.textContent = value;
      return;
    }
    titleEl.textContent = '';
    let n = 0;
    value.split(' ').forEach((word, wi) => {
      if (wi) titleEl.append(' ');
      const w = document.createElement('span');
      w.className = 'wd';
      for (const c of word) {
        const l = document.createElement('span');
        l.className = 'lt';
        l.textContent = c;
        l.style.animationDelay = `${n++ * 28}ms`;
        w.append(l);
      }
      titleEl.append(w);
    });
  }

  /** Aplica el estado: poses, tocadiscos, título y datos (prototipo `applyGal`). */
  function apply(first = false) {
    const disc = discs[cur];
    const state = player.state;
    const deckOn = onDeck() === cur;
    const playing = deckOn && state.playing;
    const frame = { V: 389 * U, W };
    buttons.forEach((el, i) => {
      const here = i === cur;
      if (live) {
        const dx = ringOffset(i, cur, count);
        const p = discPose(dx, deckOn, frame);
        el.style.transform = p.transform;
        el.style.zIndex = String(p.z);
        el.style.opacity = String(p.opacity);
        el.style.pointerEvents = p.opacity ? '' : 'none';
        rolls[i].style.transform = `rotate(${here ? 0 : dx * 110}deg)`;
      }
      el.tabIndex = here ? 0 : -1;
      el.classList.toggle('cur', here);
      el.classList.toggle('deck-on', here && deckOn);
      el.classList.toggle('playing', here && playing);
      if (here) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });
    if (live) {
      const center = discPose(0, true, frame).transform;
      deck.style.transform = center;
      arm.style.transform = center;
    }
    deck.classList.toggle('on', deckOn);
    deck.classList.toggle('playing', playing);
    arm.classList.toggle('on', deckOn);
    arm.classList.toggle('playing', playing);
    if (shownTitle !== disc.title) {
      setTitle(disc.title, !first);
      shownTitle = disc.title;
    }
    countEl.textContent = pad2(cur + 1);
    meta.year.textContent = String(disc.year);
    meta.type.textContent = disc.type;
    meta.duration.textContent = formatDuration(discSeconds(disc));
    if (deckOn) {
      meta.firstK.textContent = state.playing ? text.player.playing ?? '' : text.player.paused ?? '';
      meta.first.textContent = `“${disc.tracks[state.track]?.title ?? ''}”`;
      meta.tracksK.textContent = text.player.track ?? '';
      meta.tracks.textContent = fill(text.player.trackOf ?? '{n} / {total}', { n: state.track + 1, total: disc.tracks.length });
    } else {
      meta.firstK.textContent = text.meta?.firstTrack ?? meta.firstK.textContent;
      meta.first.textContent = `“${disc.tracks[0].title}”`;
      meta.tracksK.textContent = text.meta?.tracks ?? meta.tracksK.textContent;
      meta.tracks.textContent = String(disc.tracks.length);
    }
  }

  /**
   * Gira la galería al disco `i` (con vuelta). `auto` no reinicia la espera del avance.
   * @param {number} i
   * @param {boolean} [auto]
   */
  function galGo(i, auto = false) {
    if (!auto) {
      idle = 0;
      pause = PAUSE;
    }
    cur = ((i % count) + count) % count;
    compactPos = cur;
    apply();
  }

  /** Avance automático mientras la sección está a la vista y nada suena en el disco actual. */
  function galAuto(/** @type {number} */ dt, /** @type {number} */ y) {
    const d = Math.min(dt, 0.25);
    const seen = live && y > yDisco - 420 * U;
    if (pause > 0) pause -= d;
    const run = !reduced && seen && !isOpen && onDeck() !== cur && !pointerDown && !(pause > 0) && !curtain.busy;
    if (run) {
      idle += d;
      if (idle >= EVERY) {
        idle = 0;
        galGo(cur + 1, true);
      }
    }
    const value = `${run ? Math.min(100, (idle / EVERY) * 100) : 0}%`;
    if (value !== lastTimer) {
      lastTimer = value;
      timer.style.width = value;
    }
  }

  /** Clic en un vinilo: un vecino pasa al centro y suena; el central suena o se pausa. */
  function tap(/** @type {number} */ i) {
    if (dragged) return;
    if (i !== cur) {
      cur = i;
      player.play(i, 0);
      apply();
      return;
    }
    playCurrent();
  }

  function playCurrent() {
    if (player.state.disc === cur) player.toggle();
    else player.play(cur, 0);
  }

  // --- entrada del usuario ---
  gallery.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    dragFrom = event.clientX;
    dragged = false;
  });
  const release = (/** @type {PointerEvent} */ event) => {
    if (!pointerDown) return;
    pointerDown = false;
    const dx = event.clientX - dragFrom;
    if (Math.abs(dx) > SWIPE_PX) {
      dragged = true;
      galGo(cur + (dx < 0 ? 1 : -1));
      setTimeout(() => (dragged = false), 0);
    }
  };
  gallery.addEventListener('pointerup', release);
  gallery.addEventListener('pointercancel', () => (pointerDown = false));
  gallery.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') galGo(cur + 1);
    else if (event.key === 'ArrowLeft') galGo(cur - 1);
    else if ((event.key === 'Enter' || event.key === ' ') && event.target === gallery) tap(cur);
    else return;
    event.preventDefault();
  });
  find(root, '[data-g-prev]', HTMLButtonElement).addEventListener('click', () => galGo(cur - 1));
  find(root, '[data-g-next]', HTMLButtonElement).addEventListener('click', () => galGo(cur + 1));
  more.addEventListener('click', () => openDetail(cur));
  buttons.forEach((button, i) => button.addEventListener('click', () => tap(i)));

  /** Lleva la galería a un disco (barra del reproductor, ficha). */
  function goTo(/** @type {number} */ index) {
    galGo(index);
  }

  // --- ficha de detalle ---
  /** @param {number} index */
  function fillDetail(index) {
    detailIndex = index;
    const disc = discs[index];
    const t = text.detail;
    dialog.replaceChildren(template.content.cloneNode(true));
    /** @param {string} name */
    const el = (name) => find(dialog, `[data-d-${name}]`, HTMLElement);
    el('eyebrow').textContent = `${disc.type} · ${disc.year}`;
    el('title').textContent = disc.title;
    el('tracks-n').textContent = pad2(disc.tracks.length);
    el('duration').textContent = minutesLabel(disc, t.minutes);
    el('year').textContent = String(disc.year);
    el('guests').textContent = String(guestCount(disc));
    const sleeve = el('sleeve');
    const cover = /** @type {HTMLElement} */ (covers[index].cloneNode(true));
    // La carátula va cuadrada: sin la clase que la recorta como etiqueta del vinilo.
    cover.className = '';
    const img = cover.querySelector('img');
    if (img) img.alt = fill(text.coverAlt, { title: disc.title });
    const wear = document.createElement('span');
    wear.className = 'detail__wear';
    sleeve.replaceChildren(cover, wear);
    const label = find(dialog, '[data-d-label]', HTMLElement);
    label.style.background = disc.color;
    label.replaceChildren(covers[index].cloneNode(true));
    const spotify = find(dialog, '[data-d-spotify]', HTMLAnchorElement);
    spotify.href = `${SPOTIFY}${disc.spotifyId}`;
    const list = el('tracks');
    disc.tracks.forEach((track, n) => {
      const item = document.createElement('li');
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'trk';
      row.dataset.t = String(n);
      const number = document.createElement('span');
      number.className = 'trk__n';
      number.textContent = pad2(n + 1);
      const name = document.createElement('span');
      name.className = 'trk__name';
      name.textContent = track.title;
      if (track.guest) {
        const guest = document.createElement('small');
        guest.textContent = track.guest;
        name.append(guest);
      }
      const time = document.createElement('span');
      time.className = 'trk__time';
      time.textContent = formatDuration(track.durationSec);
      row.append(number, name, time);
      row.addEventListener('click', () => player.play(index, n));
      item.append(row);
      list.append(item);
    });
    const prev = wrapIndex(index, count, -1);
    const next = wrapIndex(index, count, 1);
    const prevBtn = find(dialog, '[data-d-prev]', HTMLButtonElement);
    const nextBtn = find(dialog, '[data-d-next]', HTMLButtonElement);
    find(prevBtn, 'b', HTMLElement).textContent = discs[prev].title;
    find(nextBtn, 'b', HTMLElement).textContent = discs[next].title;
    prevBtn.addEventListener('click', () => fillDetail(prev));
    nextBtn.addEventListener('click', () => fillDetail(next));
    find(dialog, '[data-d-back]', HTMLButtonElement).addEventListener('click', closeModal);
    find(dialog, '[data-d-play]', HTMLButtonElement).addEventListener('click', () => {
      if (player.state.disc === index) player.toggle();
      else player.play(index, 0);
    });
    syncDetail(player.state);
    dialog.scrollTop = 0;
    galGo(index);
  }

  /** @param {PlayerState} state */
  function syncDetail(state) {
    if (!isOpen || detailIndex < 0) return;
    const disc = discs[detailIndex];
    const here = state.disc === detailIndex;
    const playing = here && state.playing;
    const play = find(dialog, '[data-d-play]', HTMLButtonElement);
    play.textContent = playing
      ? text.detail.pause
      : disc.tracks.length > 1
        ? text.detail.playAlbum
        : text.detail.playSingle;
    play.classList.toggle('is-playing', playing);
    find(dialog, '[data-d-deck]', HTMLElement).classList.toggle('is-playing', playing);
    findAll(dialog, '.trk', HTMLButtonElement).forEach((row) => {
      const active = here && Number(row.dataset.t) === state.track;
      row.classList.toggle('is-active', active);
      row.classList.toggle('is-playing', active && state.playing);
      if (active) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    });
  }

  /** @param {number} index */
  function openDetail(index) {
    const cover = covers[index].querySelector('img');
    curtain.run(
      { title: discs[index].title, cover: cover ? { src: cover.currentSrc || cover.src } : null },
      () => {
        fillDetail(index);
        openModal();
      },
    );
  }

  const BACKGROUND = 'main, footer, header';

  function openModal() {
    if (isOpen) return;
    isOpen = true;
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.hidden = false;
    document.documentElement.classList.add('detail-open');
    syncDetail(player.state);
    for (const el of document.querySelectorAll(BACKGROUND)) el.setAttribute('inert', '');
    find(dialog, '[data-d-back]', HTMLButtonElement).focus();
  }

  function closeModal() {
    if (!isOpen) return;
    isOpen = false;
    detailIndex = -1;
    dialog.hidden = true;
    document.documentElement.classList.remove('detail-open');
    for (const el of document.querySelectorAll(BACKGROUND)) el.removeAttribute('inert');
    opener?.focus();
  }

  // Esc cierra y Tab queda dentro de la ficha (el fondo está inhabilitado con `inert`).
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    } else if (event.key === 'Tab') {
      const focusable = findAll(dialog, 'button, a[href]', HTMLElement).filter(
        (el) => !el.hasAttribute('disabled'),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  player.subscribe((state) => {
    apply();
    syncDetail(state);
  });

  // La galería ya no es una lista estática: se activa (la lista queda para lectores de pantalla).
  root.classList.add('disco--live');

  /** Móvil: arco plano (se porta con el recorrido móvil). */
  function renderCompact() {
    const { vw, vh } = getMetrics();
    const size = Math.min(vw * 0.78, vh * 0.36);
    gallery.style.setProperty('--disc-size', `${size.toFixed(0)}px`);
    buttons.forEach((button, i) => {
      const slot = arcSlot(ringOffset(i, Math.round(compactPos), count), { size, spacing: size * 0.88 });
      button.style.transform = `translate3d(${slot.x.toFixed(1)}px, ${slot.y.toFixed(1)}px, 0) scale(${slot.scale.toFixed(3)}) rotate(${slot.rotate.toFixed(2)}deg)`;
      button.style.opacity = slot.opacity.toFixed(2);
      button.style.zIndex = String(slot.z);
    });
  }

  const section = {
    id: 'discografia',
    start: 0,
    end: 0,
    covers,
    goTo,
    openDetail,
    /** Scroll en que la galería queda en su lugar (prototipo `yDisco`). */
    topY: () => (live ? yDisco : null),
    measure() {
      const { vh, vw, blocks, compact } = getMetrics();
      const block = blocks.find((b) => b.id === 'discografia');
      const before = live;
      live = !compact;
      W = vw;
      U = Math.min(vh / 800, vw / 1100);
      root.classList.toggle('disco--pinned', live);
      section.start = block?.top ?? 0;
      let changed = before !== live;
      if (live) {
        // La galería se fija a 64 px del borde, con la guirnalda asomando (prototipo `layout`).
        const gTop = gallery.offsetTop;
        stage.style.setProperty('--disco-top', `${64 * U - gTop}px`);
        const height = `${Math.round(stage.offsetHeight + DSTEP * U * (count - 1) + (DSTEP * U) / 2)}px`;
        if (root.style.height !== height) changed = true;
        root.style.height = height;
        const y0 = section.start + gTop - 64 * U;
        // Si la galería cambió de lugar, el paso actual se recalcula sin girar discos.
        if (y0 !== yDisco) dIdx = -1;
        yDisco = y0;
      } else {
        root.style.height = '';
        stage.style.removeProperty('--disco-top');
      }
      section.end = section.start + root.offsetHeight;
      apply(true);
      if (!live) renderCompact();
      return changed;
    },
    alwaysTick: true,
    /** @param {ScrollState} state */
    update(state) {
      const dt = last ? (state.now - last) / 1000 : 0;
      last = state.now;
      if (live) {
        // Dentro de la sección fija, cada paso de scroll gira un disco.
        const step = DSTEP * U;
        const di = state.y >= yDisco - 1 ? Math.floor((state.y - yDisco + step / 2) / step) : -1;
        if (di !== dIdx) {
          if (di >= 0 && dIdx >= 0 && !isOpen) galGo(cur + (di - dIdx));
          dIdx = di;
        }
      }
      galAuto(dt, state.y);
    },
  };
  return section;
}
