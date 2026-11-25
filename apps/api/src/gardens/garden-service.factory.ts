import { GardenService } from '@open-garden/gardens';
import { climateLookupFor, type ClimateLookup } from '@open-garden/garden-place';
import {
  GardenMembershipRepository,
  GardenRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';

/** The one way the API builds the property service: its pages and Today share it. */
export function openGardenService(
  db: AppDatabase,
  climate: ClimateLookup = climateLookupFor(),
): GardenService {
  return new GardenService(new GardenRepository(db), new GardenMembershipRepository(db), climate);
}
