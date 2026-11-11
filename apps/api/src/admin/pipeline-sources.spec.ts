import { describe, expect, it } from 'vitest';
import { createPipelineSources } from './pipeline-sources';

describe('createPipelineSources', () => {
  it('imports the bundled release unless PLANT_CATALOG_FILE names another file', async () => {
    const [bundled] = createPipelineSources({ PLANT_CATALOG_FILE: ' ' });
    expect(bundled.id).toBe('dataset');
    expect((await bundled.listPage()).items.length).toBeGreaterThan(50);

    const [other] = createPipelineSources({ PLANT_CATALOG_FILE: '/nowhere/catalog.json' });
    await expect(other.listPage()).rejects.toThrow(/nowhere/);
  });
});
