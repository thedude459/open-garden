import { describe, expect, it } from 'vitest';
import {
  authLoginSchema,
  authRegisterSchema,
  changePasswordSchema,
  passwordResetSchema,
  plantListQuerySchema,
} from './plant.schemas';

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
    expect(() => authRegisterSchema.parse({ email: 'a@b.com', password: 'short' })).toThrow();
  });

  it('refuses a new password longer than the 72 bytes bcrypt reads', () => {
    const ok = authRegisterSchema.safeParse({ email: 'a@b.com', password: 'a'.repeat(72) });
    expect(ok.success).toBe(true);
    const long = authRegisterSchema.safeParse({ email: 'a@b.com', password: 'a'.repeat(73) });
    expect(long.success).toBe(false);
    // 19 emoji are 76 bytes though only 19 characters.
    const emoji = changePasswordSchema.safeParse({
      currentPassword: 'x',
      newPassword: '🌱'.repeat(19),
    });
    expect(emoji.success).toBe(false);
    expect(
      passwordResetSchema.safeParse({ token: 'a'.repeat(64), password: 'b'.repeat(73) }).success,
    ).toBe(false);
  });
});
