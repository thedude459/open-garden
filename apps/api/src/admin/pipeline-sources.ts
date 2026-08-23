import {
  FixtureBPlantProvider,
  FixturePlantProvider,
  PerenualPlantProvider,
  type PlantDataProvider,
} from '@open-garden/plant-provider';

export function createPipelineSources(): PlantDataProvider[] {
  const sources: PlantDataProvider[] = [new FixturePlantProvider(), new FixtureBPlantProvider()];
  const key = process.env['PERENUAL_API_KEY']?.trim();
  if (key) {
    sources.push(new PerenualPlantProvider(key));
  }
  return sources;
}
