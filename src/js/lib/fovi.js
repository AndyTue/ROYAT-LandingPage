// @ts-check
// Lógica pura de Fovi Rodríguez: patas, zonas que no pisa, sección y frases.
/**
 * Cada pata: [clave, ángulo en el dibujo, ángulo medio, vaivén, fase, ángulo de pie, dx y dy de
 * la pezuña respecto al pivote]. Los valores salen de los dibujos de `assets-src/mascot/`.
 * @type {readonly { key: 'hf' | 'ff' | 'hn' | 'fn', rest: number, mid: number, swing: number, phase: number, stand: number, dx: number, dy: number }[]}
 */
export const LEGS = [
  { key: 'hf', rest: 16, mid: 4, swing: 24, phase: 0, stand: 6, dx: -17, dy: 55 },
  { key: 'ff', rest: 0, mid: 0, swing: 24, phase: Math.PI, stand: 0, dx: -3, dy: 52 },
  { key: 'hn', rest: 0, mid: 6, swing: 22, phase: Math.PI, stand: 4, dx: 2, dy: 52 },
  { key: 'fn', rest: 50, mid: 18, swing: 32, phase: 0, stand: 10, dx: -39, dy: 50 },
];

/**
 * Pose de una pata: giro (grados) y subida (px) para la fase del paso. `walk` va de 0 (quieto,
 * de pie) a 1 (caminando).
 * @param {(typeof LEGS)[number]} leg
 * @param {number} phase
 * @param {number} walk
 * @returns {{ deg: number, y: number }}
 */
export function legPose(leg, phase, walk) {
  const swing = leg.mid + leg.swing * Math.sin(phase + leg.phase);
  const angle = leg.stand + (swing - leg.stand) * walk;
  const turn = ((angle - leg.rest) * Math.PI) / 180;
  const y =
    (leg.dy * (1 - Math.cos(turn)) - leg.dx * Math.sin(turn)) * 0.41 -
    walk * Math.max(0, Math.cos(phase + leg.phase)) * 3.2;
  return { deg: angle - leg.rest, y };
}

/**
 * @typedef {{ left: number, right: number }} Zone franja horizontal que Fovi no pisa
 */

/**
 * Une varias franjas en una (o `null` si no hay).
 * @param {readonly Zone[]} zones
 * @returns {Zone | null}
 */
export function joinZones(zones) {
  if (!zones.length) return null;
  return {
    left: Math.min(...zones.map((z) => z.left)),
    right: Math.max(...zones.map((z) => z.right)),
  };
}

/**
 * Posición libre más cercana a `x`: si cae dentro de la zona (más `gap`), se queda al lado que
 * le queda más cerca y, si ahí no cabe en la pantalla, al otro.
 * @param {number} x
 * @param {Zone | null} zone
 * @param {{ gap: number, margin: number, width: number }} frame
 */
export function stayAside(x, zone, { gap, margin, width }) {
  if (!zone || x <= zone.left - gap || x >= zone.right + gap) return x;
  const middle = (zone.left + zone.right) / 2;
  const near = x >= middle ? zone.right + gap : zone.left - gap;
  const far = x >= middle ? zone.left - gap : zone.right + gap;
  const fits = (/** @type {number} */ v) => v >= margin && v <= width - margin;
  return fits(near) ? near : fits(far) ? far : x;
}

/** ¿`x` está dentro de la zona con un margen? */
export const inZone = (
  /** @type {number} */ x,
  /** @type {Zone | null} */ zone,
  /** @type {number} */ margin,
) => zone !== null && x > zone.left - margin && x < zone.right + margin;

/** Tema de los datos curiosos que corresponde a cada sección de la navegación. */
const FACT_TOPIC = /** @type {const} */ ({
  inicio: 'orquesta',
  historia: 'orquesta',
  integrantes: 'jarana',
  presencia: 'mapa',
  discografia: 'discos',
  contacto: 'contacto',
});

/**
 * @param {string | null | undefined} sectionId id de la sección activa
 * @returns {'orquesta' | 'jarana' | 'mapa' | 'discos' | 'contacto'}
 */
export const factTopic = (sectionId) =>
  FACT_TOPIC[/** @type {keyof typeof FACT_TOPIC} */ (sectionId ?? 'inicio')] ?? 'orquesta';

/**
 * Siguiente frase: dato de la sección y frase suelta se alternan.
 * @param {{ facts: Record<string, string[]>, generic: string[][] }} lines
 * @param {{ topic: string, count: number, seen: Record<string, number> }} memory `count` frases
 *   dichas; `seen` datos dichos por tema (se actualiza)
 * @returns {[string, string]}
 */
export function nextLine({ facts, generic }, { topic, count, seen }) {
  if (count % 2 === 0) {
    const list = facts[topic] ?? [];
    const index = seen[topic] ?? 0;
    seen[topic] = index + 1;
    return [list[index % list.length] ?? '', ''];
  }
  const line = generic[Math.floor(count / 2) % generic.length];
  return [line[0], line[1] ?? ''];
}

/**
 * Lado al que se va a otro rato de paseo en móvil (cruza a la otra esquina).
 * @param {number} x
 * @param {number} width
 * @param {number} inset distancia al borde
 */
export const otherSide = (x, width, inset) => (x > width / 2 ? inset : width - inset);

/**
 * Tamaño de zona del reproductor y del listón centrados.
 * @param {number} width ancho de la pantalla
 * @param {number} size ancho del elemento
 * @returns {Zone}
 */
export const centered = (width, size) => ({
  left: width / 2 - size / 2,
  right: width / 2 + size / 2,
});

/** Mueve `x` hacia `target` a velocidad `speed` (px/s) durante `dt` segundos. */
export const stepToward = (
  /** @type {number} */ x,
  /** @type {number} */ target,
  /** @type {number} */ speed,
  /** @type {number} */ dt,
) => x + Math.sign(target - x) * Math.min(Math.abs(target - x), speed * dt);

/** Posición del globo respecto a Fovi: a su lado, o encima si no cabe. */
export function placeBubble(
  /** @type {{ x: number, face: 1 | -1, width: number, bw: number, zone: Zone | null }} */ {
    x,
    face,
    width,
    bw,
    zone,
  },
) {
  const clear = (/** @type {number} */ left) =>
    !zone || left + bw < zone.left - 10 || left > zone.right + 10;
  const right = x + 66;
  const left = x - 66 - bw;
  const okRight = right + bw <= width - 10 && clear(right);
  const okLeft = left >= 10 && clear(left);
  const first =
    face > 0 ? (okRight ? 'r' : okLeft ? 'l' : 'u') : okLeft ? 'l' : okRight ? 'r' : 'u';
  return { mode: /** @type {'r' | 'l' | 'u'} */ (first), left, right };
}
