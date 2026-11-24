import { CatalogPipelineService } from '@open-garden/catalog-pipeline';
import {
  PipelineRunRepository,
  PlantRepository,
  PlantSourceRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { createPipelineSources } from './pipeline-sources';

/** The one way to build the catalog import: the admin page and the boot-time sync share it. */
export function openCatalogPipeline(db: AppDatabase) {
  const plants = new PlantRepository(db);
  const plantSources = new PlantSourceRepository(db);
  const runs = new PipelineRunRepository(db);
  const pipeline = new CatalogPipelineService(
    runs,
    {
      listSnapshots: () => plants.listSnapshots(),
      listSourceLinks: () => plantSources.listAll(),
    },
    createPipelineSources(),
  );
  return { pipeline, runs };
}
