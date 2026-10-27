// @ts-check
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const INTRO = '¡Hola! Quiero solicitar información para un evento con la Real Orquesta Yucateca.';
const NUMBER = '529995893559';

/** Fecha futura en ISO y como aparece en el mensaje. */
function futureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 45);
  const iso = date.toISOString().slice(0, 10);
  const [y, m, d] = iso.split('-').map(Number);
  const long = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
  return { iso, long };
}

test.beforeEach(async ({ page, context }) => {
  // Nunca se sale a WhatsApp de verdad: la pestaña nueva recibe una página vacía.
  await context.route('https://wa.me/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>wa</title>' }),
  );
  await page.goto('/#contacto');
});

/**
 * Envía la carta y devuelve el número y el texto de la URL de WhatsApp que se abrió.
 * @param {import('@playwright/test').Page} page
 */
async function send(page) {
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Enviar por WhatsApp' }).click();
  const url = new URL((await popup).url());
  return { number: url.pathname.slice(1), text: url.searchParams.get('text') };
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ name: string, date: string, municipality?: string, phone: string }} data
 */
async function fillBasics(page, { name, date, municipality, phone }) {
  await page.getByLabel('Nombre', { exact: true }).fill(name);
  await page.getByLabel('Fecha del evento').fill(date);
  if (municipality) await page.locator('#ct-municipality').fill(municipality);
  await page.getByLabel('Número de teléfono').fill(phone);
}

test('vaquería: el municipio de la península llena el estado (CON-4, CON-7)', async ({ page }) => {
  const date = futureDate();
  await fillBasics(page, {
    name: 'María Pech',
    date: date.iso,
    municipality: 'Tizimín',
    phone: '999 123 4567',
  });
  await expect(page.getByLabel('Estado', { exact: true })).toHaveValue('Yucatán');
  const { number, text } = await send(page);
  expect(number).toBe(NUMBER);
  expect(text).toBe(
    [
      INTRO,
      '',
      'Nombre: María Pech',
      'Teléfono: 999 123 4567',
      `Fecha: ${date.long}`,
      'Estado: Yucatán',
      'Municipio: Tizimín',
      'Tipo de evento: Vaquería',
    ].join('\n'),
  );
  await expect(page.getByRole('link', { name: 'Ábrelo aquí' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/529995893559\?text=/,
  );
});

test('evento privado con especificación, localidad y mensaje (CON-3)', async ({ page }) => {
  const date = futureDate();
  await page.locator('label[for="ct-privado"]').click();
  await expect(page.locator('[data-article]')).toHaveText('un');
  await page.getByLabel('Especifica el tipo de evento privado').fill('boda');
  await page.getByLabel('Localidad o comisaría (opcional)').fill('Komchén');
  await fillBasics(page, {
    name: 'Luis Canul',
    date: date.iso,
    municipality: 'Mérida',
    phone: '9991234567',
  });
  await page.getByLabel('Mensaje (opcional)').fill('Por la noche, 300 invitados');
  const { text } = await send(page);
  expect(text?.split('\n').slice(5)).toEqual([
    'Estado: Yucatán',
    'Municipio: Mérida',
    'Localidad: Komchén',
    'Tipo de evento: Evento privado (boda)',
    'Mensaje: Por la noche, 300 invitados',
  ]);
});

test('Ciudad de México: el municipio se llama alcaldía (CON-4)', async ({ page }) => {
  const date = futureDate();
  await page.getByLabel('Estado', { exact: true }).selectOption('Ciudad de México');
  await expect(page.locator('#ct-municipality')).toHaveAttribute('placeholder', 'alcaldía');
  await expect(page.getByLabel('Alcaldía', { exact: true })).toBeVisible();
  // Fuera de la península no hay sugerencias de municipios.
  await expect(page.locator('#ct-municipality')).not.toHaveAttribute('list');
  await fillBasics(page, {
    name: 'Ana Ruiz',
    date: date.iso,
    municipality: 'Coyoacán',
    phone: '55 1234 5678',
  });
  const { text } = await send(page);
  expect(text).toContain('Estado: Ciudad de México\nAlcaldía: Coyoacán\n');
});

test('fuera de México: país, ciudad y teléfono internacional (CON-5)', async ({ page }) => {
  const date = futureDate();
  await page.getByLabel('Estado', { exact: true }).selectOption({ label: 'Fuera de México' });
  await expect(page.getByLabel('País', { exact: true })).toBeVisible();
  await expect(page.locator('#ct-municipality')).toHaveAttribute('placeholder', 'ciudad');
  await expect(page.locator('#ct-locality')).toHaveAttribute('placeholder', 'lugar o dirección');
  await expect(page.locator('#ct-countries option[value="Estados Unidos"]')).toHaveCount(1);
  await page.getByLabel('País', { exact: true }).fill('Estados Unidos');
  await fillBasics(page, {
    name: 'Jorge May',
    date: date.iso,
    municipality: 'Miami',
    phone: '+1 305 123 45',
  });
  const { text } = await send(page);
  expect(text?.split('\n').slice(5, 7)).toEqual(['País: Estados Unidos', 'Ciudad: Miami']);
  expect(text).not.toContain('Estado:');
});

test('valida en español y enfoca el primer error (CON-6)', async ({ page }) => {
  let opened = false;
  page.on('popup', () => (opened = true));
  await page.getByRole('button', { name: 'Enviar por WhatsApp' }).click();
  const name = page.getByLabel('Nombre', { exact: true });
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  expect(await name.evaluate((el) => /** @type {HTMLInputElement} */ (el).validationMessage)).toBe(
    'Escribe tu nombre.',
  );

  await fillBasics(page, {
    name: 'Ana',
    date: futureDate().iso,
    municipality: 'Valladolid',
    phone: '999 123 45',
  });
  await page.getByRole('button', { name: 'Enviar por WhatsApp' }).click();
  const phone = page.getByLabel('Número de teléfono');
  await expect(phone).toBeFocused();
  expect(await phone.evaluate((el) => /** @type {HTMLInputElement} */ (el).validationMessage)).toBe(
    'Escribe un número de al menos 10 dígitos.',
  );
  // Al corregir el campo se quita el error.
  await phone.fill('999 123 4567');
  await expect(phone).not.toHaveAttribute('aria-invalid');
  expect(opened).toBe(false);
});

test('la fecha no puede ser pasada', async ({ page }) => {
  await expect(page.getByLabel('Fecha del evento')).toHaveAttribute('min', /^\d{4}-\d{2}-\d{2}$/);
  await fillBasics(page, {
    name: 'Ana',
    date: '2020-01-01',
    municipality: 'Valladolid',
    phone: '9991234567',
  });
  await page.getByRole('button', { name: 'Enviar por WhatsApp' }).click();
  await expect(page.getByLabel('Fecha del evento')).toBeFocused();
});

test('se puede llenar solo con el teclado', async ({ page }) => {
  const name = page.getByLabel('Nombre', { exact: true });
  await name.focus();
  await page.keyboard.type('Rosa Tun');
  await page.keyboard.press('Tab');
  await expect(page.locator('#ct-vaqueria')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#ct-privado')).toBeChecked();
  await expect(page.locator('[data-article]')).toHaveText('un');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Especifica el tipo de evento privado')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#ct-vaqueria')).toBeChecked();
  // Como en el prototipo (ADR-010) el renglón queda a la vista, pero deshabilitado y fuera del Tab.
  await expect(page.getByLabel('Especifica el tipo de evento privado')).toBeDisabled();
});

test('el mapa o Fovi pueden llenar el lugar y enfocar el primer campo vacío (CON-8)', async ({
  page,
}) => {
  await page.evaluate(() =>
    document.dispatchEvent(
      new CustomEvent('contact:prefill', { detail: { municipality: 'Tizimín', state: 'Yucatán' } }),
    ),
  );
  await expect(page.locator('#ct-municipality')).toHaveValue('Tizimín');
  await expect(page.getByLabel('Estado', { exact: true })).toHaveValue('Yucatán');
  await expect(page.getByLabel('Nombre', { exact: true })).toBeFocused();
});

test('la carta no tiene violaciones de accesibilidad serias', async ({ page }) => {
  await page.locator('label[for="ct-privado"]').click();
  await page.getByLabel('Estado', { exact: true }).selectOption({ label: 'Fuera de México' });
  const { violations } = await new AxeBuilder({ page }).include('#contacto').analyze();
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('el formulario de respaldo envía el texto a WhatsApp', async ({ page }) => {
    await expect(page.locator('[data-letter]')).toBeHidden();
    const text = page.getByLabel('Escribe tu invitación');
    await text.fill('Hola, quiero invitar a la ROYAT');
    const request = page.waitForRequest('https://wa.me/**');
    await page.getByRole('button', { name: 'Enviar por WhatsApp' }).click();
    const url = new URL((await request).url());
    expect(url.pathname).toBe(`/${NUMBER}`);
    expect(url.searchParams.get('text')).toBe('Hola, quiero invitar a la ROYAT');
  });
});
