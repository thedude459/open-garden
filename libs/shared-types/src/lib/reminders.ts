export type CareKind = 'water' | 'fertilize' | 'harvest';
export type CareAction = 'completed' | 'dismissed';
export type ReminderUrgency = 'overdue' | 'dueToday' | 'upcoming';

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
  plantType: import('./plant').PlantType;
  status: import('./plant').PlantStatus;
  required: boolean;
  rainNote: string | null;
}

export interface ReminderListDto {
  gardenId: string;
  asOf: string;
  myRole: import('./garden').GardenRole;
  items: ReminderItemDto[];
  outlookOn: string | null;
}

export interface ReminderMutationDto {
  plantingId: string;
  kind: CareKind;
  dueOn: string;
}
