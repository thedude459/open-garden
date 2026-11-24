import { describe, expect, it } from 'vitest';
import { gardenAccess, roleAllows } from './garden-access';

const refused = () => new Error('refused');

describe('gardenAccess', () => {
  it('hides the property from non-members', () => {
    expect(() => gardenAccess(null, 'view', refused)).toThrow('Garden not found');
  });

  it('lets viewers read, collaborators edit, and only owners own', () => {
    expect(gardenAccess({ role: 'viewer' }, 'view', refused)).toEqual({ role: 'viewer' });
    expect(() => gardenAccess({ role: 'viewer' }, 'edit', refused)).toThrow('refused');
    expect(gardenAccess({ role: 'collaborator' }, 'edit', refused).role).toBe('collaborator');
    expect(() => gardenAccess({ role: 'collaborator' }, 'own', refused)).toThrow('refused');
    expect(gardenAccess({ role: 'owner' }, 'own', refused).role).toBe('owner');
  });

  it('gives an unknown role nothing', () => {
    expect(roleAllows('admin', 'view')).toBe(false);
  });
});
