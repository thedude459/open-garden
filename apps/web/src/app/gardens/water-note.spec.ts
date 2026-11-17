import { describe, expect, it } from 'vitest';
import { waterNote } from './water-note';

describe('waterNote', () => {
  it('says how far the soil is short, in the member’s units', () => {
    expect(waterNote(26, 'imperial')).toBe('Soil about 1.0 in short of water');
    expect(waterNote(26.4, 'metric')).toBe('Soil about 26 mm short of water');
    expect(waterNote(null, 'metric')).toBeNull();
    expect(waterNote(undefined, 'imperial')).toBeNull();
  });
});
