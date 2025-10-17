import { create } from 'zustand';
import {
  addItem as addItemService,
  deleteItem as deleteItemService,
  getItems as getItemsService,
  subscribeRealtime as subscribeRealtimeService,
  updateItem as updateItemService,
  type FridgeItem,
  type FridgeItemInput,
} from '../services/fridgeService';
import { sortItemsByExpiry } from '../utils/fridge';

type FridgeState = {
  items: FridgeItem[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  add: (input: FridgeItemInput) => Promise<FridgeItem>;
  update: (item: FridgeItem) => Promise<FridgeItem>;
  remove: (id: string) => Promise<void>;
  subscribeRealtime: () => Promise<() => void>;
};

let unsubscribeRealtime: (() => void) | null = null;

const parseError = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const useFridgeStore = create<FridgeState>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  async load() {
    set({ loading: true, error: null });
    try {
      const items = await getItemsService();
      set({ items: sortItemsByExpiry(items), loading: false });
    } catch (error) {
      set({ error: parseError(error), loading: false });
      throw error;
    }
  },

  async add(input) {
    set({ error: null });
    try {
      const item = await addItemService(input);
      set((state) => ({
        items: sortItemsByExpiry([...state.items, item]),
      }));
      return item;
    } catch (error) {
      set({ error: parseError(error) });
      throw error;
    }
  },

  async update(item) {
    set({ error: null });
    try {
      const updated = await updateItemService(item);
      set((state) => ({
        items: sortItemsByExpiry(state.items.map((it) => (it.id === updated.id ? updated : it))),
      }));
      return updated;
    } catch (error) {
      set({ error: parseError(error) });
      throw error;
    }
  },

  async remove(id) {
    set({ error: null });
    try {
      await deleteItemService(id);
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      }));
    } catch (error) {
      set({ error: parseError(error) });
      throw error;
    }
  },

  async subscribeRealtime() {
    if (unsubscribeRealtime) {
      return unsubscribeRealtime;
    }

    const innerUnsubscribe = await subscribeRealtimeService((items) => {
      set({ items: sortItemsByExpiry(items) });
    });

    unsubscribeRealtime = () => {
      innerUnsubscribe?.();
      unsubscribeRealtime = null;
    };

    return unsubscribeRealtime;
  },
}));
