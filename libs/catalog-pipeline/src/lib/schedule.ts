import type { PipelineCadence } from '@open-garden/shared-types';

export function shouldStartScheduled(
  settings: { cadence: PipelineCadence; runAtHourUtc: number },
  now: Date,
  hasRunning: boolean,
  lastScheduledStartedAt: Date | null,
): boolean {
  if (hasRunning) return false;
  if (settings.cadence !== 'daily') return false;
  if (now.getUTCHours() !== settings.runAtHourUtc) return false;
  if (lastScheduledStartedAt) {
    const sameUtcDay =
      lastScheduledStartedAt.getUTCFullYear() === now.getUTCFullYear() &&
      lastScheduledStartedAt.getUTCMonth() === now.getUTCMonth() &&
      lastScheduledStartedAt.getUTCDate() === now.getUTCDate();
    if (sameUtcDay) return false;
  }
  return true;
}
