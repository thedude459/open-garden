import { describe, expect, it } from 'vitest';
import { authLoginSchema, authRegisterSchema, plantListQuerySchema } from './plant.schemas';

describe('plantListQuerySchema', () => {
  it('applies defaults for page and pageSize', () => {
    const parsed = plantListQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
  });

  it('coerces zone and rejects invalid plantType', () => {
    expect(plantListQuerySchema.parse({ zone: '7' }).zone).toBe(7);
    expect(() => plantListQuerySchema.parse({ plantType: 'alien' })).toThrow();
  });
});

describe('auth schemas', () => {
  it('accepts login credentials', () => {
    const parsed = authLoginSchema.parse({
      email: 'gardener@example.com',
      password: 'x',
    });
    expect(parsed.email).toBe('gardener@example.com');
  });

  it('rejects short passwords on register', () => {
    expect(() =>
      authRegisterSchema.parse({ email: 'a@b.com', password: 'short' }),
    ).toThrow();
  });
});
