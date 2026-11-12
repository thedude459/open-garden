export type CareKind = 'water' | 'fertilize' | 'harvest';

/** The task as a verb: "Water", "Fertilize", "Harvest". */
export const CARE_VERBS: Record<CareKind, string> = {
  water: 'Water',
  fertilize: 'Fertilize',
  harvest: 'Harvest',
};
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
  bedId?: string | null;
  bedName?: string | null;
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
