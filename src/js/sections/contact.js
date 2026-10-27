// @ts-check
import { placeMode, todayISO, trimContact } from '../lib/contact.js';
import { countryNames, createStateLookup } from '../lib/places.js';
import { validateContact } from '../lib/validate.js';
import { buildMessage, waUrl } from '../lib/whatsapp.js';

/**
 * @typedef {import('../lib/contact.js').ContactData} ContactData
 * @typedef {import('../lib/contact.js').PlaceMode} PlaceMode
 * @typedef {{
 *   whatsapp: string,
 *   capital: string,
 *   peninsula: string[],
 *   articles: Record<'vaqueria' | 'privado', string>,
 *   placeholders: Record<string, string>,
 *   labels: Record<string, string>,
 *   message: import('../lib/whatsapp.js').MessageText,
 *   errors: import('../lib/validate.js').ErrorText,
 *   sent: { ok: string, again: string },
 * }} LetterData
 * @typedef {'name' | 'detail' | 'date' | 'locality' | 'municipality' | 'state' | 'country' | 'phone' | 'message'} FieldName
 * @typedef {{ municipality?: string, state?: string, delay?: number }} Prefill `delay` espera a que
 *   termine el desplazamiento antes de enfocar un campo (ms)
 */

/** Campos obligatorios siempre (el detalle y el país dependen de otras respuestas). */
const REQUIRED = /** @type {const} */ (['name', 'date', 'municipality', 'state', 'phone']);
/** Orden para enfocar el primer campo vacío al llegar desde el mapa o Fovi (CON-8). */
const FOCUS_ORDER = /** @type {const} */ (['name', 'date', 'municipality', 'state', 'phone']);

/**
 * Abre WhatsApp en otra pestaña con un enlace real: el navegador lo permite porque ocurre
 * dentro del gesto del usuario (el envío del formulario).
 * @param {string} url
 */
function openInNewTab(url) {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
}

/**
 * @template {Element} T
 * @param {ParentNode} root
 * @param {string} selector
 * @param {new () => T} type
 * @returns {T}
 */
function find(root, selector, type) {
  const el = root.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`Falta ${selector} en la carta de contacto`);
  return el;
}

/**
 * Activa la carta de contacto (CON-2…8) sobre el formulario generado en el build.
 * @param {HTMLFormElement} form
 * @param {{ now?: () => Date, open?: (url: string) => void }} [options]
 *   `now` y `open` se inyectan para las pruebas.
 * @returns {{ prefill: (place: Prefill) => void }}
 */
export function initContact(form, { now = () => new Date(), open = openInNewTab } = {}) {
  const data = /** @type {LetterData} */ (
    JSON.parse(find(form, '[data-letter-data]', HTMLScriptElement).textContent ?? '{}')
  );
  const letter = find(form, '[data-letter]', HTMLElement);
  const note = find(form, '[data-note]', HTMLElement);
  const article = find(letter, '[data-article]', HTMLElement);
  const detailWrap = find(letter, '[data-detail]', HTMLElement);
  const countryLine = find(letter, '[data-country]', HTMLElement);
  const fallback = find(form, 'textarea[name="text"]', HTMLTextAreaElement);
  const countryList = find(letter, '#ct-countries', HTMLDataListElement);

  /** @type {Record<FieldName, HTMLInputElement | HTMLSelectElement>} */
  const fields = /** @type {any} */ (
    Object.fromEntries(
      [...letter.querySelectorAll('[data-field]')].map((el) => [
        /** @type {HTMLElement} */ (el).dataset.field,
        el,
      ]),
    )
  );
  /** @param {FieldName} name */
  const input = (name) => /** @type {HTMLInputElement} */ (fields[name]);
  const labelOf = (/** @type {FieldName} */ name) =>
    find(letter, `[data-label="${name}"]`, HTMLLabelElement);
  const radios = /** @type {HTMLInputElement[]} */ ([
    ...letter.querySelectorAll('input[name="event-type"]'),
  ]);
  const stateOf = createStateLookup(
    [...letter.querySelectorAll('#ct-municipalities option')].map((option) => ({
      name: /** @type {HTMLOptionElement} */ (option).value,
      state: /** @type {HTMLOptionElement} */ (option).label,
    })),
  );
  /** El estado se llenó solo a partir del municipio y se puede volver a cambiar solo. */
  let stateIsAuto = false;

  const eventType = () =>
    /** @type {'vaqueria' | 'privado'} */ (radios.find((r) => r.checked)?.value ?? 'vaqueria');

  function updateEventType() {
    const isPrivate = eventType() === 'privado';
    article.textContent = data.articles[eventType()];
    detailWrap.hidden = !isPrivate;
    input('detail').disabled = !isPrivate;
    input('detail').required = isPrivate;
    if (!isPrivate) clearError(input('detail'));
  }

  function fillCountries() {
    if (countryList.childElementCount) return;
    try {
      const names = new Intl.DisplayNames(['es'], { type: 'region', fallback: 'none' });
      for (const name of countryNames((code) => names.of(code))) {
        const option = document.createElement('option');
        option.value = name;
        countryList.append(option);
      }
    } catch {
      // Sin Intl.DisplayNames el campo sigue funcionando, solo sin sugerencias.
    }
  }

  function updatePlace() {
    const mode = placeMode(fields.state.value, data.capital);
    const abroad = mode === 'abroad';
    countryLine.hidden = !abroad;
    input('country').disabled = !abroad;
    input('country').required = abroad;
    if (abroad) fillCountries();
    else input('country').value = '';

    const place = abroad ? 'city' : mode === 'capital' ? 'alcaldia' : 'municipality';
    input('municipality').placeholder = data.placeholders[place];
    labelOf('municipality').textContent = data.labels[place];
    const locality = abroad ? 'localityAbroad' : 'locality';
    input('locality').placeholder = data.placeholders[locality];
    labelOf('locality').textContent = data.labels[locality];
    input('phone').placeholder = data.placeholders[abroad ? 'phoneAbroad' : 'phone'];

    // Las sugerencias son municipios de la península: solo tienen sentido ahí (CON-4).
    const state = fields.state.value;
    if (!state || data.peninsula.includes(state))
      input('municipality').setAttribute('list', 'ct-municipalities');
    else input('municipality').removeAttribute('list');
    fitPlace();
  }

  /**
   * Escritorio (prototipo `ctPlace`): el estado abraza el texto elegido y el municipio toma el
   * resto del renglón. En la carta fluida (móvil) los anchos los pone el CSS.
   */
  function fitPlace() {
    const select = /** @type {HTMLSelectElement} */ (fields.state);
    const mun = input('municipality');
    if (
      !window.matchMedia('(width >= 48em)').matches ||
      !document.documentElement.classList.contains('js')
    ) {
      select.style.width = '';
      mun.style.width = '';
      return;
    }
    const cs = getComputedStyle(select);
    const u = parseFloat(cs.fontSize) / 28;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return;
    ctx.font = `italic 600 ${cs.fontSize} ${cs.fontFamily}`;
    const option =
      select.selectedIndex > 0 ? select.options[select.selectedIndex].text : select.options[0].text;
    const sw = Math.ceil(ctx.measureText(option).width) + 48 * u;
    select.style.width = `${sw}px`;
    const pw = mun.parentElement?.clientWidth ?? 0;
    if (pw) mun.style.width = `${Math.max(150 * u, pw - sw - 36 * u)}px`;
  }

  /** @param {HTMLInputElement | HTMLSelectElement} el */
  function clearError(el) {
    el.setCustomValidity('');
    el.removeAttribute('aria-invalid');
  }

  function syncStateFromMunicipality() {
    const state = stateOf(fields.municipality.value);
    if (state && (!fields.state.value || stateIsAuto)) {
      fields.state.value = state;
      stateIsAuto = true;
      clearError(fields.state);
      updatePlace();
    }
  }

  /** @returns {ContactData} */
  function readData() {
    return trimContact({
      name: fields.name.value,
      eventType: eventType(),
      detail: fields.detail.value,
      date: fields.date.value,
      locality: fields.locality.value,
      municipality: fields.municipality.value,
      state: fields.state.value,
      country: fields.country.value,
      phone: fields.phone.value,
      message: fields.message.value,
    });
  }

  /** @param {string} url */
  function showSent(url) {
    const again = document.createElement('a');
    again.href = url;
    again.target = '_blank';
    again.rel = 'noopener';
    again.textContent = data.sent.again;
    note.replaceChildren(`${data.sent.ok} `, again);
    note.classList.add('letter__note--ok');
  }

  /** @param {SubmitEvent} event */
  function submit(event) {
    event.preventDefault();
    if (!fields.state.value) syncStateFromMunicipality();
    const values = readData();
    for (const [name, value] of Object.entries(values)) {
      const el = fields[/** @type {FieldName} */ (name)];
      if (el instanceof HTMLInputElement) el.value = value;
    }
    const errors = validateContact(values, {
      today: todayISO(now()),
      errors: data.errors,
      capital: data.capital,
    });
    Object.values(fields).forEach(clearError);
    for (const { field, message } of errors) {
      fields[field].setCustomValidity(message);
      fields[field].setAttribute('aria-invalid', 'true');
    }
    if (errors.length) {
      const first = fields[errors[0].field];
      first.focus();
      first.reportValidity();
      return;
    }
    const url = waUrl(data.whatsapp, buildMessage(values, data.message, data.capital));
    open(url);
    showSent(url);
  }

  /** @param {Prefill} place */
  function prefill({ municipality, state, delay = 0 }) {
    if (municipality !== undefined) fields.municipality.value = municipality;
    if (state !== undefined) {
      fields.state.value = state;
      stateIsAuto = false;
    }
    updatePlace();
    const empty = FOCUS_ORDER.map((name) => fields[name]).find((el) => !el.value);
    const focus = () => (empty ?? fields.name).focus({ preventScroll: true });
    if (delay > 0) setTimeout(focus, delay);
    else focus();
  }

  // La carta reemplaza al formulario de respaldo: se habilita y se valida con JS.
  form.noValidate = true;
  fallback.disabled = true;
  for (const el of [...Object.values(fields), ...radios]) el.disabled = false;
  for (const name of REQUIRED) fields[name].required = true;
  input('date').min = todayISO(now());
  updateEventType();
  updatePlace();
  document.fonts?.ready.then(fitPlace);
  window.addEventListener('resize', fitPlace);

  for (const radio of radios) radio.addEventListener('change', updateEventType);
  fields.municipality.addEventListener('input', syncStateFromMunicipality);
  fields.state.addEventListener('change', () => {
    stateIsAuto = false;
    updatePlace();
  });
  for (const el of Object.values(fields)) {
    el.addEventListener('input', () => clearError(el));
    el.addEventListener('change', () => clearError(el));
  }
  form.addEventListener('submit', submit);
  document.addEventListener('contact:prefill', (event) =>
    prefill(/** @type {CustomEvent<Prefill>} */ (event).detail ?? {}),
  );

  return { prefill };
}
