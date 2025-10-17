import { act } from 'react-test-renderer';
import { useFridgeStore } from './fridgeStore';
import type { FridgeItem } from '../services/fridgeService';

jest.mock('../services/fridgeService', () => ({
  addItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
  getItems: jest.fn(),
  subscribeRealtime: jest.fn().mockReturnValue(() => undefined),
}));

const fridgeService = jest.requireMock('../services/fridgeService') as {
  addItem: jest.Mock;
  updateItem: jest.Mock;
  deleteItem: jest.Mock;
  getItems: jest.Mock;
  subscribeRealtime: jest.Mock;
};

const baseItem = (overrides: Partial<FridgeItem>): FridgeItem => ({
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

beforeEach(() => {
  jest.clearAllMocks();
  useFridgeStore.setState({
    items: [],
    loading: false,
    error: null,
  });
});

describe('useFridgeStore', () => {
  it('loads and sorts items', async () => {
    fridgeService.getItems.mockResolvedValue([
      baseItem({ id: 'b', name: 'B', expiryDate: '2024-05-10' }),
      baseItem({ id: 'a', name: 'A', expiryDate: '2024-04-01' }),
    ]);

    await act(async () => {
      await useFridgeStore.getState().load();
    });

    const ids = useFridgeStore.getState().items.map((item) => item.id);
    expect(ids).toEqual(['a', 'b']);
  });

  it('adds an item and keeps ordering', async () => {
    useFridgeStore.setState({
      items: [baseItem({ id: 'existing', name: 'Existing', expiryDate: '2024-05-01' })],
      loading: false,
      error: null,
    });

    const newItem = baseItem({ id: 'new', name: 'New', expiryDate: '2024-04-01' });
    fridgeService.addItem.mockResolvedValue(newItem);

    await act(async () => {
      await useFridgeStore.getState().add({
        name: newItem.name,
        expiryDate: newItem.expiryDate,
        barcode: newItem.barcode,
        quantity: newItem.quantity,
        unit: newItem.unit,
        location: newItem.location,
        notes: newItem.notes,
      });
    });

    const ids = useFridgeStore.getState().items.map((item) => item.id);
    expect(ids).toEqual(['new', 'existing']);
  });

  it('updates an item', async () => {
    const initial = baseItem({ id: 'item', name: 'Old name', quantity: 1 });
    useFridgeStore.setState({
      items: [initial],
      loading: false,
      error: null,
    });

    const updated = { ...initial, name: 'New name', quantity: 3 };
    fridgeService.updateItem.mockResolvedValue(updated);

    await act(async () => {
      await useFridgeStore.getState().update(updated);
    });

    const item = useFridgeStore.getState().items.find((entry) => entry.id === 'item');
    expect(item?.name).toBe('New name');
    expect(item?.quantity).toBe(3);
  });

  it('removes an item', async () => {
    const existing = baseItem({ id: 'to-delete', name: 'Delete me' });
    useFridgeStore.setState({
      items: [existing],
      loading: false,
      error: null,
    });
    fridgeService.deleteItem.mockResolvedValue(undefined);

    await act(async () => {
      await useFridgeStore.getState().remove(existing.id);
    });

    expect(useFridgeStore.getState().items).toHaveLength(0);
  });
});
