import {
  DatasetReleaseProvider,
  FixtureBPlantProvider,
  FixturePlantProvider,
  PerenualPlantProvider,
  type PlantDataProvider,
} from '@open-garden/plant-provider';

/**
 * PLANT_TEST_FIXTURES=true adds the test-only plants and the second fixture
 * source the pipeline merge tests need. e2e and CI set it; installs never do,
 * so people only see real plants.
 */
export function plantTestFixturesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env['PLANT_TEST_FIXTURES'] === 'true';
}

export function createPipelineSources(env: NodeJS.ProcessEnv = process.env): PlantDataProvider[] {
  const testFixtures = plantTestFixturesEnabled(env);
  const sources: PlantDataProvider[] = [
    new FixturePlantProvider({ includeTestPlants: testFixtures }),
  ];
  if (testFixtures) {
    sources.push(new FixtureBPlantProvider());
  }
  // An open-garden-data release (open-garden-catalog-<version>.json, with its
  // .sha256 beside it). Add `dataset` to the pipeline's source order to use it.
  const catalogFile = env['PLANT_CATALOG_FILE']?.trim();
  if (catalogFile) {
    sources.push(new DatasetReleaseProvider(catalogFile));
  }
  const key = env['PERENUAL_API_KEY']?.trim();
  if (key) {
    sources.push(new PerenualPlantProvider(key));
  }
  return sources;
}
