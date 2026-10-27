# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto
sigue [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido

- Sitio de una sola página de la ROYAT: Hero con logo bordado, Historia y Integrantes en pista
  horizontal, mapa de Presencia, Discografía con reproductor de audio propio, Contacto con carta
  que abre WhatsApp, pie de página y la mascota Fovi.
- Navegación en listón (barra de progreso en móvil), contenido editable en `content/*.json`.
- Encabezados de seguridad con CSP estricta, `sitemap.xml`, `robots.txt` y datos estructurados.

### Cambiado

- Historia, ¡Preciosooo!, Discografía, Contacto, Presencia, Hero y el recorrido móvil se
  ajustaron al prototipo de referencia (ornamentos, paridad de la línea de tiempo, arco de
  vinilos en perspectiva, tocadiscos del detalle, sobres del glosario).
- Fovi se queda visible sobre el detalle del disco en escritorio.
- Lighthouse CI limita el JavaScript transferido a 70 KB.
- Se agrega `Cross-Origin-Resource-Policy: same-origin`.

### Corregido

- El avance automático de discos movía el scroll hasta Discografía desde cualquier sección;
  ahora solo corre con la galería a la vista.
