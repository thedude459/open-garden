import { domainError } from './domain-error';
import type { GardenRole } from './garden';

/** What a member wants to do with a property. */
export type GardenAccess = 'view' | 'edit' | 'own';

const ALLOWED: Record<GardenAccess, readonly GardenRole[]> = {
  view: ['owner', 'collaborator', 'viewer'],
  edit: ['owner', 'collaborator'],
  own: ['owner'],
};

/** Whether a role may do this; an unknown role may do nothing. */
export function roleAllows(role: string, access: GardenAccess): boolean {
  return (ALLOWED[access] as readonly string[]).includes(role);
}

/**
 * The one permission check (principle V): a non-member gets "Garden not
 * found", so a property's existence does not leak, and a member whose role
 * falls short gets `refused`. Returns the membership for the caller to use.
 */
export function gardenAccess<M extends { role: string }>(
  membership: M | null | undefined,
  access: GardenAccess,
  refused: () => Error,
): M {
  if (!membership) throw domainError('NOT_FOUND', 'Garden not found');
  if (!roleAllows(membership.role, access)) throw refused();
  return membership;
}
