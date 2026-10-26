// @ts-check
import { clock } from '../lib/disc.js';
import { find } from '../lib/dom.js';

/**
 * @typedef {import('./player.js').PlayerState} PlayerState
 * @typedef {import('../lib/disc.js').Disc} Disc
 */

/**
 * Barra del reproductor (DIS-4): portada, título, anterior/play/siguiente, tiempo y barra de
 * progreso. Aparece al sonar algo y se oculta al cerrarla.
 * @param {{
 *   root: HTMLElement,
 *   player: ReturnType<typeof import('./player.js').createPlayer>,
 *   discs: readonly Disc[],
 *   covers: readonly Element[],
 *   text: Record<string, string>,
 *   onInfo: (disc: number) => void,
 *   onNow: (disc: number) => void,
 * }} options `covers` son las `<picture>` de cada portada (se clonan en la barra).
 */
export function createPlayerBar({ root, player, discs, covers, text, onInfo, onNow }) {
  const title = find(root, '[data-p-title]', HTMLElement);
  const sub = find(root, '[data-p-sub]', HTMLElement);
  const time = find(root, '[data-p-time]', HTMLElement);
  const seek = find(root, '[data-p-seek]', HTMLInputElement);
  const toggle = find(root, '[data-p-toggle]', HTMLButtonElement);
  const vinyl = find(root, '[data-p-vinyl]', HTMLElement);
  const errorEl = find(root, '[data-p-error]', HTMLElement);
  let shownDisc = -1;

  find(root, '[data-p-prev]', HTMLButtonElement).addEventListener('click', () => player.prev());
  find(root, '[data-p-next]', HTMLButtonElement).addEventListener('click', () => player.next());
  toggle.addEventListener('click', () => player.toggle());
  find(root, '[data-p-close]', HTMLButtonElement).addEventListener('click', () => player.close());
  find(root, '[data-p-info]', HTMLButtonElement).addEventListener('click', () => {
    if (player.state.disc !== null) onInfo(player.state.disc);
  });
  find(root, '[data-p-now]', HTMLButtonElement).addEventListener('click', () => {
    if (player.state.disc !== null) onNow(player.state.disc);
  });
  seek.addEventListener('input', () => player.seek(Number(seek.value) / 1000));

  /** @param {number} disc */
  function showCover(disc) {
    if (shownDisc === disc) return;
    shownDisc = disc;
    const clone = covers[disc].cloneNode(true);
    const label = find(vinyl, '[data-p-cover]', HTMLElement);
    label.replaceChildren(clone);
  }

  player.subscribe((/** @type {PlayerState} */ state) => {
    const active = state.disc !== null;
    root.hidden = !active;
    document.documentElement.classList.toggle('has-player', active);
    root.classList.toggle('is-playing', state.playing);
    errorEl.hidden = !state.error;
    if (!active || state.disc === null) {
      shownDisc = -1;
      return;
    }
    const disc = discs[state.disc];
    const track = disc.tracks[state.track];
    showCover(state.disc);
    title.textContent = track.title;
    sub.textContent =
      disc.tracks.length > 1
        ? `${disc.title} · ${state.track + 1}/${disc.tracks.length}`
        : disc.title;
    time.textContent = clock(state.current, state.duration || track.durationSec);
    if (document.activeElement !== seek) {
      seek.value = String(state.duration ? Math.round((state.current / state.duration) * 1000) : 0);
    }
    toggle.setAttribute('aria-label', state.playing ? text.pause : text.play);
    toggle.setAttribute('aria-busy', String(state.loading));
  });
}
