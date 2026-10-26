// @ts-check
// Ayudas mínimas de DOM compartidas por las secciones.

/**
 * Busca un elemento obligatorio y comprueba su tipo; falla con un mensaje claro si no está.
 * @template {Element} T
 * @param {ParentNode} root
 * @param {string} selector
 * @param {new () => T} type
 * @returns {T}
 */
export function find(root, selector, type) {
  const el = root.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`Falta ${selector} en la página`);
  return el;
}

/**
 * Todos los elementos que coinciden, ya como arreglo del tipo esperado.
 * @template {Element} T
 * @param {ParentNode} root
 * @param {string} selector
 * @param {new () => T} type
 * @returns {T[]}
 */
export function findAll(root, selector, type) {
  return /** @type {T[]} */ (
    [...root.querySelectorAll(selector)].filter((el) => el instanceof type)
  );
}

/**
 * Texto de `<script type="application/json">` ya convertido.
 * @param {ParentNode} root
 * @param {string} selector
 * @returns {any}
 */
export function readJson(root, selector) {
  return JSON.parse(find(root, selector, HTMLScriptElement).textContent ?? 'null');
}

/**
 * Espera a que termine una transición CSS, con un tope por si el navegador no dispara el
 * evento (pestaña oculta, reduced-motion o elemento sin transición).
 * @param {Element} el
 * @param {number} fallbackMs
 * @returns {Promise<void>}
 */
export function transitionEnd(el, fallbackMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('transitionend', onEnd);
      clearTimeout(timer);
      resolve();
    };
    /** @param {Event} event */
    const onEnd = (event) => {
      if (event.target === el) finish();
    };
    el.addEventListener('transitionend', onEnd);
    const timer = setTimeout(finish, fallbackMs);
  });
}
