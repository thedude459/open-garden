import { describe, expect, it, vi } from 'vitest';
import { PlantDetailService } from './plant-detail-service';

describe('PlantDetailService', () => {
  it('returns null when plant missing', async () => {
    const plants = { getById: vi.fn().mockResolvedValue(null) };
    const favorites = { isFavorite: vi.fn() };
    const svc = new PlantDetailService(plants as never, favorites as never);
    await expect(svc.getById('missing', 'user-1')).resolves.toBeNull();
    expect(favorites.isFavorite).not.toHaveBeenCalled();
  });

  it('maps row and favorite flag', async () => {
    const plants = {
      getById: vi.fn().mockResolvedValue({
        id: 'p1',
        commonName: 'Tomato',
        species: 'Solanum lycopersicum',
        cultivar: null,
        plantType: 'vegetable',
        zoneMin: 5,
        zoneMax: 10,
        sunRequirements: 'full',
        waterNeeds: 'medium',
        daysToMaturity: 70,
        spacingInches: 24,
        status: 'active',
      }),
    };
    const favorites = { isFavorite: vi.fn().mockResolvedValue(true) };
    const svc = new PlantDetailService(plants as never, favorites as never);
    const detail = await svc.getById('p1', 'user-1');
    expect(detail?.isFavorite).toBe(true);
    expect(detail?.commonName).toBe('Tomato');
  });
});
