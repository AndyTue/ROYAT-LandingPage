// @ts-check
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/js/**/*.js', 'scripts/**/*.js'],
      exclude: ['src/js/main.js', 'src/dev/**'],
      reporter: ['text-summary', 'html'],
      // Lógica pura (STANDARDS §6): lib/, stitch/ y core/ con al menos 90 % de líneas.
      thresholds: {
        'src/js/lib/**': { lines: 90, functions: 90, branches: 85 },
        'src/js/stitch/**': { lines: 90, functions: 90, branches: 85 },
        // TODO(FT): activar cuando se escriban las pruebas de core/ (las pruebas de F5–F10
        // se dejaron para la fase FT, decisión de Andrés del 2026-10-26).
        // 'src/js/core/**': { lines: 90, functions: 90, branches: 85 },
      },
    },
  },
});
