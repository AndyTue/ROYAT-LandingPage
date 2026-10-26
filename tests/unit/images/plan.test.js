// @ts-check
import { describe, expect, it } from 'vitest';
import { contentHash, planImage, widthsFor } from '../../../scripts/images/plan.js';

describe('widthsFor', () => {
  it('no agranda: usa solo los candidatos que caben', () => {
    expect(widthsFor('history', 1600)).toEqual([480, 640, 800, 1200, 1600]);
    expect(widthsFor('covers', 480)).toEqual([240, 480]);
  });

  it('agrega el ancho original si queda mucha resolución sin usar', () => {
    expect(widthsFor('history', 1179)).toEqual([480, 640, 800, 1179]);
    expect(widthsFor('history', 1300)).toEqual([480, 640, 800, 1200]);
  });

  it('una imagen más chica que todos los candidatos conserva su ancho', () => {
    expect(widthsFor('social', 60)).toEqual([60]);
  });

  it('una carpeta desconocida usa los anchos de historia', () => {
    expect(widthsFor('otra', 800)).toEqual([480, 640, 800]);
  });
});

describe('contentHash', () => {
  it('cambia con el contenido y es estable', () => {
    const a = contentHash(new Uint8Array([1, 2, 3]));
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(contentHash(new Uint8Array([1, 2, 3]))).toBe(a);
    expect(contentHash(new Uint8Array([1, 2, 4]))).not.toBe(a);
  });
});

describe('planImage', () => {
  it('produce AVIF y WebP por ancho con el hash en el nombre', () => {
    const plan = planImage('assets-src/covers/fiesta.webp', {
      width: 480,
      height: 480,
      hash: 'abcd1234',
    });
    expect(plan).toMatchObject({ src: 'assets-src/covers/fiesta.webp', width: 480, height: 480 });
    expect(plan.variants.map((v) => v.file)).toEqual([
      'img/covers/fiesta-240.abcd1234.avif',
      'img/covers/fiesta-240.abcd1234.webp',
      'img/covers/fiesta-480.abcd1234.avif',
      'img/covers/fiesta-480.abcd1234.webp',
    ]);
  });
});
