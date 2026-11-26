import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import type { CatalogCompanionDto, PlantDetailDto, PlantPestDto } from '@open-garden/shared-types';
import { AuthApiService } from '../auth/auth-api.service';
import { FavoritesApiService } from '../favorites/favorites-api.service';
import { PlantDetailPage } from './plant-detail.page';
import { withCompanionDefaults } from './cached-detail';
import { PlantsApiService } from './plants-api.service';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { settled } from '../settled';

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
  varieties: [],
  pests: [],
  ...over,
});

const none = { cultural: [], physical: [], biological: [], organic: [], conventional: [] };
const hornworm = (over: Partial<PlantPestDto> = {}): PlantPestDto => ({
  id: 'tomato-hornworm',
  name: 'Tomato hornworm',
  scientificName: 'Manduca quinquemaculata',
  kind: 'insect',
  signs: 'Large green caterpillars strip leaves.',
  scoutStages: ['vegetative', 'fruiting'],
  controls: { ...none, physical: ['Hand-pick them.'] },
  region: {
    where: 'Minnesota, USA',
    country: 'US',
    zones: { min: 3, max: 5 },
    when: 'Midsummer.',
    threshold: 'One per plant.',
    controls: { ...none, organic: ['Bt.'], conventional: ['Carbaryl.'] },
    reference: 'UMN Extension',
  },
  regionMatch: 'country',
  ...over,
});

async function render(plant: PlantDetailDto | null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ id: 't1' })) },
      },
      { provide: PlantsApiService, useValue: { detail: async () => plant } },
      { provide: FavoritesApiService, useValue: {} },
      { provide: AuthApiService, useValue: { units: signal('imperial') } },
    ],
  });
  const fixture = TestBed.createComponent(PlantDetailPage);
  fixture.autoDetectChanges();
  await settled(fixture);
  return fixture.nativeElement as HTMLElement;
}

describe('PlantDetailPage', () => {
  it('shows the plant’s facts', async () => {
    const el = await render(tomato());
    expect(el.querySelector('h2')!.textContent.trim()).toBe('Tomato');
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
    // The offline cache fills in what older details lack (cached-detail.ts).
    const el = await render(withCompanionDefaults(old));
    expect(el.querySelector('h2')!.textContent.trim()).toBe('Tomato');
    expect(el.querySelector('.companions')).toBeNull();
  });

  it('links to the crop’s other varieties, with what tells them apart', async () => {
    const el = await render(
      tomato({
        varieties: [
          {
            id: 'r',
            commonName: 'Tomato',
            cultivar: 'Roma',
            daysToMaturity: 75,
            spacingInches: 24,
          },
          {
            id: 'b',
            commonName: 'Tomato',
            cultivar: null,
            daysToMaturity: null,
            spacingInches: null,
          },
        ],
      }),
    );
    const items = [...el.querySelectorAll('section.varieties li')].map((li) =>
      li.textContent.replace(/\s+/g, ' ').trim(),
    );
    expect(items).toEqual(['Tomato (Roma)75 days · 24 in apart', 'Tomato']);
    expect(el.querySelector('section.varieties a')!.getAttribute('href')).toBe('/plants/r');
  });

  it('shows pests with organic products first and conventional ones only on request', async () => {
    const el = await render(
      tomato({
        pests: [
          hornworm(),
          hornworm({
            id: 'early-blight',
            name: 'Early blight',
            kind: 'disease',
            scientificName: null,
            region: {
              ...hornworm().region!,
              where: 'California, USA',
              zones: { min: 9, max: 9 },
              threshold: null,
              controls: none,
            },
            regionMatch: 'nearest',
          }),
          hornworm({ id: 'aphids', name: 'Aphids', region: null, regionMatch: 'none' }),
        ],
      }),
    );
    const section = el.querySelector('section.pests')!;
    const text = () =>
      [...section.querySelectorAll('.pest-list > li')].map((li) =>
        li.textContent.replace(/\s+/g, ' ').trim(),
      );
    const [worm, blight, aphids] = text();
    expect(worm).toContain('Tomato hornworm Insect');
    expect(worm).toContain('Look for it on growing plants, fruiting.');
    expect(worm).toContain('By hand or barrierHand-pick them.');
    expect(worm).toContain('Guidance for Minnesota, USA (zones 3–5).');
    expect(worm).toContain('When: Midsummer.Act when: One per plant.');
    expect(worm).toContain('Organic productsBt.');
    expect(worm).not.toContain('Carbaryl');
    expect(blight).toContain('Guidance from California, USA (zone 9), the nearest we have');
    expect(blight).toContain('This guidance names no organic product');
    expect(aphids).toContain('We have no timing or products for your country yet');
    expect(section.textContent).toContain('choose products labelled for organic use');

    section.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    // The page redraws itself on the signal change (no zone.js).
    await new Promise((resolve) => setTimeout(resolve));
    expect(text()[0]).toContain('Conventional productsCarbaryl.');
    expect(text()[1]).toContain('This guidance names no conventional product.');
  });
});
