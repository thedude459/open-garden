// The scheduled "Dataset compatibility" workflow downloads the latest
// open-garden-data release and points LATEST_CATALOG_FILE at it, so a release
// this app cannot import is caught within a day, not when a household
// upgrades. Skipped otherwise.
import { describe, expect, it } from 'vitest';
import { DatasetReleaseProvider } from './dataset-release-provider';

const file = process.env['LATEST_CATALOG_FILE'];

describe.skipIf(!file)('latest open-garden-data release', () => {
  it('verifies its attestation and imports every crop', async () => {
    // Nothing pinned: the release is trusted only on its attestation.
    const { items, skipped } = await new DatasetReleaseProvider(file, []).listPage();
    expect(skipped, 'crops this app cannot read').toBe(0);
    expect(items.length).toBeGreaterThan(0);
  });
});
