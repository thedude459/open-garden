import type { TodayTaskDto } from '@open-garden/shared-types';

/** Care to do now: overdue or due today, not crops to start. */
function careTasks(tasks: TodayTaskDto[]) {
  return tasks.filter((task) => task.kind !== 'thisWeek');
}

/**
 * One push for the day, or null when no care is due. The shape is what the
 * Angular service worker shows as a notification; a tap opens Today.
 */
export function pushMessage(tasks: TodayTaskDto[]): string | null {
  const care = careTasks(tasks);
  if (care.length === 0) return null;
  const first = care.slice(0, 3).map((task) => task.title);
  const more = care.length - first.length;
  return JSON.stringify({
    notification: {
      title: care.length === 1 ? '1 garden task today' : `${care.length} garden tasks today`,
      body: first.join(', ') + (more > 0 ? `, and ${more} more` : ''),
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
): { subject: string; text: string } | null {
  if (tasks.length === 0) return null;
  const lines: string[] = [];
  for (const gardenName of [...new Set(tasks.map((task) => task.gardenName))]) {
    lines.push(gardenName);
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
  const subject =
    care > 0
      ? `Open Garden: ${care} ${care === 1 ? 'task' : 'tasks'} today`
      : 'Open Garden: crops to start this week';
  const link = appUrl ? `Open Today: ${appUrl.replace(/\/$/, '')}/today\n\n` : '';
  const text =
    lines.join('\n') +
    link +
    'You get this because daily email is on for your account. Turn it off on the Today page.\n';
  return { subject, text };
}
