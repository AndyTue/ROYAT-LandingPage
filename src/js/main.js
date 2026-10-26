// @ts-check
import { initContact } from './sections/contact.js';

// El CSS sin esta clase muestra el layout estático; con ella, las secciones pueden animarse.
document.documentElement.classList.add('js');

// El formulario es lo más importante para el cliente: se activa de inmediato. Si algo falla,
// se queda el formulario de respaldo y el sitio sigue funcionando (STANDARDS §3).
const form = document.querySelector('[data-contact-form]');
if (form instanceof HTMLFormElement) {
  try {
    initContact(form);
  } catch (error) {
    form.classList.add('letter__form--fallback');
    form.noValidate = false;
    const text = form.querySelector('textarea[name="text"]');
    if (text instanceof HTMLTextAreaElement) text.disabled = false;
    if (import.meta.env.DEV) console.error(error);
  }
}
