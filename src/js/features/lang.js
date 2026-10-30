// @ts-check

const KEY = 'royat-lang';

/**
 * Selector de idioma del Hero: recuerda la elección para que la próxima visita a `/` lleve a
 * la versión elegida. Los enlaces ya funcionan sin JS.
 * @param {{ root: HTMLElement, store?: Pick<Storage, 'setItem'> | null }} options
 */
export function createLangSwitch({ root, store = safeStorage() }) {
  for (const link of root.querySelectorAll('[data-lang-opt]')) {
    link.addEventListener('click', () => {
      try {
        store?.setItem(KEY, /** @type {HTMLElement} */ (link).dataset.langOpt ?? 'es');
      } catch {
        // Sin almacenamiento solo se pierde el recordatorio.
      }
    });
  }
}

/**
 * Si la persona eligió inglés antes y entra a la versión en español, la lleva a `/en/`.
 * @param {{ lang: string, pathname: string, store?: Pick<Storage, 'getItem'> | null, go: (path: string) => void }} input
 */
export function redirectToSavedLang({ lang, pathname, store = safeStorage(), go }) {
  if (lang === 'en' || pathname.startsWith('/en')) return;
  try {
    if (store?.getItem(KEY) === 'en') go('/en/');
  } catch {
    // Sin almacenamiento no hay preferencia que respetar.
  }
}

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
