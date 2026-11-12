import type { TodayTaskDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { digestEmail, pushMessage } from './messages';

const task = (title: string, kind: TodayTaskDto['kind'], gardenName = 'Home'): TodayTaskDto => ({
  gardenId: gardenName,
  gardenName,
  kind,
  title,
  bedName: kind === 'thisWeek' ? null : 'North',
});

describe('pushMessage', () => {
  it('names up to three care tasks and counts the rest; sowing alone sends nothing', () => {
    const one = JSON.parse(pushMessage([task('Water Basil', 'dueToday')])!);
    expect(one.notification.title).toBe('1 garden task today');
    expect(one.notification.body).toBe('Water Basil');
    expect(one.notification.data.onActionClick.default.url).toBe('/today');
    const five = JSON.parse(
      pushMessage(['A', 'B', 'C', 'D', 'E'].map((t) => task(`Water ${t}`, 'overdue')))!,
    );
    expect(five.notification.title).toBe('5 garden tasks today');
    expect(five.notification.body).toBe('Water A, Water B, Water C, and 2 more');
    expect(pushMessage([task('Start Kale', 'thisWeek')])).toBeNull();
    expect(pushMessage([])).toBeNull();
  });
});

describe('digestEmail', () => {
  it('lists tasks by property with a link, and says why it was sent', () => {
    const mail = digestEmail(
      [
        task('Water Basil', 'dueToday'),
        task('Harvest Radish', 'overdue', 'Allotment'),
        task('Start Kale', 'thisWeek'),
      ],
      'https://garden.example/',
    )!;
    expect(mail.subject).toBe('Open Garden: 2 tasks today');
    expect(mail.text).toContain(
      'Home\n- Water Basil, North (due today)\n- Start Kale (start this week)',
    );
    expect(mail.text).toContain('Allotment\n- Harvest Radish, North (overdue)');
    expect(mail.text).toContain('Open Today: https://garden.example/today');
    expect(mail.text).toContain('Turn it off on the Today page.');
  });

  it('has a sowing-only subject, no link without a URL, and nothing for no tasks', () => {
    const mail = digestEmail([task('Start Kale', 'thisWeek')], '')!;
    expect(mail.subject).toBe('Open Garden: crops to start this week');
    expect(mail.text).not.toContain('Open Today');
    expect(digestEmail([task('Water Basil', 'dueToday')], '')!.subject).toBe(
      'Open Garden: 1 task today',
    );
    expect(digestEmail([], '')).toBeNull();
  });
});
