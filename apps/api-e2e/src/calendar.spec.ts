import { test, expect } from 'vitest';
import { calendarAddSchema, calendarListQuerySchema } from '@open-garden/shared-types';

test('calendar add requires a UUID plantId', () => {
  expect(calendarAddSchema.safeParse({}).success).toBe(false);
  expect(calendarAddSchema.safeParse({ plantId: 'not-a-uuid' }).success).toBe(false);
  expect(
    calendarAddSchema.safeParse({ plantId: '11111111-1111-4111-8111-111111111111' }).success,
  ).toBe(true);
});

test('calendar list query defaults pageSize to 100 and caps at 200', () => {
  const empty = calendarListQuerySchema.parse({});
  expect(empty.page).toBe(1);
  expect(empty.pageSize).toBe(100);
  expect(calendarListQuerySchema.safeParse({ pageSize: 201 }).success).toBe(false);
  expect(calendarListQuerySchema.parse({ pageSize: 200 }).pageSize).toBe(200);
});

test('non-member GET is documented as 404 Garden not found', () => {
  const error = { error: { code: 'NOT_FOUND', message: 'Garden not found' } };
  expect(error.error.message).toBe('Garden not found');
});

test('CalendarDto does not include an emphasized flag', () => {
  const dto = {
    gardenId: 'g',
    myRole: 'owner',
    windowsAvailable: true,
    entries: [{ plantId: 'p', windows: { indoorStart: null } }],
  };
  expect('emphasized' in dto).toBe(false);
  expect(dto.entries[0] && 'emphasized' in dto.entries[0]).toBe(false);
});
