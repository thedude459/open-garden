# Shared TypeScript contracts (care reminders)

Types in this document MUST be implemented in `libs/shared-types` and imported
by `apps/api` and `apps/web`. Do not duplicate. Existing plant/garden/auth/
calendar/planting/layout DTOs stay. Optional interval fields MAY be added on
`PlantDetailDto` / provider plant so fixture sync can persist them; reminder
list items still carry `intervalDays` for the client overlay.

```ts
import type { GardenRole } from './garden';
import type { PlantStatus, PlantType } from './plant';

export type CareKind = 'water' | 'fertilize' | 'harvest';
export type ReminderUrgency = 'overdue' | 'dueToday' | 'upcoming';
export type CareAction = 'completed' | 'dismissed';

export interface ReminderItemDto {
  plantingId: string;
  kind: CareKind;
  dueOn: string;
  urgency: ReminderUrgency;
  intervalDays: number | null;
  plantId: string;
  commonName: string;
  species: string;
  cultivar: string | null;
  plantType: PlantType;
  status: PlantStatus;
}

export interface ReminderListDto {
  gardenId: string;
  myRole: GardenRole;
  asOf: string;
  items: ReminderItemDto[];
}

export interface ReminderMutationDto {
  plantingId: string;
  kind: CareKind;
  dueOn: string;
}
```

`ReminderMutationDto` identifies the occurrence key. The API accepts the
posted triple even when it is not the currently derived open occurrence; see
`rest-api.md` for derivation rules after upsert.

Zod schemas (`reminderMutationSchema`, `careKindSchema`, `asOfQuerySchema`)
live next to these types. Dates MUST match `YYYY-MM-DD`. `intervalDays` when
present on a plant row MUST be a positive integer.

Reuse existing `ApiErrorDto`. Do not put IndexedDB queue types in
`shared-types`.

`PlantDetailDto` MAY gain:

```ts
waterIntervalDays: number | null;
fertilizeIntervalDays: number | null;
```

Do not use `waterNeeds` as a cadence.
