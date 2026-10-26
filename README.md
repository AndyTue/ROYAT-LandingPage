# ROYAT Landing Page

Sitio de una sola página de la **Real Orquesta Yucateca de Arturo Turriza (ROYAT)**, de Tizimín, Yucatán.

HTML, CSS y JavaScript vanilla con Vite. El HTML se genera en el build a partir de `content/*.json` y las imágenes optimizadas, a partir de `assets-src/`.

## Requisitos

- Node 24 LTS (`.nvmrc`)

## Comandos

```bash
npm ci               # instala dependencias exactas
npm run dev          # servidor de desarrollo
npm run build        # imágenes + build de producción en dist/
npm run preview      # sirve dist/
npm run check        # lint, tipos, pruebas unitarias, build y e2e
```

## Estructura

```
content/      contenido del sitio (JSON)
assets-src/   imágenes originales y patrones de bordado
src/          plantillas, estilos y JavaScript
public/       archivos que se copian tal cual a dist/
scripts/      utilidades del build
tests/        unitarias, e2e, accesibilidad y visuales
```

## Despliegue

Cloudflare Pages: comando `npm run build`, salida `dist`, `NODE_VERSION=24`.
