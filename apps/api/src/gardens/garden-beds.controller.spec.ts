import { describe, expect, it } from 'vitest';
import { bedCreateSchema } from '@open-garden/shared-types';
import { bedProblem } from './garden-beds.controller';

const firstIssue = (body: unknown) => {
  const parsed = bedCreateSchema.safeParse(body);
  return parsed.success ? undefined : parsed.error.issues[0];
};

describe('bedProblem', () => {
  it('says the name is required when it is missing', () => {
    expect(bedProblem(firstIssue({ lengthInches: 48, widthInches: 24 }))).toBe(
      'Bed name is required',
    );
  });

  it('names the field that is wrong, not the name', () => {
    expect(
      bedProblem(firstIssue({ name: 'North', lengthInches: 'long', widthInches: 24 })),
    ).toMatch(/^Check the bed's lengthInches: /);
  });
});
