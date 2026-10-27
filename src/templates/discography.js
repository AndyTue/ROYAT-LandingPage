// @ts-check
import { stitchBandSvg } from '../js/stitch/svg.js';
import { albumMinutes, fill, formatDuration, isoDuration } from '../js/lib/format.js';
import { html, raw } from './html.js';
import { picture } from './partials/picture.js';

/** @typedef {import('./context.js').RenderContext} RenderContext */
/**
 * @typedef {{ title: string, durationSec: number, guest?: string }} Track
 * @typedef {{ spotifyId: string, title: string, type: string, year: number, color: string, cover: string, tracks: Track[] }} Disc
 */

/** @param {string} spotifyId */
export const spotifyAlbumUrl = (spotifyId) => `https://open.spotify.com/album/${spotifyId}`;

const ARROW = {
  prev: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
};

/**
 * Ficha estática de un disco (sin JS y para lectores de pantalla): portada, datos, enlace a
 * Spotify y la lista de pistas.
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
        sizes: '(width >= 48em) 14rem, 40vw',
        className: 'disc__cover',
      })}
      <div class="disc__info">
        <p class="disc__eyebrow label">${disc.type} · ${disc.year}</p>
        <h3 class="disc__title" id="${id}-titulo">${disc.title}</h3>
        <dl class="disc__meta">
          <div><dt>${t.meta.tracks}</dt><dd>${disc.tracks.length}</dd></div>
          <div><dt>${t.meta.duration}</dt><dd>${albumMinutes(disc.tracks)}</dd></div>
        </dl>
        <a class="button" href="${spotifyAlbumUrl(disc.spotifyId)}" target="_blank" rel="noopener">${t.spotify} <span class="sr-only">${ui.contact.newTab}</span></a>
        <details class="disc__tracks">
          <summary>${t.meta.tracks}</summary>
          <ol class="tracks">
            ${disc.tracks.map(
              (track) => html`<li class="track">
                <span class="track__title">${track.title}${track.guest && html` <small class="track__guest">${track.guest}</small>`}</span>
                <time class="track__time" datetime="${isoDuration(track.durationSec)}">${formatDuration(track.durationSec)}</time>
              </li>`,
            )}
          </ol>
        </details>
      </div>
    </article>
  </li>`;
}

/** Base del tocadiscos (prototipo `.deck`), compartida por la galería y la ficha. */
export const deckParts = () =>
  raw(
    '<span class="turntable__ground"></span><span class="turntable__side"></span><span class="turntable__seam"></span>' +
      '<span class="turntable__brand">ROYAT</span><span class="turntable__platter"><span class="turntable__dots"></span><span class="turntable__mat"></span></span>' +
      '<span class="turntable__pitch"><span class="turntable__knob"></span></span>' +
      '<span class="turntable__ctrl turntable__ctrl--start"><span class="turntable__key"></span><span class="turntable__led"></span></span>' +
      '<span class="turntable__ctrl turntable__ctrl--speed"><span class="turntable__key is-on">33</span><span class="turntable__key">45</span></span>' +
      '<span class="turntable__pivot"></span><span class="turntable__rest"></span>',
  );

/**
 * Vinilo de la galería (prototipo `.disc`): sombra, canto, la cara con surcos y la portada como
 * etiqueta, y el brillo. `g-roll` gira la etiqueta según la distancia al centro.
 * @param {RenderContext} ctx
 * @param {Disc} disc
 * @param {number} index
 */
function galleryDisc(ctx, disc, index) {
  return html`<button class="g-disc" type="button" data-i="${index}" aria-label="${disc.title}${disc.type === 'Sencillo' ? '' : ` · ${disc.type}`}">
    <span class="g-lift"><span class="g-cast"></span><span class="g-edge"></span><span class="g-vwrap"><span class="g-vinyl"><span class="g-roll" data-g-roll><span class="g-spin"><span class="g-face"><span class="g-label" data-color="${disc.color}">${picture(ctx, { src: disc.cover, alt: '', sizes: '(width >= 48em) 22svh, 36vw', className: 'g-cover' })}</span><span class="g-hole"></span></span></span></span><span class="g-sheen"></span></span></span></span>
  </button>`;
}

/**
 * Barra del reproductor (DIS-4): vacía hasta que suena algo.
 * @param {RenderContext} ctx
 */
function playerBar(ctx) {
  const p = ctx.content.ui.discography.player;
  return html`<section class="pbar" data-player hidden aria-label="${p.label}">
    <button class="pbar__disc" type="button" data-p-now aria-label="${p.goNow}">
      <span class="vinyl vinyl--mini" data-p-vinyl><span class="event__cover" data-p-cover></span></span>
      <span class="pbar__text"><b data-p-title>—</b><small data-p-sub>${p.idle}</small></span>
    </button>
    <div class="pbar__ctrl">
      <button class="pbtn" type="button" data-p-prev aria-label="${p.prev}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M18 6.5L9.5 12l8.5 5.5z"/><path d="M6.5 6v12"/></svg></button>
      <button class="pbtn pbtn--main" type="button" data-p-toggle aria-label="${p.play}"><svg class="i-play" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg><svg class="i-pause" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg></button>
      <button class="pbtn" type="button" data-p-next aria-label="${p.next}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6.5l8.5 5.5L6 17.5z"/><path d="M17.5 6v12"/></svg></button>
    </div>
    <div class="pbar__time"><span data-p-time>0:00 / 0:00</span><label class="pbar__seek"><span class="sr-only">${p.label}</span><span class="pbar__thread" aria-hidden="true"><i data-p-prog></i></span><input type="range" min="0" max="1000" value="0" step="1" data-p-seek></label></div>
    <button class="pbtn" type="button" data-p-info aria-label="${p.info}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg></button>
    <span class="pbar__sep" aria-hidden="true"></span>
    <button class="pbtn pbtn--close" type="button" data-p-close aria-label="${p.close}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <p class="pbar__error" role="status" data-p-error hidden>${p.error}</p>
  </section>`;
}

/**
 * Ficha de detalle (DIS-3): se clona y se llena al abrir un disco.
 * @param {RenderContext} ctx
 */
function detailTemplate(ctx) {
  const t = ctx.content.ui.discography;
  return html`<template data-detail-template>
    <div class="detail__head">
      <button class="detail__back" type="button" data-d-back>
        <span class="detail__back-icon"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></span>${t.back}
      </button>
      <span class="detail__mark" aria-hidden="true">ROYAT</span>
      <span class="detail__spacer" aria-hidden="true"></span>
    </div>
    <div class="detail__body">
      <div class="detail__left">
        <div class="detail__sleeve" data-d-sleeve></div>
        <span class="detail__ledge" aria-hidden="true"></span>
        <div class="turntable" data-d-deck aria-hidden="true">
          <div class="turntable__tilt">
            <div class="turntable__body">
              <span class="turntable__deck">${deckParts()}</span>
              <span class="turntable__rec"><span class="g-vinyl"><span class="g-spin"><span class="g-face"><span class="g-label" data-d-label></span><span class="g-hole"></span></span></span><span class="g-sheen"></span></span></span>
              <img class="turntable__arm" data-d-arm alt="" width="20" height="102" src="${ctx.asset('assets-src/ui/tonearm.svg')}">
            </div>
          </div>
        </div>
      </div>
      <article class="detail__info">
        <p class="detail__eyebrow" data-d-eyebrow></p>
        <h3 class="detail__title" data-d-title>…</h3>
        <dl class="detail__facts">
          <div><dt>${t.detail.facts.tracks}</dt><dd data-d-tracks-n></dd></div>
          <div><dt>${t.detail.facts.duration}</dt><dd data-d-duration></dd></div>
          <div><dt>${t.detail.facts.year}</dt><dd data-d-year></dd></div>
          <div><dt>${t.detail.facts.guests}</dt><dd data-d-guests></dd></div>
        </dl>
        <div class="detail__acts">
          <button class="btnl btnl--solid" type="button" data-d-play>…</button>
          <a class="btnl" href="#" data-d-spotify target="_blank" rel="noopener">${t.spotify} <span aria-hidden="true">↗</span></a>
        </div>
        <ol class="detail__tracks" data-d-tracks></ol>
      </article>
    </div>
    <nav class="detail__nav" aria-label="${t.title}">
      <button type="button" data-d-prev><small>← ${t.detail.prevDisc}</small><b></b></button>
      <button class="detail__nav-next" type="button" data-d-next><small>${t.detail.nextDisc} →</small><b></b></button>
    </nav>
  </template>`;
}

/**
 * Discografía (DIS-1…6). El HTML trae la lista completa de discos (se lee sin JS); con JS se
 * suma la galería de vinilos en arco, la ficha de detalle y el reproductor.
 * @param {RenderContext} ctx
 */
export function discography(ctx) {
  const { discography: data, ui, site } = ctx.content;
  const t = ui.discography;
  const discs = /** @type {Disc[]} */ (data.discs);
  const hem = stitchBandSvg(ctx.patterns.hem, ctx.patterns.pal, {
    id: 'disco-hem',
    cell: 6,
    className: 'disco__hem disco__hem--svg',
  });
  return html`<section id="discografia" class="discography" data-tone="paper" aria-labelledby="discografia-titulo" data-disco data-audio-base="${site.audio.baseUrl}" data-disco-text="${JSON.stringify({ detail: t.detail, coverAlt: t.coverAlt, player: t.player, meta: t.meta })}">
    <div class="disco__stage" data-disco-stage>
      ${raw(hem)}
      <h2 class="section-title disco__title" id="discografia-titulo">${t.title}</h2>
      <canvas class="disco__hem" data-hem aria-hidden="true" hidden></canvas>
      <div class="gal js-only" data-gallery role="group" tabindex="0" aria-label="${t.galleryLabel}">
        <div class="gal__head">
          <div class="gal__left">
            <p class="gal__eyebrow">${fill(t.eyebrow, { n: discs.length })}</p>
            <p class="gal__title" data-g-title aria-live="polite"></p>
            <button class="btnl" type="button" data-g-more>${t.moreInfo}</button>
            <p class="gal__hint"><span class="gal__hint--mouse">${t.hint}</span><span class="gal__hint--touch">${t.hintTouch}</span></p>
          </div>
          <div class="gal__side">
            <p class="gal__count"><b data-g-n>01</b> / ${discs.length}</p>
            <span class="gal__timer" aria-hidden="true"><i data-g-timer></i></span>
            <dl class="gal__meta" data-g-meta>
              <div class="gal__cue"><dt data-g-first-k>${t.meta.firstTrack}</dt><dd data-g-first></dd></div>
              <div><dt>${t.meta.year}</dt><dd data-g-year></dd></div>
              <div><dt>${t.meta.type}</dt><dd data-g-type></dd></div>
              <div><dt data-g-tracks-k>${t.meta.tracks}</dt><dd data-g-tracks></dd></div>
              <div><dt>${t.meta.duration}</dt><dd data-g-duration></dd></div>
            </dl>
          </div>
        </div>
        <div class="gal__stage" data-g-discs>
          <div class="g-disc g-deck-layer" data-g-deck aria-hidden="true"><span class="g-lift"><span class="turntable__deck g-deck">${deckParts()}</span></span></div>
          ${discs.map((d, i) => galleryDisc(ctx, d, i))}
          <div class="g-disc g-arm-layer" data-g-arm aria-hidden="true"><span class="g-lift"><img class="g-arm" alt="" width="20" height="102" src="${ctx.asset('assets-src/ui/tonearm.svg')}"></span></div>
        </div>
        <button class="gal__arrow gal__arrow--prev" type="button" data-g-prev aria-label="${t.prev}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${raw(ARROW.prev)}</svg></button>
        <button class="gal__arrow gal__arrow--next" type="button" data-g-next aria-label="${t.next}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${raw(ARROW.next)}</svg></button>
      </div>
      <ol class="discography__list">
        ${discs.map((d) => discCard(ctx, d))}
      </ol>
    </div>
    ${detailTemplate(ctx)}
    <div class="detail" data-disc-detail role="dialog" aria-modal="true" aria-label="${t.detail.label}" tabindex="-1" hidden></div>
  </section>
  ${playerBar(ctx)}`;
}
