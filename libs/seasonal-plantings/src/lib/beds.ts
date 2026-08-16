import { PLANTING_ERRORS } from './domain-error';

export function normalizeBedName(raw: string): { name: string; nameNormalized: string } {
  const name = raw.trim();
  if (!name) throw PLANTING_ERRORS.bedNameRequired();
  if (name.length > 120) throw PLANTING_ERRORS.bedNameTooLong();
  return { name, nameNormalized: name.toLowerCase() };
}
