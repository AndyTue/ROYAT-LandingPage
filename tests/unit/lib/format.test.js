// @ts-check
import { describe, expect, it } from 'vitest';
import {
  albumMinutes,
  fill,
  formatDuration,
  isoDuration,
  pad2,
  slugify,
} from '../../../src/js/lib/format.js';

describe('format', () => {
  it('pad2', () => {
    expect(pad2(1)).toBe('01');
    expect(pad2(16)).toBe('16');
  });

  it('formatDuration', () => {
    expect(formatDuration(155)).toBe('2:35');
    expect(formatDuration(59.6)).toBe('1:00');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(-3)).toBe('0:00');
  });

  it('isoDuration', () => {
    expect(isoDuration(155)).toBe('PT2M35S');
    expect(isoDuration(120)).toBe('PT2M');
    expect(isoDuration(3600)).toBe('PT1H');
    expect(isoDuration(0)).toBe('PT0S');
  });

  it('albumMinutes', () => {
    expect(albumMinutes([{ durationSec: 155 }])).toBe('3 min');
    expect(albumMinutes([{ durationSec: 10 }])).toBe('1 min');
    expect(albumMinutes([{ durationSec: 1800 }, { durationSec: 900 }])).toBe('45 min');
  });

  it('slugify', () => {
    expect(slugify('Trompetas y trombón')).toBe('trompetas-y-trombon');
    expect(slugify('¡A Bailar en Tizimín!')).toBe('a-bailar-en-tizimin');
  });

  it('fill', () => {
    expect(fill('Portada de {title}', { title: 'Jubileo' })).toBe('Portada de Jubileo');
    expect(fill('{a} y {b}', { a: 1 })).toBe('1 y {b}');
  });
});
