// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { headersFor, parseHeaders } from './scripts/headers.js';

const headerRules = parseHeaders(readFileSync('public/_headers', 'utf8'));

export default defineConfig({
  // `vite preview` sirve dist/ con los encabezados de producción: así las pruebas e2e
  // detectan cualquier violación de la CSP antes de llegar a Cloudflare.
  preview: { headers: headersFor(headerRules, '/') },
});
