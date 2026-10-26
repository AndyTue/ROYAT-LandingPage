// @ts-check
// Bus de eventos mínimo (ARCHITECTURE §4): `section:change`, `player:*`, `contact:prefill`.
// No hay store global: cada módulo es dueño de su estado.

/**
 * @typedef {{
 *   on(type: string, handler: (detail: any) => void): () => void,
 *   emit(type: string, detail?: unknown): void,
 * }} Bus
 */

/** @returns {Bus} */
export function createBus() {
  /** @type {Map<string, Set<(detail: any) => void>>} */
  const handlers = new Map();
  return {
    on(type, handler) {
      const set = handlers.get(type) ?? new Set();
      set.add(handler);
      handlers.set(type, set);
      return () => set.delete(handler);
    },
    emit(type, detail) {
      // Copia: un manejador puede darse de baja mientras se emite.
      for (const handler of [...(handlers.get(type) ?? [])]) handler(detail);
    },
  };
}

/** Bus compartido de la página. */
export const bus = createBus();
