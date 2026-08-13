import { describe, expect, it } from 'vitest';
import { buildVarietyKey, normalizePart } from './variety-key';

describe('variety-key', () => {
  it('normalizes whitespace and case', () => {
    expect(normalizePart('  Solanum   Lycopersicum ')).toBe('solanum lycopersicum');
  });

  it('builds species|cultivar key', () => {
    expect(buildVarietyKey('Solanum lycopersicum', 'Cherry')).toBe(
      'solanum lycopersicum|cherry',
    );
  });

  it('uses empty cultivar segment for species-only', () => {
    expect(buildVarietyKey('Acer rubrum', null)).toBe('acer rubrum|');
  });
});
