// @ts-check
import { find, findAll } from '../lib/dom.js';
import { fill, formatDuration, pad2 } from '../lib/format.js';
import {
  arcPosition,
  arcPose,
  arcSlot,
  discSeconds,
  guestCount,
  idleProgress,
  minutesLabel,
  scrollForIndex,
  wrapIndex,
} from '../lib/disc.js';

/**
 * @typedef {import('../core/engine.js').ScrollState} ScrollState
 * @typedef {import('../core/layout.js').Metrics} Metrics
 * @typedef {import('../lib/disc.js').Disc} Disc
 * @typedef {import('../features/player.js').PlayerState} PlayerState
 */

/** Espera sin tocar nada antes de pasar al siguiente disco (DIS-2). */
const IDLE_MS = 7000;
/** Distancia mínima de un arrastre para contarlo como deslizamiento (px). */
const SWIPE_PX = 40;
const SPOTIFY = 'https://open.spotify.com/album/';

/**
 * Discografía (DIS-1…6): galería de vinilos en arco movida por el scroll, el deslizamiento y
 * las flechas, ficha de detalle en un `<dialog>` y reproducción con el reproductor.
 * @param {{
 *   root: HTMLElement,
 *   discs: Disc[],
 *   player: ReturnType<typeof import('../features/player.js').createPlayer>,
 *   curtain: ReturnType<typeof import('../features/transition.js').createCurtain>,
 *   text: Record<string, any>,
 *   getMetrics: () => Metrics,
 *   reduced: boolean,
 * }} options
 * @returns {import('../core/engine.js').Section & { goTo(index: number): void, openDetail(index: number): void, covers: Element[] }}
 */
export function createDiscography({ root, discs, player, curtain, text, getMetrics, reduced }) {
  const gallery = find(root, '[data-gallery]', HTMLElement);
  const buttons = findAll(root, '[data-g-discs] [data-i]', HTMLButtonElement);
  const deckEls = findAll(root, '[data-g-layer]', HTMLElement);
  const titleEl = find(root, '[data-g-title]', HTMLElement);
  const countEl = find(root, '[data-g-n]', HTMLElement);
  const timer = find(root, '[data-g-timer]', HTMLElement);
  const more = find(root, '[data-g-more]', HTMLButtonElement);
  const dialog = find(root, '[data-disc-detail]', HTMLElement);
  // El diálogo vive en <body>: así no queda dentro del <main> que se inhabilita al abrirlo.
  document.body.append(dialog);
  const template = find(root, '[data-detail-template]', HTMLTemplateElement);
  const meta = {
    first: find(root, '[data-g-first]', HTMLElement),
    year: find(root, '[data-g-year]', HTMLElement),
    type: find(root, '[data-g-type]', HTMLElement),
    tracks: find(root, '[data-g-tracks]', HTMLElement),
    duration: find(root, '[data-g-duration]', HTMLElement),
  };
  const covers = buttons.map((b) => find(b, 'picture', HTMLElement));
  const count = discs.length;

  let pinned = false;
  let step = 1;
  let pos = 0;
  let current = -1;
  let drawnPos = NaN;
  let frame = { spacing: 280, size: 320, vw: 1536, compact: false };
  let deckOn = false;
  let lastInput = performance.now();
  let autoDone = false;
  let dragFrom = 0;
  let dragged = false;
  let detailIndex = -1;
  let isOpen = false;
  /** @type {HTMLElement | null} */
  let opener = null;
  let lastTimer = '';

  const clampIndex = (/** @type {number} */ i) => Math.min(count - 1, Math.max(0, i));

  /** Lleva la galería al disco `index`: con la pantalla fija mueve el scroll; si no, la posición. */
  function goTo(/** @type {number} */ index) {
    const target = clampIndex(index);
    if (pinned) {
      window.scrollTo({
        top: scrollForIndex(target, section.start, step),
        behavior: reduced ? 'auto' : 'smooth',
      });
    } else {
      pos = target;
      render();
    }
  }

  function renderDiscs() {
    // El tocadiscos comparte la pose del disco central (en escritorio, en perspectiva).
    const deckPose = frame.compact ? '' : arcPose(0, frame).transform;
    for (const el of deckEls) el.style.transform = deckPose;
    buttons.forEach((button, i) => {
      if (!frame.compact) {
        const pose = arcPose(i - pos, frame);
        button.style.transform = pose.transform;
        button.style.opacity = pose.opacity.toFixed(2);
        button.style.zIndex = String(pose.z);
        button.style.setProperty('--roll', `${((i - pos) * 110).toFixed(1)}deg`);
        return;
      }
      const slot = arcSlot(i - pos, frame);
      if (deckOn) {
        // Suena el disco central: se achica sobre el tocadiscos y los vecinos se hacen a un lado.
        if (i === current) slot.scale *= 0.8;
        else slot.x *= 1.3;
      }
      button.style.transform = `translate3d(${slot.x.toFixed(1)}px, ${slot.y.toFixed(1)}px, 0) scale(${slot.scale.toFixed(3)}) rotate(${slot.rotate.toFixed(2)}deg)`;
      button.style.opacity = slot.opacity.toFixed(2);
      button.style.zIndex = String(slot.z);
    });
  }

  /** @param {number} index */
  function showInfo(index) {
    const disc = discs[index];
    titleEl.textContent = disc.title;
    countEl.textContent = pad2(index + 1);
    meta.first.textContent = `“${disc.tracks[0].title}”`;
    meta.year.textContent = String(disc.year);
    meta.type.textContent = disc.type;
    meta.tracks.textContent = String(disc.tracks.length);
    meta.duration.textContent = formatDuration(discSeconds(disc));
    buttons.forEach((b, i) => {
      if (i === index) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    syncSpin(player.state);
  }

  /** @param {PlayerState} state */
  function syncSpin(state) {
    const wasOn = deckOn;
    deckOn = state.playing && state.disc === current;
    gallery.classList.toggle('gal--deck', deckOn);
    if (deckOn !== wasOn) drawnPos = NaN;
    buttons.forEach((button, i) => {
      const vinyl = find(button, '[data-vinyl]', HTMLElement);
      vinyl.classList.toggle('is-spinning', state.playing && state.disc === i);
    });
  }

  function render() {
    if (pos !== drawnPos) {
      drawnPos = pos;
      renderDiscs();
    }
    const index = clampIndex(Math.round(pos));
    if (index !== current) {
      current = index;
      showInfo(index);
    }
  }

  /**
   * Cuenta el tiempo sin tocar nada y, cumplido, pasa al siguiente disco una vez.
   * Solo corre con la galería a la vista: si no, el avance movería el scroll desde otra sección.
   * @param {number} now
   * @param {boolean} inView
   */
  function autoAdvance(now, inView) {
    if (!inView) lastInput = now;
    const blocked = !inView || reduced || autoDone || player.state.playing || isOpen;
    const p = blocked ? 0 : idleProgress(now - lastInput, IDLE_MS);
    const value = `scaleX(${p.toFixed(2)})`;
    if (value !== lastTimer) {
      lastTimer = value;
      timer.style.transform = value;
    }
    if (blocked) return;
    if (p >= 1) {
      lastInput = now;
      if (current < count - 1) goTo(current + 1);
      else autoDone = true;
    }
  }

  // --- entrada del usuario ---
  const touch = () => {
    lastInput = performance.now();
  };
  gallery.addEventListener('pointerdown', (event) => {
    touch();
    dragFrom = event.clientX;
    dragged = false;
  });
  gallery.addEventListener('pointerup', (event) => {
    const dx = event.clientX - dragFrom;
    if (Math.abs(dx) > SWIPE_PX) {
      dragged = true;
      goTo(current + (dx < 0 ? 1 : -1));
    }
  });
  gallery.addEventListener('keydown', (event) => {
    touch();
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') goTo(current + 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') goTo(current - 1);
    else if (event.key === 'Home') goTo(0);
    else if (event.key === 'End') goTo(count - 1);
    else if (event.key === 'Enter' || event.key === ' ') playCurrent();
    else return;
    event.preventDefault();
  });
  window.addEventListener('wheel', touch, { passive: true });
  window.addEventListener('touchstart', touch, { passive: true });
  find(root, '[data-g-prev]', HTMLButtonElement).addEventListener('click', () => goTo(current - 1));
  find(root, '[data-g-next]', HTMLButtonElement).addEventListener('click', () => goTo(current + 1));
  more.addEventListener('click', () => openDetail(current));
  buttons.forEach((button, i) =>
    button.addEventListener('click', () => {
      if (dragged) return;
      // Un vecino se trae al centro; el central suena (o se pausa).
      if (i === current) playCurrent();
      else goTo(i);
    }),
  );

  function playCurrent() {
    const state = player.state;
    if (state.disc === current) player.toggle();
    else player.play(current, 0);
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
    sleeve.replaceChildren(cover);
    find(dialog, '[data-d-vinyl]', HTMLElement).replaceChildren(covers[index].cloneNode(true));
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
    goTo(index);
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
    touch();
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
    syncSpin(state);
    syncDetail(state);
  });

  // La galería ya no es una lista estática: se activa (la lista queda para lectores de pantalla).
  root.classList.add('disco--live');

  const section = {
    id: 'discografia',
    start: 0,
    end: 0,
    covers,
    goTo,
    openDetail,
    measure() {
      const { vh, vw, blocks } = getMetrics();
      const block = blocks.find((b) => b.id === 'discografia');
      const before = pinned;
      pinned = !reduced;
      root.classList.toggle('disco--pinned', pinned);
      section.start = block?.top ?? 0;
      section.end = block?.bottom ?? 0;
      step = Math.max(1, (section.end - section.start - vh) / Math.max(1, count - 1));
      const compact = vw < 768;
      // Escritorio: el vinilo central mide 389 px a 800 de alto (el prototipo).
      const size = compact ? Math.min(vw * 0.78, vh * 0.36) : Math.min(vh * 0.486, vw * 0.253);
      frame = { size, spacing: size * (compact ? 0.88 : 0.86), vw, compact };
      gallery.style.setProperty('--disc-size', `${size.toFixed(0)}px`);
      drawnPos = NaN;
      render();
      return before !== pinned;
    },
    alwaysTick: true,
    /** @param {ScrollState} state */
    update(state) {
      if (pinned) pos = arcPosition(state.y, section.start, step, count);
      render();
      autoAdvance(state.now, state.y >= section.start - state.vh * 0.25 && state.y < section.end);
    },
  };
  return section;
}
