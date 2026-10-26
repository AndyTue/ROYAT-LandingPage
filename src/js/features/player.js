// @ts-check
import { trackUrl } from '../lib/disc.js';

/**
 * @typedef {import('../lib/disc.js').Disc} Disc
 * @typedef {{
 *   disc: number | null,
 *   track: number,
 *   playing: boolean,
 *   loading: boolean,
 *   error: boolean,
 *   current: number,
 *   duration: number,
 * }} PlayerState
 * @typedef {Pick<HTMLAudioElement, 'play' | 'pause' | 'addEventListener' | 'currentTime' | 'duration' | 'paused' | 'src' | 'preload' | 'load'>} AudioLike
 * @typedef {import('../core/events.js').Bus} Bus
 */

/**
 * Reproductor de la discografía (DIS-4, DIS-5): un `<audio>` nativo con las pistas completas
 * de la ROYAT. El archivo se descarga solo al pulsar Reproducir (`preload="none"`). Otros
 * módulos (vinilo, barra, ficha, Fovi) escuchan el estado, no el `<audio>`.
 * @param {{ audio: AudioLike, baseUrl: string, discs: readonly Disc[], bus?: Bus }} options
 */
export function createPlayer({ audio, baseUrl, discs, bus }) {
  /** @type {PlayerState} */
  const state = {
    disc: null,
    track: 0,
    playing: false,
    loading: false,
    error: false,
    current: 0,
    duration: 0,
  };
  /** @type {Set<(state: Readonly<PlayerState>) => void>} */
  const listeners = new Set();
  audio.preload = 'none';

  function notify() {
    const snapshot = { ...state };
    for (const listener of listeners) listener(snapshot);
  }

  /** @param {number} disc @param {number} track */
  function load(disc, track) {
    state.disc = disc;
    state.track = track;
    state.current = 0;
    state.duration = discs[disc].tracks[track].durationSec;
    state.error = false;
    audio.src = trackUrl(baseUrl, discs[disc].spotifyId, track);
    publishMedia();
  }

  function publishMedia() {
    if (!('mediaSession' in navigator) || state.disc === null) return;
    const disc = discs[state.disc];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: disc.tracks[state.track].title,
      artist: 'Real Orquesta Yucateca de Arturo Turriza',
      album: disc.title,
    });
  }

  async function start() {
    state.loading = true;
    state.error = false;
    notify();
    try {
      await audio.play();
    } catch {
      state.loading = false;
      state.playing = false;
      state.error = true;
      notify();
    }
  }

  const api = {
    get state() {
      return { ...state };
    },
    /** @param {(state: Readonly<PlayerState>) => void} listener */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /**
     * Reproduce una pista; si ya es la actual, reanuda.
     * @param {number} disc
     * @param {number} [track]
     */
    play(disc, track = 0) {
      if (state.disc === disc && state.track === track && !state.error) {
        if (audio.paused) void start();
        return;
      }
      load(disc, track);
      void start();
    },
    toggle() {
      if (state.disc === null) return;
      if (audio.paused) void start();
      else audio.pause();
    },
    pause() {
      audio.pause();
    },
    next() {
      if (state.disc === null) return;
      const disc = discs[state.disc];
      if (state.track + 1 < disc.tracks.length) api.play(state.disc, state.track + 1);
      else api.play((state.disc + 1) % discs.length, 0);
    },
    prev() {
      if (state.disc === null) return;
      // Pasados unos segundos, "anterior" reinicia la pista; al inicio, va a la anterior.
      if (audio.currentTime > 3 || state.track === 0) {
        audio.currentTime = 0;
        return;
      }
      api.play(state.disc, state.track - 1);
    },
    /** @param {number} ratio 0–1 */
    seek(ratio) {
      if (state.disc === null || !Number.isFinite(audio.duration)) return;
      audio.currentTime = Math.min(1, Math.max(0, ratio)) * audio.duration;
    },
    close() {
      audio.pause();
      audio.src = '';
      state.disc = null;
      state.track = 0;
      state.current = 0;
      state.playing = false;
      state.loading = false;
      bus?.emit('player:close');
      notify();
    },
  };

  audio.addEventListener('playing', () => {
    state.playing = true;
    state.loading = false;
    bus?.emit('player:play', api.state);
    notify();
  });
  audio.addEventListener('pause', () => {
    state.playing = false;
    bus?.emit('player:pause', api.state);
    notify();
  });
  audio.addEventListener('waiting', () => {
    state.loading = true;
    notify();
  });
  audio.addEventListener('timeupdate', () => {
    state.current = audio.currentTime;
    if (Number.isFinite(audio.duration)) state.duration = audio.duration;
    bus?.emit('player:progress', api.state);
    notify();
  });
  audio.addEventListener('ended', () => {
    if (state.disc === null) return;
    const last = state.track + 1 >= discs[state.disc].tracks.length;
    // Al terminar la última pista del disco, se detiene; con más pistas, sigue sola.
    if (last) {
      state.playing = false;
      state.current = 0;
      notify();
    } else api.next();
  });
  audio.addEventListener('error', () => {
    if (state.disc === null) return;
    state.error = true;
    state.playing = false;
    state.loading = false;
    notify();
  });

  if ('mediaSession' in navigator) {
    const handlers = /** @type {const} */ ({
      play: () => api.toggle(),
      pause: () => api.pause(),
      nexttrack: () => api.next(),
      previoustrack: () => api.prev(),
    });
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(
          /** @type {MediaSessionAction} */ (action),
          handler,
        );
      } catch {
        // Acción no soportada por este navegador: se ignora.
      }
    }
  }
  return api;
}
