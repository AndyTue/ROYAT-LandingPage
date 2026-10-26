// @ts-check
// Valida content/*.json contra schemas/ y revisa las referencias cruzadas. Corre en `npm run lint`.
import { existsSync, readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { crossCheck } from './content/checks.js';
import { CONTENT_FILES, loadContent } from './content/load.js';

const ajv = new Ajv2020({ allErrors: true, strict: true });
const content = loadContent();
/** @type {string[]} */
const errors = [];

for (const name of CONTENT_FILES) {
  const schema = JSON.parse(readFileSync(`schemas/${name}.schema.json`, 'utf8'));
  const validate = ajv.compile(schema);
  if (!validate(content[name])) {
    for (const error of validate.errors ?? []) {
      errors.push(`${name}.json${error.instancePath || ''}: ${error.message}`);
    }
  }
}

errors.push(...crossCheck(content, existsSync));

if (errors.length) {
  console.error(`✖ ${errors.length} problema(s) en content/:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`✔ content/ válido (${CONTENT_FILES.length} archivos)`);
