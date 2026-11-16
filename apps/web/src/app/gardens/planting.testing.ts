import type { ClientPlanting } from './plantings-offline.queue';

/** A planting for component tests. */
export const planting = (over: Partial<ClientPlanting> = {}): ClientPlanting => ({
  id: 'p1',
  plantId: 'tomato',
  commonName: 'Tomato',
  species: 'Solanum lycopersicum',
  cultivar: null,
  plantType: 'vegetable',
  status: 'active',
  plantedOn: '2027-05-01',
  harvestedOn: null,
  bedId: null,
  startMethod: 'direct_seed',
  indoorStartedOn: null,
  life: 'annual',
  createdAt: '',
  updatedAt: '',
  ...over,
});
