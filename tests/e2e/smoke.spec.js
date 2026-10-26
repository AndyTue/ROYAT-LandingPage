// @ts-check
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('la página carga sin errores de consola ni bloqueos de la CSP', async ({ page }) => {
  /** @type {string[]} */
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'es-MX');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Si la CSP bloqueara el módulo, main.js no agregaría la clase.
  await expect(page.locator('html')).toHaveClass(/\bjs\b/);
  expect(errors).toEqual([]);
});

test('el preview sirve los encabezados de seguridad de producción', async ({ request }) => {
  const response = await request.get('/');
  const headers = response.headers();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['x-content-type-options']).toBe('nosniff');
});

test('no hay violaciones de accesibilidad serias o críticas', async ({ page }) => {
  await page.goto('/');
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
