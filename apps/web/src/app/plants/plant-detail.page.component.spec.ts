import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { CatalogCompanionDto, PlantDetailDto } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { PlantDetailPage } from './plant-detail.page';
import { PlantsApiService } from './plants-api.service';
import { signal } from '@angular/core';

const companion = (over: Partial<CatalogCompanionDto>): CatalogCompanionDto => ({
  cropId: 'basil',
  name: 'Basil',
  kind: 'helps',
  benefits: ['deters-pests'],
  evidence: 'research',
  reason: 'Fewer thrips.',
  reference: 'A study',
  shownIn: [{ where: 'Iowa, USA', zones: { min: 5, max: 5 } }],
  ...over,
});

const tomato = (over: Partial<PlantDetailDto> = {}): PlantDetailDto => ({
  id: 't1',
  commonName: 'Tomato',
  species: 'Solanum lycopersicum',
  cultivar: null,
  plantType: 'vegetable',
  zoneMin: 1,
  zoneMax: 13,
  sunRequirements: 'Full sun',
  waterNeeds: 'Moderate',
  daysToMaturity: 55,
  spacingInches: 20,
  waterIntervalDays: 7,
  fertilizeIntervalDays: 14,
  status: 'active',
  isFavorite: false,
  illustrationUrl: null,
  growingGuidance: { indoorStart: null, outdoorSow: null, transplant: null, fallSow: null },
  sowingTemperature: null,
  soilPh: { min: 6, max: 7 },
  cropCoefficients: null,
  companions: [],
  companionZones: [],
  ...over,
});

async function render(plant: PlantDetailDto | null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ id: 't1' }) } },
      },
      { provide: PlantsApiService, useValue: { detail: async () => plant } },
      { provide: FavoritesApiService, useValue: {} },
      { provide: AuthApiService, useValue: { units: signal('imperial') } },
    ],
  });
  const fixture = TestBed.createComponent(PlantDetailPage);
  fixture.autoDetectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('PlantDetailPage', () => {
  it('shows the plant’s facts', async () => {
    const el = await render(tomato());
    expect(el.querySelector('h2')!.textContent).toBe('Tomato');
    expect(el.textContent).toContain('6.0–7.0');
    expect(el.querySelector('section.companions')).toBeNull();
  });

  it('says so when the plant cannot be loaded', async () => {
    const el = await render(null);
    expect(el.textContent).toContain('Plant unavailable offline or not found.');
  });

  it('groups companions, with evidence, benefits, and where each was shown', async () => {
    const el = await render(
      tomato({
        companions: [
          companion({}),
          companion({
            cropId: 'potato',
            name: 'Potato',
            kind: 'hinders',
            benefits: ['shares-pests'],
            evidence: 'extension',
            reason: 'Both get late blight.',
            reference: null,
            shownIn: [
              { where: 'Minnesota, USA', zones: { min: 3, max: 5 } },
              { where: 'Greenhouse', zones: null },
            ],
          }),
        ],
        companionZones: [5],
      }),
    );
    const section = el.querySelector('section.companions')!;
    expect([...section.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'Grows well with',
      'Keep apart from',
    ]);
    const [basil, potato] = [...section.querySelectorAll('li')].map((li) =>
      li.textContent.replace(/\s+/g, ' ').trim(),
    );
    expect(basil).toContain('Basil Research · deters pests');
    expect(basil).toContain('Shown in Iowa, USA (zone 5). Source: A study.');
    expect(potato).toContain('Potato Extension guidance · shares pests');
    expect(potato).toContain('Shown in Minnesota, USA (zones 3–5); Greenhouse.');
    expect(potato).not.toContain('Source:');
    expect(section.textContent).toContain('Pairs shown near zone 5 (your properties) come first.');
  });

  it('still renders a plant cached before companions existed', async () => {
    const old = tomato();
    delete (old as Partial<PlantDetailDto>).companions;
    delete (old as Partial<PlantDetailDto>).companionZones;
    const el = await render(old);
    expect(el.querySelector('h2')!.textContent).toBe('Tomato');
  });
});
