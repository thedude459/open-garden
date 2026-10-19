import { describe, expect, it } from 'vitest';
import { PlacesController } from './places.controller';

describe('PlacesController lookup', () => {
  const controller = new PlacesController();

  it('rejects a blank query with the garden-address message', async () => {
    await expect(controller.lookupPlace({ query: '   ' })).rejects.toThrow(
      'A garden address is required',
    );
    await expect(controller.lookupPlace({})).rejects.toThrow('A garden address is required');
  });
});
