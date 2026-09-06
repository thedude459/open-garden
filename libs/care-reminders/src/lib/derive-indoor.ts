import type { ReminderItemDto } from '@open-garden/shared-types';
import {
  deriveReminders,
  type DeriveEventInput,
  type DerivePlantingInput,
} from './derive';

export interface IndoorDerivePlantingInput extends DerivePlantingInput {
  startMethod: 'direct_seed' | 'transplant';
  indoorStartedOn: string | null;
  placed: boolean;
}

/** Indoor water/fertilize for unplaced transplants only. No harvest. */
export function deriveIndoorReminders(
  plantings: IndoorDerivePlantingInput[],
  events: DeriveEventInput[],
  asOf: string,
): ReminderItemDto[] {
  const eligible: DerivePlantingInput[] = plantings
    .filter(
      (p) =>
        p.startMethod === 'transplant' &&
        !p.placed &&
        p.indoorStartedOn != null,
    )
    .map((p) => ({
      ...p,
      plantedOn: p.indoorStartedOn,
      harvestedOn: p.harvestedOn,
      daysToMaturity: null,
    }));

  return deriveReminders(eligible, events, asOf).filter(
    (item) => item.kind === 'water' || item.kind === 'fertilize',
  );
}
