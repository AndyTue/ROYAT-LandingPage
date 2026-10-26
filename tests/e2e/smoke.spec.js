// @ts-check
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * WebKit (el motor de Playwright) aplica un estilo interno a todo `<select>` y lo reporta como
 * violación de `style-src-attr`, aunque el HTML no tenga ningún atributo `style`. Es del motor,
 * no del sitio: se ignora solo esa combinación exacta. Revisar en Safari real (F11).
 * @param {string} browserName
 * @param {{ directive: string, target: string }} violation
 */
const isEngineQuirk = (browserName, { directive, target }) =>
  browserName === 'webkit' && directive === 'style-src-attr' && target === 'SELECT';

const CSP_CONSOLE = /Content Security Policy/;

test('la página carga sin errores de consola ni bloqueos de la CSP', async ({
  page,
  browserName,
}) => {
  /** @type {string[]} */
  const errors = [];
  page.on('console', (message) => {
    // Las violaciones de CSP se revisan abajo con su detalle (directiva y elemento).
    if (message.type() === 'error' && !CSP_CONSOLE.test(message.text()))
      errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    /** @type {{ directive: string, target: string, uri: string }[]} */
    const found = [];
    Object.assign(window, { __cspViolations: found });
    document.addEventListener('securitypolicyviolation', (event) =>
      found.push({
        directive: event.violatedDirective,
        target: /** @type {Element | null} */ (event.target)?.nodeName ?? '',
        uri: event.blockedURI,
      }),
    );
  });

  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'es-MX');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Si la CSP bloqueara el módulo, main.js no agregaría la clase.
  await expect(page.locator('html')).toHaveClass(/\bjs\b/);
  expect(errors).toEqual([]);
  /** @type {{ directive: string, target: string, uri: string }[]} */
  const violations = await page.evaluate(() => /** @type {any} */ (window).__cspViolations);
  expect(violations.filter((v) => !isEngineQuirk(browserName, v))).toEqual([]);
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
