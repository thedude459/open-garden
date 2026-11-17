export { domainError, CARE_ERRORS } from './lib/domain-error';
export { addIsoDateDays, diffIsoDateDays, isIsoDate } from './lib/dates';
export { deriveReminders, type DerivePlantingInput, type DeriveEventInput } from './lib/derive';
export { deriveIndoorReminders, type IndoorDerivePlantingInput } from './lib/derive-indoor';
export { sortReminders } from './lib/sort';
export { applyRainCover, RAIN_NOTE } from './lib/rain-cover';
export { weatherAlerts, type AlertPlanting } from './lib/weather-alerts';
export {
  WATER_DUE_MM,
  bedWaterFactor,
  kcOnDay,
  waterDue,
  type DayWater,
  type WaterDue,
} from './lib/water-balance';
export { CareReminderService } from './lib/care-reminder-service';
