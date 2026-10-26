// @ts-check
import { describe, expect, it } from 'vitest';
import { HERO_ORDERS, heroProgress } from '../../../src/js/stitch/presets.js';

describe('HERO_ORDERS', () => {
  it('la rosa izquierda empieza en el borde izquierdo y abajo', () => {
    expect(HERO_ORDERS.left(0, 9, 10, 10)).toBeLessThan(HERO_ORDERS.left(9, 0, 10, 10));
  });

  it('la rosa derecha es el espejo de la izquierda', () => {
    expect(HERO_ORDERS.right(10, 5, 10, 10)).toBe(HERO_ORDERS.left(0, 5, 10, 10));
  });

  it('el logo avanza de izquierda a derecha', () => {
    expect(HERO_ORDERS.logo(0, 5, 10, 10)).toBeLessThan(HERO_ORDERS.logo(9, 5, 10, 10));
  });
});

describe('heroProgress', () => {
  it('las rosas arrancan antes que el logo y ambos terminan juntos', () => {
    expect(heroProgress(0)).toEqual({ roses: 0, logo: 0 });
    expect(heroProgress(0.16).logo).toBe(0);
    expect(heroProgress(0.16).roses).toBeGreaterThan(0);
    expect(heroProgress(1)).toEqual({ roses: 1, logo: 1 });
    expect(heroProgress(2)).toEqual({ roses: 1, logo: 1 });
  });
});
