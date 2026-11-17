import { formatTemperature } from '@open-garden/garden-layout';
import type { TodayDto, TodayTaskDto, Units, WeatherAlertDto } from '@open-garden/shared-types';

type Alert = NonNullable<TodayDto['alerts']>[number];

/** "Wed, Nov 18" for a YYYY-MM-DD day; the app is English only (ADR 0029). */
function weekday(day: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${day}T00:00:00Z`));
}

/** "Frost likely Wed, Nov 18 (low 28 °F)" or "Heat Thu, Jul 2 (high 95 °F)". */
export function alertHeadline(alert: WeatherAlertDto, units: Units = 'imperial'): string {
  const temp = formatTemperature(alert.tempC, units);
  return alert.kind === 'frost'
    ? `Frost likely ${weekday(alert.date)} (low ${temp})`
    : `Heat ${weekday(alert.date)} (high ${temp})`;
}

/** What to do and for which plants: "cover Tomato (North), Basil (North)". */
export function alertAdvice(alert: WeatherAlertDto): string {
  const plants = alert.plantings
    .map((p) => (p.bedName ? `${p.name} (${p.bedName})` : p.name))
    .join(', ');
  return alert.kind === 'frost' ? `cover ${plants}` : `shade and water ${plants}`;
}

/** Care to do now: overdue or due today, not crops to start. */
function careTasks(tasks: TodayTaskDto[]) {
  return tasks.filter((task) => task.kind !== 'thisWeek');
}

/**
 * One push for the day, or null when no care is due. The shape is what the
 * Angular service worker shows as a notification; a tap opens Today.
 */
export function pushMessage(
  tasks: TodayTaskDto[],
  alerts: Alert[] = [],
  units?: Units,
): string | null {
  const care = careTasks(tasks);
  if (care.length === 0 && alerts.length === 0) return null;
  const first = care.slice(0, 3).map((task) => task.title);
  const more = care.length - first.length;
  const tasksTitle =
    care.length === 1 ? '1 garden task today' : `${care.length} garden tasks today`;
  const tasksBody = first.join(', ') + (more > 0 ? `, and ${more} more` : '');
  // Weather comes first: it is what cannot wait.
  const alert = alerts[0];
  const title = alert ? alertHeadline(alert, units) : tasksTitle;
  const body = alert
    ? [`${alert.gardenName}: ${alertAdvice(alert)}`, care.length ? tasksTitle : '']
        .filter(Boolean)
        .join('. ')
    : tasksBody;
  return JSON.stringify({
    notification: {
      title,
      body,
      icon: '/assets/icon-512.png',
      tag: 'open-garden-today',
      data: {
        onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: '/today' } },
      },
    },
  });
}

/** The daily email, or null when there is nothing to say. Plain text. */
export function digestEmail(
  tasks: TodayTaskDto[],
  appUrl: string,
  alerts: Alert[] = [],
  units?: Units,
): { subject: string; text: string } | null {
  if (tasks.length === 0 && alerts.length === 0) return null;
  const lines: string[] = [];
  const names = [...tasks.map((task) => task.gardenName), ...alerts.map((a) => a.gardenName)];
  for (const gardenName of [...new Set(names)]) {
    lines.push(gardenName);
    for (const alert of alerts.filter((a) => a.gardenName === gardenName)) {
      lines.push(`- ${alertHeadline(alert, units)}: ${alertAdvice(alert)}`);
    }
    for (const task of tasks.filter((t) => t.gardenName === gardenName)) {
      const when =
        task.kind === 'overdue'
          ? 'overdue'
          : task.kind === 'dueToday'
            ? 'due today'
            : 'start this week';
      const bed = task.bedName ? `, ${task.bedName}` : '';
      lines.push(`- ${task.title}${bed} (${when})`);
    }
    lines.push('');
  }
  const care = careTasks(tasks).length;
  const alert = alerts[0];
  const subject = alert
    ? `Open Garden: ${alert.kind === 'frost' ? 'frost likely' : 'heat'} ${weekday(alert.date)}`
    : care > 0
      ? `Open Garden: ${care} ${care === 1 ? 'task' : 'tasks'} today`
      : 'Open Garden: crops to start this week';
  const link = appUrl ? `Open Today: ${appUrl.replace(/\/$/, '')}/today\n\n` : '';
  const text =
    lines.join('\n') +
    link +
    'You get this because daily email is on for your account. Turn it off on the Today page.\n';
  return { subject, text };
}
