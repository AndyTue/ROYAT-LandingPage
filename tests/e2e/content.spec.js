// @ts-check
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/** @param {string} name */
const read = (name) => JSON.parse(readFileSync(`content/${name}.json`, 'utf8'));
const history = read('history');
const members = read('members');
const discography = read('discography');
const places = read('places');
const glossary = read('glossary');

/** Textos que deben leerse en la página sin JavaScript (F3: "el contenido coincide al 100 %"). */
const EXPECTED = [
  history.title,
  ...history.intro.paragraphs,
  ...history.events.flatMap((/** @type {any} */ e) => [e.year, e.tag, e.title, e.text]),
  members.kicker,
  members.director.name,
  ...members.sections.flatMap((/** @type {any} */ s) => [
    s.name,
    ...s.members.flatMap((/** @type {any} */ m) => [m.name, m.role]),
  ]),
  ...glossary.items.flatMap((/** @type {any} */ g) => [g.term, g.text]),
  ...discography.discs.flatMap((/** @type {any} */ d) => [
    d.title,
    ...d.tracks.map((/** @type {any} */ t) => t.title),
  ]),
  ...places.places
    .filter((/** @type {any} */ p) => p.presence)
    .map((/** @type {any} */ p) => p.label),
];

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('todo el contenido de content/ se puede leer', async ({ page }) => {
    await page.goto('/');
    // Los <details> cerrados no exponen su texto como visible: se abren para leer las pistas.
    const text = await page.evaluate(() => {
      document.querySelectorAll('details').forEach((d) => (d.open = true));
      return document.body.innerText.replace(/\s+/g, ' ');
    });
    // innerText aplica text-transform (etiquetas en mayúsculas): se compara sin distinguir.
    const normalize = (/** @type {string} */ t) => t.replace(/\s+/g, ' ').toLocaleLowerCase('es');
    const visible = normalize(text);
    const missing = EXPECTED.filter((t) => !visible.includes(normalize(t)));
    expect(missing).toEqual([]);
  });

  test('la navegación lleva a cada sección', async ({ page }) => {
    await page.goto('/');
    const links = page.getByRole('navigation').getByRole('link');
    await expect(links).toHaveCount(6);
    for (const href of await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
      await expect(page.locator(/** @type {string} */ (href))).toHaveCount(1);
    }
  });

  test('el formulario de respaldo envía a WhatsApp', async ({ page }) => {
    await page.goto('/');
    const form = page.locator('form[data-contact-form]');
    await expect(form).toHaveAttribute('action', 'https://wa.me/529995893559');
    await expect(form.locator('textarea[name="text"]')).toBeVisible();
  });
});

test('no hay desplazamiento horizontal', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('los encabezados no saltan niveles', async ({ page }) => {
  await page.goto('/');
  const levels = await page
    .locator('h1, h2, h3, h4')
    .evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])));
  expect(levels[0]).toBe(1);
  levels.slice(1).forEach((level, i) => expect(level - levels[i]).toBeLessThanOrEqual(1));
});
