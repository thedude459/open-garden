import { DatasetReleaseProvider } from '@open-garden/plant-provider';

/**
 * The catalog's one source: the open-garden-data release bundled with the
 * app, or the file PLANT_CATALOG_FILE names (it must carry a valid
 * provenance attestation beside it). See ADR 0020.
 */
export function createPipelineSources(
  env: NodeJS.ProcessEnv = process.env,
): [DatasetReleaseProvider] {
  const file = env['PLANT_CATALOG_FILE']?.trim();
  return [file ? new DatasetReleaseProvider(file) : new DatasetReleaseProvider()];
}
