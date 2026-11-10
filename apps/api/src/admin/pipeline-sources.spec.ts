import { describe, expect, it } from 'vitest';
import { createPipelineSources, plantTestFixturesEnabled } from './pipeline-sources';

describe('createPipelineSources', () => {
  it('registers only the real fixture catalog by default', async () => {
    const sources = createPipelineSources({});
    expect(sources.map((s) => s.id)).toEqual(['fixture']);
    const page = await sources[0]!.listPage({ limit: 100 });
    expect(page.items.some((p) => p.commonName.startsWith('Pipeline'))).toBe(false);
  });

  it('adds the test plants and the second fixture source when PLANT_TEST_FIXTURES=true', async () => {
    const env = { PLANT_TEST_FIXTURES: 'true' };
    expect(plantTestFixturesEnabled(env)).toBe(true);
    const sources = createPipelineSources(env);
    expect(sources.map((s) => s.id)).toEqual(['fixture', 'fixture-b']);
    const page = await sources[0]!.listPage({ limit: 100 });
    expect(page.items.some((p) => p.commonName === 'Pipeline Extra 01')).toBe(true);
  });

  it('adds the dataset release only when PLANT_CATALOG_FILE is set', () => {
    expect(createPipelineSources({ PLANT_CATALOG_FILE: ' ' }).map((s) => s.id)).toEqual([
      'fixture',
    ]);
    expect(
      createPipelineSources({ PLANT_CATALOG_FILE: '/data/open-garden-catalog-0.1.0.json' }).map(
        (s) => s.id,
      ),
    ).toEqual(['fixture', 'dataset']);
  });

  it('adds Perenual only when a key is set', () => {
    expect(createPipelineSources({ PERENUAL_API_KEY: ' k ' }).map((s) => s.id)).toEqual([
      'fixture',
      'perenual',
    ]);
  });
});
