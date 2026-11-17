import type { TodayDto, TodayTaskDto } from '@open-garden/shared-types';
import { describe, expect, it } from 'vitest';
import { alertAdvice, alertHeadline, digestEmail, pushMessage } from './messages';

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

const frost: NonNullable<TodayDto['alerts']>[number] = {
  gardenId: 'g1',
  gardenName: 'Home',
  kind: 'frost',
  date: '2026-11-18',
  tempC: -2,
  plantings: [
    { name: 'Tomato', bedName: 'North' },
    { name: 'Basil', bedName: null },
  ],
};

describe('weather alerts in messages', () => {
  it('says when, how cold or hot in the member\u2019s units, and what to do', () => {
    expect(alertHeadline(frost, 'metric')).toBe('Frost likely Wed, Nov 18 (low -2 °C)');
    expect(alertHeadline(frost, 'imperial')).toBe('Frost likely Wed, Nov 18 (low 28 °F)');
    expect(alertAdvice(frost)).toBe('cover Tomato (North), Basil');
    const heat = {
      ...frost,
      kind: 'heat' as const,
      tempC: 33,
      plantings: [{ name: 'Lettuce', bedName: 'South' }],
    };
    expect(alertHeadline(heat, 'metric')).toBe('Heat Wed, Nov 18 (high 33 °C)');
    expect(alertAdvice(heat)).toBe('shade and water Lettuce (South)');
  });

  it('pushes a frost warning even with no care due, and puts it ahead of the tasks', () => {
    const alone = JSON.parse(pushMessage([], [frost], 'metric')!);
    expect(alone.notification.title).toBe('Frost likely Wed, Nov 18 (low -2 °C)');
    expect(alone.notification.body).toBe('Home: cover Tomato (North), Basil');
    const both = JSON.parse(pushMessage([task('Water Basil', 'dueToday')], [frost], 'metric')!);
    expect(both.notification.body).toBe('Home: cover Tomato (North), Basil. 1 garden task today');
  });

  it('emails the warning under its property, with it in the subject', () => {
    const mail = digestEmail([task('Water Basil', 'dueToday')], '', [frost], 'imperial')!;
    expect(mail.subject).toBe('Open Garden: frost likely Wed, Nov 18');
    expect(mail.text).toContain(
      'Home\n- Frost likely Wed, Nov 18 (low 28 °F): cover Tomato (North), Basil\n- Water Basil, North (due today)',
    );
    expect(digestEmail([], '', [frost])!.subject).toBe('Open Garden: frost likely Wed, Nov 18');
  });
});
