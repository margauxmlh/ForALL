import type { FridgeItem } from '../services/fridgeService';
import { groupItemsByExpiry, sortItemsByExpiry } from './fridge';

const createItem = (overrides: Partial<FridgeItem>): FridgeItem => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  userId: overrides.userId ?? 'user-1',
  name: overrides.name ?? 'Item',
  barcode: overrides.barcode ?? null,
  quantity: overrides.quantity ?? null,
  unit: overrides.unit ?? null,
  purchaseDate: overrides.purchaseDate ?? null,
  expiryDate: overrides.expiryDate ?? null,
  location: overrides.location ?? null,
  notes: overrides.notes ?? null,
  createdAt: overrides.createdAt ?? null,
  updatedAt: overrides.updatedAt ?? null,
});

describe('sortItemsByExpiry', () => {
  it('orders items by earliest expiry date and pushes items without date to the end', () => {
    const items = [
      createItem({ id: 'no-date', name: 'Sans date', expiryDate: null }),
      createItem({ id: 'later', name: 'Plus tard', expiryDate: '2025-01-10' }),
      createItem({ id: 'soon', name: 'Bientot', expiryDate: '2024-04-02' }),
      createItem({ id: 'today', name: 'Aujourd hui', expiryDate: '2024-04-01' }),
    ];

    const sorted = sortItemsByExpiry(items);
    expect(sorted.map((item) => item.id)).toEqual(['today', 'soon', 'later', 'no-date']);
  });
});

describe('groupItemsByExpiry', () => {
  it('groups items into urgency buckets based on expiry date', () => {
    const reference = new Date('2024-04-01T00:00:00Z');
    const items = [
      createItem({ id: 'expired', name: 'Expire', expiryDate: '2024-03-30' }),
      createItem({ id: 'urgent', name: 'Sous 3 jours', expiryDate: '2024-04-03' }),
      createItem({ id: 'week', name: 'Cette semaine', expiryDate: '2024-04-07' }),
      createItem({ id: 'later', name: 'Plus tard', expiryDate: '2024-04-25' }),
      createItem({ id: 'none', name: 'Sans date', expiryDate: null }),
    ];

    const groups = groupItemsByExpiry(items, reference);

    expect(groups.urgent.map((item) => item.id)).toEqual(['expired', 'urgent']);
    expect(groups.thisWeek.map((item) => item.id)).toEqual(['week']);
    expect(groups.later.map((item) => item.id)).toEqual(['later']);
    expect(groups.noDate.map((item) => item.id)).toEqual(['none']);
  });
});
