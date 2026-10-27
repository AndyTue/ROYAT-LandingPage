// @ts-check
import { PANELS } from '../js/journey/layout-data.js';
import { fill, pad2 } from '../js/lib/format.js';
import { stitchSvg } from '../js/stitch/svg.js';
import { html, raw } from './html.js';
import { picture } from './partials/picture.js';

/**
 * Recorrido del prototipo (ADR-010): el Hero y una sola pista horizontal con Historia,
 * Integrantes, ¡Preciosooo! y Vocalistas. Las posiciones salen de `layout-data.js` (extraídas
 * del prototipo); los textos y las fotos, de `content/*.json`. Sin JS, en móvil o con
 * reduced-motion, las mismas piezas se leen en columna (`journey.css`).
 *
 * @typedef {import('./context.js').RenderContext} RenderContext
 * @typedef {typeof PANELS[number]} Panel
 * @typedef {any} Piece
 * @typedef {{ src: string, alt: string, caption?: string }} Photo
 * @typedef {{ n: number, name: string, role: string, photo: string }} Member
 */

/**
 * Atributos de posición y movimiento de una pieza (los aplica `sections/journey.js`).
 * @param {any} p
 * @returns {Record<string, string>}
 */
function atData(p) {
  /** @type {Record<string, string>} */
  const out = {};
  const box = [p.x, p.y, p.w, p.h, p.fs].map((v) => (v === undefined ? '' : String(v)));
  const value = box.join(' ').trimEnd();
  if (value) out['data-at'] = value;
  for (const key of ['k', 'vy', 'r', 'spin', 'lt'])
    if (p[key] !== undefined) out[`data-${key}`] = String(p[key]);
  return out;
}

/** @param {any} p */
const at = (p) =>
  raw(
    Object.entries(atData(p))
      .map(([k, v]) => ` ${k}="${v}"`)
      .join(''),
  );

/** Hueco de bordado (`features/ornaments.js` lo llena). */
function stitch(/** @type {any} */ p) {
  const extra = [p.flip && ` data-flip="${p.flip}"`, p.map && ` data-map="${p.map}"`].filter(
    Boolean,
  );
  const cls = p.cls.includes('xd') ? 'j-xs j-xd' : 'j-xs';
  return html`<span class="ornament ${cls}" data-ornament data-motif="${p.m}" data-order="${p.ord}"${raw(extra.join(''))}${at(p)} aria-hidden="true"></span>`;
}

/** Texto en renglones (`<br>` del diseño) si coincide con el contenido; si no, tal cual. */
function lines(/** @type {string} */ text, /** @type {string[] | undefined} */ hint) {
  const flat = (/** @type {string} */ s) => s.replace(/-\s*/g, '').replace(/\s+/g, ' ').trim();
  if (!hint || flat(hint.join(' ')).toLowerCase() !== flat(text).toLowerCase()) return text;
  // Un renglón partido con guion («Percu-») lo marca para que el móvil pueda unirlo de nuevo.
  return raw(
    hint
      .map((l) =>
        l.endsWith('-')
          ? `${html`${l.slice(0, -1)}`}<span class="j-hy">-</span>`
          : String(html`${l}`),
      )
      .join('<br>'),
  );
}

/** Título dividido en renglones con letras que se juntan (`data-lt`). */
function split(/** @type {string[]} */ rows, /** @type {Piece} */ p) {
  return (p.kids ?? []).map(
    (/** @type {any} */ kid, /** @type {number} */ i) =>
      html`<span class="j-split__row" aria-hidden="true"${at({ x: kid.x, k: kid.k, lt: kid.lt })}>${rows[i] ?? ''}</span>`,
  );
}

/**
 * Foto enmarcada: `.j-fig` (foto sobre la tela) o `.j-pf` (foto con marco cosido).
 * @param {RenderContext} ctx
 * @param {Piece} p
 * @param {Photo} photo
 * @param {string} sizes
 * @param {any} [caption] HTML del pie
 */
function frame(ctx, p, photo, sizes, caption = '') {
  const fr = p.kids?.find((/** @type {any} */ k) => /frame/.test(k.cls)) ?? {};
  const img = p.kids?.find((/** @type {any} */ k) => k.tag === 'img') ?? {};
  const kind = p.cls.split(' ')[0];
  const mods = /** @type {string[]} */ (
    fr.cls?.replace('frame', '').trim().split(/\s+/).filter(Boolean) ?? []
  );
  return html`<figure class="j-${kind}${p.cls.includes('sm') ? ' j-pf--sm' : ' j-rv'}"${at(p)}>
    <div class="j-frame${mods.map((/** @type {string} */ m) => ` j-frame--${m}`).join('')}"${at({ h: fr.h })}>
      ${picture(ctx, { src: photo.src, alt: photo.alt, sizes, className: 'j-frame__img', data: img.k !== undefined ? { 'data-k': String(img.k) } : {} })}
    </div>
    ${caption}
  </figure>`;
}

/** Pie con número, nombre y rol (`.cap` del prototipo). */
const memberCap = (
  /** @type {string} */ num,
  /** @type {string} */ name,
  /** @type {string} */ role,
) =>
  html`<figcaption class="j-cap"><span class="j-num">${num}</span><span><b>${name}</b><small>${role}</small></span></figcaption>`;

/** Marcador del hilo: la X bordada y el número del hito. */
const marker = (/** @type {Piece} */ p, /** @type {number} */ n) =>
  html`<p class="j-mk" aria-hidden="true"${at(p)}><svg width="24" height="24" viewBox="0 0 24 24" focusable="false"><path d="M5 5l14 14M19 5L5 19"/></svg>${pad2(n)}</p>`;

/** @param {RenderContext} ctx @param {Panel} panel */
function historyIntro(ctx, panel) {
  const { history: data, ui } = ctx.content;
  return panel.items.map((p) => {
    const kind = p.cls.split(' ')[0];
    if (p.tag === 'canvas') return stitch(p);
    if (kind === 'split')
      return html`<h2 class="j-split" id="historia-titulo"${at(p)}><span class="sr-only">${data.title}</span>${split(ui.history.titleLines, p)}</h2>`;
    if (kind === 'klab')
      return html`<p class="j-klab j-klab--fg2 j-rv"${at(p)}>${lines(data.kicker, p.lines)}</p>`;
    if (kind === 'fig')
      return frame(
        ctx,
        p,
        data.intro.photo,
        '(width >= 48em) 37vw, 92vw',
        html`<figcaption class="j-fcap">${data.intro.photo.caption}</figcaption>`,
      );
    if (kind === 'cols')
      return html`<div class="j-cols j-rv"${at(p)}>${data.intro.paragraphs.map((/** @type {string} */ t) => html`<p>${t}</p>`)}</div>`;
    return '';
  });
}

/** @param {RenderContext} ctx @param {Panel} panel */
function timeline(ctx, panel) {
  const { history: data, discography, ui } = ctx.content;
  const events = /** @type {any[]} */ (data.events);
  /** @type {any[][]} */
  const groups = events.map(() => []);
  /** @type {any[]} */
  const loose = [];
  let e = 0;
  let photo = 0;
  let disc = 0;
  for (const p of panel.items) {
    const kind = p.cls.split(' ')[0];
    const ev = events[Math.min(e, events.length - 1)];
    if (p.tag === 'canvas') {
      loose.push(stitch(p));
      continue;
    }
    if (kind === 'axis') {
      loose.push(html`<span class="j-axis" aria-hidden="true"></span>`);
      continue;
    }
    const out = groups[Math.min(e, events.length - 1)];
    if (p.tag === 'img' && ev.badge) {
      out.push(
        picture(ctx, {
          src: ev.badge.src,
          alt: ev.badge.alt,
          sizes: '12rem',
          className: 'j-badge',
          data: atData(p),
        }),
      );
    } else if (kind === 'yr') {
      out.push(html`<p class="j-yr"${at(p)}>${ev.year}</p>`);
    } else if (kind === 'pf') {
      const ph = ev.photos[photo++];
      if (ph)
        out.push(
          frame(
            ctx,
            p,
            ph,
            p.cls.includes('sm') ? '16rem' : '(width >= 48em) 30vw, 92vw',
            ph.caption ? html`<figcaption class="j-pc">${ph.caption}</figcaption>` : '',
          ),
        );
    } else if (kind === 'vin') {
      const ref = ev.discs?.[disc++];
      const d =
        ref && discography.discs.find((/** @type {any} */ x) => x.spotifyId === ref.spotifyId);
      if (d)
        out.push(
          html`<span class="j-vin" role="img" aria-label="${fill(ui.history.coverAlt, { title: ref.label })}"${at(p)}><span class="j-vin__lab" data-color="${d.color}">${picture(ctx, { src: d.cover, alt: '', sizes: '20rem' })}</span><span class="j-vin__hole"></span></span>`,
        );
    } else if (kind === 'tt') {
      out.push(
        html`<div class="j-tt j-rv"${at(p)}><p class="j-tag j-tag--${ev.discs?.length ? 'sp' : 'dt'}">${ev.tag}</p><h3 id="hito-${ev.n}-titulo">${ev.title}</h3><p>${ev.text}</p></div>`,
      );
    } else if (kind === 'mk') {
      out.push(marker(p, ev.n));
      e++;
      photo = 0;
      disc = 0;
    }
  }
  return html`${loose}<ol class="j-timeline" aria-label="${ui.history.timelineLabel}">
    ${groups.map((g, i) => html`<li class="j-event" id="hito-${events[i].n}">${g}</li>`)}
  </ol>`;
}

/** @param {RenderContext} ctx @param {Panel} panel */
function membersIntro(ctx, panel) {
  const { members: data, ui } = ctx.content;
  return panel.items.map((p) => {
    const kind = p.cls.split(' ')[0];
    if (p.tag === 'canvas') return stitch(p);
    if (kind === 'split')
      return html`<h2 class="j-split" id="integrantes-titulo"${at(p)}><span class="sr-only">${data.title}</span>${split(ui.members.titleLines, p)}</h2>`;
    if (kind === 'klab')
      return html`<p class="j-klab j-klab--fg2 j-rv"${at(p)}>${lines(data.kicker, p.lines)}</p>`;
    if (kind === 'fig')
      return frame(
        ctx,
        p,
        data.groupPhoto,
        '(width >= 48em) 36vw, 92vw',
        html`<figcaption class="j-fcap">${data.groupPhoto.caption}</figcaption>`,
      );
    if (p.tag === 'ol')
      return html`<ol class="j-index j-rv"${at(p)}>${data.sections.map((/** @type {any} */ s) => html`<li>${s.numeral} ${s.name}</li>`)}</ol>`;
    return '';
  });
}

/** @param {RenderContext} ctx @param {Panel} panel */
function director(ctx, panel) {
  const { members: data, ui } = ctx.content;
  const m = /** @type {Member} */ (data.director);
  const [first, ...rest] = m.name.split(' ');
  return panel.items.map((p) => {
    const kind = p.cls.split(' ')[0];
    if (p.tag === 'canvas') return stitch(p);
    if (kind === 'fig')
      return frame(ctx, p, { src: m.photo, alt: m.name }, '(width >= 48em) 26svh, 80vw');
    if (kind === 'num')
      return html`<p class="j-num j-num--big"${at(p)} aria-hidden="true">${pad2(m.n)}</p>`;
    if (p.tag === 'h3')
      return html`<h3 class="j-dname"${at(p)}><span class="sr-only">${ui.members.directorLabel}: ${m.name}</span><span aria-hidden="true">${first}<br>${rest.join(' ')}</span></h3>`;
    if (kind === 'klab') return html`<p class="j-klab j-klab--fg2"${at(p)}>${m.role}</p>`;
    if (kind === 'stitch') return html`<span class="j-stitch" aria-hidden="true"${at(p)}></span>`;
    return '';
  });
}

/** @param {string} name */
const slug = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** @param {RenderContext} ctx @param {Panel} panel @param {any} section */
function band(ctx, panel, section) {
  let m = -1;
  return panel.items.map((p) => {
    const kind = p.cls.split(' ')[0];
    if (p.tag === 'canvas') return stitch(p);
    if (kind === 'rn')
      return html`<p class="j-rn" aria-hidden="true"${at(p)}>${section.numeral}</p>`;
    if (kind === 'sname')
      return html`<h3 class="j-sname" id="seccion-${slug(section.name)}-titulo"${at(p)}><span class="sr-only">${section.numeral} ${section.name}</span><span aria-hidden="true">${lines(section.name, p.lines)}</span></h3>`;
    if (kind === 'scount') return html`<p class="j-scount"${at(p)}>${section.count}</p>`;
    if (kind === 'stitch') return html`<span class="j-stitch" aria-hidden="true"${at(p)}></span>`;
    if (kind === 'fig') {
      if (m < 0) {
        m++;
        return frame(ctx, p, section.groupPhoto, '(width >= 48em) 25svh, 92vw');
      }
      const member = /** @type {Member} */ (section.members[m++]);
      if (!member) return '';
      return frame(
        ctx,
        p,
        { src: member.photo, alt: member.name },
        '(width >= 48em) 18svh, 46vw',
        memberCap(pad2(member.n), member.name, member.role),
      );
    }
    return '';
  });
}

/** @param {RenderContext} ctx @param {Panel} panel */
function glossary(ctx, panel) {
  const { glossary: data } = ctx.content;
  const title = String(data.title);
  const head = title.replace(/o+$/, '');
  const os = title.length - head.length;
  let card = 0;
  /** @type {any[]} */
  const cards = [];
  const out = panel.items.map((p) => {
    const kind = p.cls.split(' ')[0];
    if (p.tag === 'canvas') return stitch(p);
    if (kind === 'word')
      return html`<h3 class="j-word" id="glosario-titulo"${at(p)}><span class="sr-only">${title}</span><span aria-hidden="true">${head}${Array.from({ length: Math.max(0, os - 1) }, () => html`<span class="j-oo">o</span>`)}${picture(ctx, { src: 'assets-src/brand/simbolo.png', alt: '', sizes: '40svh', className: 'j-oo j-oo--logo' })}</span></h3>`;
    if (kind === 'card') {
      const item = data.items[card++];
      if (!item) return '';
      const tone = p.cls.split(' ')[1].slice(1);
      cards.push(
        html`<div class="j-card j-rv j-card--${tone}${p.cls.includes('back') ? ' j-card--back' : ''}"${at(p)}><dt>${item.term}</dt><dd>${item.text}</dd></div>`,
      );
      return '';
    }
    return '';
  });
  // Dos listas (columnas del móvil: impares a la izquierda, pares a la derecha); en escritorio cada
  // sobre va en su lugar absoluto y las listas no se ven.
  return html`${out}<dl class="j-glossary j-glossary--l">${cards.filter((_, i) => i % 2 === 0)}</dl><dl class="j-glossary j-glossary--r">${cards.filter((_, i) => i % 2 === 1)}</dl>`;
}

/** @param {RenderContext} ctx @param {Panel} panel @param {any} section */
function vocalists(ctx, panel, section) {
  const { ui } = ctx.content;
  const v = ui.members.vocalists;
  let fig = -1;
  return panel.items.map((p) => {
    const kind = p.cls.split(' ')[0];
    if (p.tag === 'canvas') return stitch(p);
    if (kind === 'rn')
      return html`<p class="j-rn" aria-hidden="true"${at(p)}>${section.numeral}</p>`;
    if (kind === 'vtw')
      return html`<h3 class="j-vtw" id="seccion-${slug(section.name)}-titulo" data-vtw><span class="sr-only">${section.numeral} ${section.name}</span>${(p.kids ?? []).map((/** @type {any} */ k, /** @type {number} */ i) => html`<span class="j-vt${k.cls.includes('it') ? ' j-vt--it' : ''}" aria-hidden="true"${at(k)}>${v.titleLines[i] ?? ''}</span>`)}</h3>`;
    if (kind === 'vcap')
      return html`<p class="j-vcap" data-vcap${at(p)}>${lines(v.caption, p.lines)}</p>`;
    if (kind === 'vfig') {
      fig++;
      const fr = p.kids?.[0] ?? {};
      const isGroup = fig === 0;
      const member = isGroup ? null : /** @type {Member} */ (section.members[fig - 1]);
      const photo = isGroup
        ? section.groupPhoto
        : { src: member?.photo ?? '', alt: member?.name ?? '' };
      if (!photo.src) return '';
      return html`<figure class="j-vfig j-rv" data-vfig data-vfig-y="${p.vy0 ?? 0}"${at({ x: p.x, w: p.w })}>
        <div class="j-vframe"${at({ h: fr.h })}>${picture(ctx, { src: photo.src, alt: photo.alt, sizes: '(width >= 48em) 20svh, 46vw' })}</div>
        ${isGroup ? memberCap(section.numeral, v.groupTitle, v.groupRole) : memberCap(pad2(member?.n ?? 0), member?.name ?? '', member?.role ?? '')}
      </figure>`;
    }
    return '';
  });
}

/** @param {RenderContext} ctx */
function hero(ctx) {
  const { site, ui } = ctx.content;
  const { patterns } = ctx;
  const logo = stitchSvg(patterns.logo, patterns.pal, {
    id: 'hero-logo',
    label: ui.hero.logoLabel,
    className: 'hero__static',
    extra: ' data-hero-static',
  });
  return html`<section id="inicio" class="hero" aria-labelledby="hero-title" data-hero>
    <div class="hero__stage" data-hero-stage>
      <h1 id="hero-title" class="sr-only">${site.name}</h1>
      <canvas class="hero__canvas hero__rose" data-hero-rose="left" aria-hidden="true" hidden></canvas>
      <canvas class="hero__canvas hero__rose" data-hero-rose="right" aria-hidden="true" hidden></canvas>
      <canvas class="hero__canvas hero__garland" data-hero-garland="top" aria-hidden="true" hidden></canvas>
      <canvas class="hero__canvas hero__garland" data-hero-garland="bottom" aria-hidden="true" hidden></canvas>
      ${raw(logo)}
      <canvas class="hero__canvas hero__logo" data-hero-logo role="img" aria-label="${ui.hero.logoLabel}" hidden></canvas>
      ${picture(ctx, {
        src: site.heroPhoto.src,
        alt: site.heroPhoto.alt,
        sizes: '(width >= 48em) 66vw, 100vw',
        eager: true,
        className: 'hero__crew',
        data: { 'data-hero-crew': '' },
      })}
      <p class="hero__cue" data-hero-cue aria-hidden="true">${ui.hero.scrollCue}<i></i></p>
      <button class="hero__skip" type="button" data-hero-skip hidden>${ui.hero.skipIntro}</button>
    </div>
  </section>`;
}

/**
 * @param {RenderContext} ctx
 */
export function journey(ctx) {
  const { members: data } = ctx.content;
  const sections = /** @type {any[]} */ (data.sections);
  const panel = (/** @type {number} */ i) => PANELS[i];
  /**
   * @param {Panel} p
   * @param {any} body
   * @param {{ id?: string, labelledby?: string, tag?: string }} [o]
   */
  const wrap = (p, body, o = {}) => {
    const tag = o.tag ?? 'section';
    const id = o.id ? ` id="${o.id}"` : '';
    const label = o.labelledby ? ` aria-labelledby="${o.labelledby}"` : ` aria-label="${p.label}"`;
    return html`<${raw(tag)} class="j-panel"${raw(id)} data-tone="${p.tone}" data-at="0 0 ${p.w}"${raw(label)}>${body}</${raw(tag)}>`;
  };
  const bands = sections.slice(0, 4).map((s, i) =>
    wrap(panel(4 + i), band(ctx, panel(4 + i), s), {
      id: `seccion-${slug(s.name)}`,
      labelledby: `seccion-${slug(s.name)}-titulo`,
    }),
  );
  const vocals = sections[4];
  return html`<div class="journey" data-journey>
    <div class="journey__stick" data-journey-stick>
      ${hero(ctx)}
      <div class="j-track" data-journey-track>
        ${wrap(panel(0), html`<canvas class="j-mhem" data-hem-m aria-hidden="true" hidden></canvas>${historyIntro(ctx, panel(0))}`, { id: 'historia', labelledby: 'historia-titulo' })}
        ${wrap(panel(1), timeline(ctx, panel(1)))}
        ${wrap(panel(2), html`<canvas class="j-mhem" data-hem-m aria-hidden="true" hidden></canvas>${membersIntro(ctx, panel(2))}`, { id: 'integrantes', labelledby: 'integrantes-titulo' })}
        ${wrap(panel(3), director(ctx, panel(3)), { tag: 'article' })}
        ${bands}
        ${wrap(panel(8), glossary(ctx, panel(8)), { tag: 'aside', labelledby: 'glosario-titulo' })}
        ${wrap(panel(9), vocalists(ctx, panel(9), vocals), { id: `seccion-${slug(vocals.name)}`, labelledby: `seccion-${slug(vocals.name)}-titulo` })}
      </div>
    </div>
  </div>`;
}
