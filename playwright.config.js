// @ts-check
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// Las pruebas corren contra el build (`npm run build` antes), servido por `vite preview`
// con los encabezados de producción.
export default defineConfig({
  testDir: 'tests',
  testMatch: ['e2e/**/*.spec.js', 'a11y/**/*.spec.js', 'visual/**/*.spec.js'],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // Una prueba intermitente se arregla o se borra; no se reintenta (STANDARDS §6).
  retries: 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
