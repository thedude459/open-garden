/** `scout` is a bed's weekly look for pests (ADR 0046); the rest are a planting's. */
export type CareKind = 'water' | 'fertilize' | 'harvest' | 'sow' | 'scout';

/** The task as a verb: "Water", "Fertilize", "Harvest". */
export const CARE_VERBS: Record<CareKind, string> = {
  water: 'Water',
  fertilize: 'Fertilize',
  harvest: 'Harvest',
  sow: 'Sow',
  scout: 'Scout',
};
export type CareAction = 'completed' | 'dismissed';
export type ReminderUrgency = 'overdue' | 'dueToday' | 'upcoming';

export interface ReminderItemDto {
  /** The planting the task is for; for a Scout task, its bed (ADR 0046). */
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
  bedId?: string | null;
  bedName?: string | null;
  /** Watering by water balance: how far the soil is below full, in mm, on `dueOn`. */
  deficitMm?: number | null;
  /** A Scout task: the pests to look for in the bed this week. */
  pests?: string[];
}

export interface ReminderListDto {
  gardenId: string;
  asOf: string;
  myRole: import('./garden').GardenRole;
  items: ReminderItemDto[];
  outlookOn: string | null;
}

export interface ReminderMutationDto {
  /** The planting; for a Scout task, the bed. */
  plantingId: string;
  kind: CareKind;
  dueOn: string;
  /** The member's today, for a done Sow task: the planting was planted on it (ADR 0040). */
  doneOn?: string;
}

/** A member's reminder settings and what this install can send. */
export interface NotificationSettingsDto {
  /** Web push is set up on the server (VAPID keys). */
  pushAvailable: boolean;
  /** The server's VAPID public key, for the browser to subscribe with. */
  vapidPublicKey: string | null;
  /** Email is set up on the server (SMTP). */
  emailAvailable: boolean;
  emailDigest: boolean;
  /** Browsers and phones this member turned push on for. */
  pushDevices: number;
  /** The hour reminders go out, in the server's time zone. */
  reminderHour: number;
}

export interface PushSubscriptionDto {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
