// @ts-check
import { albumMinutes, fill, formatDuration, isoDuration } from '../js/lib/format.js';
import { html } from './html.js';
import { picture } from './partials/picture.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */
/**
 * @typedef {{ title: string, durationSec: number, guest?: string }} Track
 * @typedef {{ spotifyId: string, title: string, type: string, year: number, color: string, cover: string, tracks: Track[] }} Disc
 */

/** @param {string} spotifyId */
export const spotifyAlbumUrl = (spotifyId) => `https://open.spotify.com/album/${spotifyId}`;

/**
 * @param {RenderContext} ctx
 * @param {Disc} disc
 */
function discCard(ctx, disc) {
  const { ui } = ctx.content;
  const t = ui.discography;
  const id = `disco-${disc.spotifyId}`;
  return html`<li class="disc" id="${id}">
    <article class="disc__body" aria-labelledby="${id}-titulo">
      ${picture(ctx, {
        src: disc.cover,
        alt: fill(t.coverAlt, { title: disc.title }),
        sizes: '(min-width: 48em) 14rem, 40vw',
        className: 'disc__cover',
      })}
      <div class="disc__info">
        <p class="disc__eyebrow label">${disc.type} · ${disc.year}</p>
        <h3 class="disc__title" id="${id}-titulo">${disc.title}</h3>
        <dl class="disc__meta">
          <div>
            <dt>${t.meta.tracks}</dt>
            <dd>${disc.tracks.length}</dd>
          </div>
          <div>
            <dt>${t.meta.duration}</dt>
            <dd>${albumMinutes(disc.tracks)}</dd>
          </div>
        </dl>
        <a class="button" href="${spotifyAlbumUrl(disc.spotifyId)}" target="_blank" rel="noopener"
          >${t.spotify} <span class="sr-only">${ui.contact.newTab}</span></a
        >
        <details class="disc__tracks">
          <summary>${t.meta.tracks}</summary>
          <ol class="tracks">
            ${disc.tracks.map(
              (track) =>
                html`<li class="track">
                  <span class="track__title"
                    >${track.title}${track.guest && html` <small class="track__guest">${track.guest}</small>`}</span
                  >
                  <time class="track__time" datetime="${isoDuration(track.durationSec)}"
                    >${formatDuration(track.durationSec)}</time
                  >
                </li>`,
            )}
          </ol>
        </details>
      </div>
    </article>
  </li>`;
}

/**
 * Discografía (DIS-1…3, versión estática): los 10 lanzamientos con portada, datos, pistas y
 * enlace a Spotify. La galería en arco y el reproductor llegan en F9.
 * @param {RenderContext} ctx
 */
export function discography(ctx) {
  const { discography: data, ui } = ctx.content;
  return html`<section
    id="discografia"
    class="discography tone tone--paper"
    aria-labelledby="discografia-titulo"
  >
    <h2 class="section-title" id="discografia-titulo">${ui.discography.title}</h2>
    <ol class="discography__list">
      ${data.discs.map((/** @type {Disc} */ d) => discCard(ctx, d))}
    </ol>
  </section>`;
}
