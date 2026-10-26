// @ts-check
import { find, transitionEnd } from '../lib/dom.js';

/**
 * @typedef {{ title?: string, cover?: { src: string } | null }} CurtainOptions
 */

/** Duración de cada paso de la cortina, igual que la transición de CSS. */
const SLIDE_MS = 620;
/** Pausa con la cortina cerrada: lo que se ve dentro tiene un instante para leerse. */
const HOLD_MS = 380;

/**
 * Cortina de transición reutilizable (`z-curtain`): cubre la pantalla de derecha a izquierda,
 * deja que `onCovered` cambie lo que hay detrás y se descubre hacia la izquierda. Con
 * reduced-motion no se anima: solo ejecuta el cambio.
 * @param {HTMLElement} root `[data-curtain]`
 * @param {{ reduced: boolean }} options
 */
export function createCurtain(root, { reduced }) {
  const title = find(root, '[data-curtain-title]', HTMLElement);
  const cover = find(root, '[data-curtain-cover]', HTMLElement);
  let busy = false;

  return {
    get busy() {
      return busy;
    },
    /**
     * @param {CurtainOptions} content
     * @param {() => void | Promise<void>} onCovered
     */
    async run({ title: text = '', cover: art = null }, onCovered) {
      if (busy) return;
      busy = true;
      try {
        if (reduced) {
          await onCovered();
          return;
        }
        title.textContent = text;
        cover.hidden = !art;
        if (art) {
          // La portada se crea al usarse: en el HTML no hay una imagen sin origen.
          const image = new Image(320, 320);
          image.alt = '';
          image.src = art.src;
          cover.replaceChildren(image);
        }
        root.classList.toggle('curtain--cover', Boolean(art));
        root.classList.add('curtain--in');
        await transitionEnd(root, SLIDE_MS + 120);
        await onCovered();
        await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
        root.classList.replace('curtain--in', 'curtain--out');
        await transitionEnd(root, SLIDE_MS + 120);
      } finally {
        root.classList.remove('curtain--in', 'curtain--out', 'curtain--cover');
        busy = false;
      }
    },
  };
}
