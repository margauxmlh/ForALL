import { PostgrestError } from '@supabase/supabase-js';
import { cancelExpiryReminders, scheduleExpiryReminders } from './notifications';
import { supabase } from './supabase';
import { query, run, transaction, TABLE_NAME as LOCAL_ITEMS_TABLE } from '../db/sqlite';

const REMOTE_TABLE = 'items';
const LOCAL_TABLE = LOCAL_ITEMS_TABLE;

type SupabaseItemRow = {
  id: string;
  user_id: string | null;
  name: string;
  barcode: string | null;
  quantity: number | null;
  unit: string | null;
  purchase_date: string | null;
  expiry_date: string | null;
  location: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SQLiteItemRow = SupabaseItemRow;

export type FridgeItem = {
  id: string;
  userId: string | null;
  name: string;
  barcode: string | null;
  quantity: number | null;
  unit: string | null;
  purchaseDate: string | null;
  expiryDate: string | null;
  location: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type FridgeItemInput = {
  name: string;
  barcode?: string | null;
  quantity?: number | null;
  unit?: string | null;
  purchaseDate?: string | null;
  expiryDate?: string | null;
  location?: string | null;
  notes?: string | null;
};

const localColumns =
  'id, user_id, name, barcode, quantity, unit, purchase_date, expiry_date, location, notes, created_at, updated_at';

const toFridgeItem = (row: SupabaseItemRow): FridgeItem => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  barcode: row.barcode,
  quantity: row.quantity,
  unit: row.unit,
  purchaseDate: row.purchase_date,
  expiryDate: row.expiry_date,
  location: row.location,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapToLocalValues = (item: SupabaseItemRow) => [
  item.id,
  item.user_id ?? null,
  item.name,
  item.barcode ?? null,
  item.quantity ?? null,
  item.unit ?? null,
  item.purchase_date ?? null,
  item.expiry_date ?? null,
  item.location ?? null,
  item.notes ?? null,
  item.created_at ?? null,
  item.updated_at ?? null,
];

const fetchUserId = async (): Promise<string | null> => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[FridgeService] Unable to get session', error);
      return null;
    }
    return data.session?.user?.id ?? null;
  } catch (error) {
    console.warn('[FridgeService] Failed to fetch session', error);
    return null;
  }
};

const generateLocalId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

const getLocalItemsFromDb = async (): Promise<FridgeItem[]> => {
  const rows = await query<SQLiteItemRow>(
    `SELECT ${localColumns} FROM ${LOCAL_TABLE} ORDER BY expiry_date IS NULL, expiry_date ASC`
  );
  return rows.map(toFridgeItem);
};

const getLocalItem = async (id: string): Promise<SQLiteItemRow | null> => {
  const rows = await query<SQLiteItemRow>(`SELECT ${localColumns} FROM ${LOCAL_TABLE} WHERE id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
};

const upsertLocalItem = async (item: SupabaseItemRow) => {
  await run(
    `INSERT OR REPLACE INTO ${LOCAL_TABLE} (id, user_id, name, barcode, quantity, unit, purchase_date, expiry_date, location, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    mapToLocalValues(item)
  );
};

const deleteLocalItem = async (id: string) => {
  await run(`DELETE FROM ${LOCAL_TABLE} WHERE id = ?`, [id]);
};

const replaceLocalItemsForUser = async (userId: string, items: SupabaseItemRow[]) => {
  await transaction(async () => {
    await run(`DELETE FROM ${LOCAL_TABLE} WHERE user_id = ? OR user_id IS NULL`, [userId]);
    for (const item of items) {
      await upsertLocalItem(item);
    }
  });
};

const buildPayload = (item: FridgeItemInput | FridgeItem) => ({
  name: item.name,
  barcode: item.barcode ?? null,
  quantity: item.quantity ?? null,
  unit: item.unit ?? null,
  purchase_date: item.purchaseDate ?? null,
  expiry_date: item.expiryDate ?? null,
  location: item.location ?? null,
  notes: item.notes ?? null,
});

const handlePostgrestError = (context: string, error: PostgrestError | null) => {
  if (error) {
    console.warn(`[FridgeService] ${context}`, error);
    throw new Error(error.message);
  }
};

export async function getItems(): Promise<FridgeItem[]> {
  const localItems = await getLocalItemsFromDb();

  const userId = await fetchUserId();
  if (!userId) {
    return localItems;
  }

  try {
    const { data, error } = await supabase
      .from<SupabaseItemRow>(REMOTE_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('expiry_date', { ascending: true, nullsFirst: false });

    handlePostgrestError('Failed to fetch remote items', error);

    const remoteItems = data ?? [];
    await replaceLocalItemsForUser(userId, remoteItems);
    return remoteItems.map(toFridgeItem);
  } catch (error) {
    console.warn('[FridgeService] Remote sync failed, using local cache', error);
    return localItems;
  }
}

export async function addItem(input: FridgeItemInput): Promise<FridgeItem> {
  const userId = await fetchUserId();
  const now = new Date().toISOString();

  if (!userId) {
    const localRow: SupabaseItemRow = {
      id: generateLocalId(),
      user_id: null,
      name: input.name,
      barcode: input.barcode ?? null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      purchase_date: input.purchaseDate ?? null,
      expiry_date: input.expiryDate ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    };
    await upsertLocalItem(localRow);
    return toFridgeItem(localRow);
  }

  const payload = { ...buildPayload(input), user_id: userId };

  const { data, error } = await supabase.from<SupabaseItemRow>(REMOTE_TABLE).insert(payload).select().single();
  handlePostgrestError('Failed to create item', error);

  if (!data) {
    throw new Error('Unable to create item: Supabase did not return any data.');
  }

  await upsertLocalItem(data);
  return toFridgeItem(data);
}

export async function updateItem(item: FridgeItem): Promise<FridgeItem> {
  const userId = await fetchUserId();
  const existing = await getLocalItem(item.id);

  const payload = buildPayload(item);

  if (!userId) {
    if (!existing) {
      throw new Error("Aliment introuvable dans l'inventaire local.");
    }

    const now = new Date().toISOString();
    const updated: SupabaseItemRow = {
      ...existing,
      ...payload,
      user_id: existing.user_id ?? null,
      created_at: existing.created_at ?? existing.updated_at ?? now,
      updated_at: now,
    };

    await upsertLocalItem(updated);

    const previousExpiry = existing?.expiry_date ?? null;
    const newExpiry = updated.expiry_date ?? null;
    if (previousExpiry !== newExpiry) {
      await cancelExpiryReminders(item.id);
      if (newExpiry) {
        await scheduleExpiryReminders({
          id: updated.id,
          name: updated.name,
          expiryDate: newExpiry,
        });
      }
    }

    return toFridgeItem(updated);
  }

  const { data, error } = await supabase
    .from<SupabaseItemRow>(REMOTE_TABLE)
    .update(payload)
    .eq('id', item.id)
    .eq('user_id', userId)
    .select()
    .single();
  handlePostgrestError('Failed to update item', error);

  if (!data) {
    throw new Error('Unable to update item: Supabase did not return any data.');
  }

  await upsertLocalItem(data);

  const previousExpiry = existing?.expiry_date ?? null;
  const newExpiry = data.expiry_date ?? null;
  if (previousExpiry !== newExpiry) {
    await cancelExpiryReminders(item.id);
    if (newExpiry) {
      await scheduleExpiryReminders({
        id: data.id,
        name: data.name,
        expiryDate: newExpiry,
      });
    }
  }

  return toFridgeItem(data);
}

export async function deleteItem(id: string): Promise<void> {
  const userId = await fetchUserId();

  if (!userId) {
    await deleteLocalItem(id);
    await cancelExpiryReminders(id);
    return;
  }

  const { error } = await supabase.from(REMOTE_TABLE).delete().eq('id', id).eq('user_id', userId);
  handlePostgrestError('Failed to delete item', error);

  await deleteLocalItem(id);
  await cancelExpiryReminders(id);
}

export async function subscribeRealtime(callback: (items: FridgeItem[]) => void) {
  const userId = await fetchUserId();
  if (!userId) {
    return () => undefined;
  }

  const channel = supabase
    .channel(`public:${REMOTE_TABLE}:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: REMOTE_TABLE, filter: `user_id=eq.${userId}` },
      async (payload) => {
        try {
          if (payload.eventType === 'DELETE' && payload.old?.id) {
            await deleteLocalItem(payload.old.id as string);
          } else if (payload.new) {
            await upsertLocalItem(payload.new as SupabaseItemRow);
          }

          const items = await getLocalItemsFromDb();
          callback(items);
        } catch (error) {
          console.warn('[FridgeService] Failed to process realtime payload', error);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn('[FridgeService] Realtime subscription error');
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
