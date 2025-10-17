import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

type SQLValue = string | number | null | Uint8Array;
type SQLParams = SQLValue[] | Record<string, SQLValue> | undefined;

type StatementResult<T> = {
  rows: T[];
  changes: number;
  lastInsertRowId: number;
};

const DATABASE_NAME = 'app.db';
const TABLE_NAME = 'items';
const TARGET_SCHEMA_VERSION = 4;
const REQUIRED_COLUMNS = [
  'id',
  'user_id',
  'name',
  'barcode',
  'quantity',
  'unit',
  'purchase_date',
  'expiry_date',
  'location',
  'notes',
  'created_at',
  'updated_at',
] as const;

const CREATE_TABLE_STATEMENT = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  barcode TEXT,
  quantity REAL DEFAULT 1,
  unit TEXT,
  purchase_date TEXT,
  expiry_date TEXT,
  location TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);`;

const db = openDatabaseSync(DATABASE_NAME);

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

const isSchemaError = (error: unknown) =>
  error instanceof Error && /no such (table|column)/i.test(error.message);

const normalizeParams = (params: SQLParams): SQLParams => {
  if (Array.isArray(params)) {
    return params.map((value) => (value === undefined ? null : value)) as SQLValue[];
  }
  if (params && typeof params === 'object') {
    return Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, value === undefined ? null : value])
    );
  }
  return params;
};

async function executeOnDatabase<T>(
  database: SQLiteDatabase,
  sql: string,
  params: SQLParams = []
): Promise<StatementResult<T>> {
  const statement = await database.prepareAsync(sql);
  try {
    const result = await statement.executeAsync<T>(normalizeParams(params) ?? []);
    const rows = await result.getAllAsync();
    return {
      rows,
      changes: result.changes,
      lastInsertRowId: result.lastInsertRowId,
    };
  } finally {
    await statement.finalizeAsync();
  }
}

const exec = async (database: SQLiteDatabase, sql: string) => {
  await database.execAsync(sql);
};

async function runMigrations() {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.withExclusiveTransactionAsync(async (txn: SQLiteDatabase) => {
    const [{ user_version: currentVersionValue = 0 } = {}] = await executeOnDatabase<{
      user_version: number;
    }>(txn, 'PRAGMA user_version;').then((result) => result.rows);

    let version = Number(currentVersionValue ?? 0);

    if (version < 1) {
      await exec(txn, CREATE_TABLE_STATEMENT);
      version = 1;
      await exec(txn, 'PRAGMA user_version = 1;');
    }

    const getTableInfo = async () =>
      executeOnDatabase<{ name: string }>(txn, `PRAGMA table_info(${TABLE_NAME});`).then(
        (result) => result.rows
      );

    if (version < 2) {
      const tableInfo = await getTableInfo();
      const hasPurchaseDate = tableInfo.some((column) => column.name === 'purchase_date');
      if (!hasPurchaseDate) {
        await exec(txn, `ALTER TABLE ${TABLE_NAME} ADD COLUMN purchase_date TEXT;`);
      }

      version = 2;
      await exec(txn, 'PRAGMA user_version = 2;');
    }

    if (version < 3) {
      const tableInfo = await getTableInfo();
      const hasCreatedAt = tableInfo.some((column) => column.name === 'created_at');
      if (!hasCreatedAt) {
        await exec(txn, `ALTER TABLE ${TABLE_NAME} ADD COLUMN created_at TEXT;`);
      }
      version = 3;
      await exec(txn, 'PRAGMA user_version = 3;');
    }

    if (version < TARGET_SCHEMA_VERSION) {
      const tableInfo = await getTableInfo();
      const hasUserId = tableInfo.some((column) => column.name === 'user_id');
      if (!hasUserId) {
        await exec(txn, `ALTER TABLE ${TABLE_NAME} ADD COLUMN user_id TEXT;`);
      }
      version = TARGET_SCHEMA_VERSION;
    }

    const tableInfo = await getTableInfo();
    const existingColumns = new Set(tableInfo.map((column) => column.name));
    const missingColumns = REQUIRED_COLUMNS.filter((column) => !existingColumns.has(column));

    if (missingColumns.length > 0) {
      const tempTable = `${TABLE_NAME}_temp_migrate`;
      await exec(txn, CREATE_TABLE_STATEMENT.replace(`${TABLE_NAME}`, tempTable));

      const selectList = REQUIRED_COLUMNS.map((column) =>
        existingColumns.has(column) ? column : `NULL AS ${column}`
      ).join(', ');

      await exec(
        txn,
        `INSERT INTO ${tempTable} (${REQUIRED_COLUMNS.join(', ')}) SELECT ${selectList} FROM ${TABLE_NAME};`
      );
      await exec(txn, `DROP TABLE ${TABLE_NAME};`);
      await exec(txn, `ALTER TABLE ${tempTable} RENAME TO ${TABLE_NAME};`);
    }

    const finalVersion = Math.max(version, TARGET_SCHEMA_VERSION);
    await exec(txn, `PRAGMA user_version = ${finalVersion};`);
  });
}

async function ensureInitialized(retry = false) {
  if (isInitialized && !retry) {
    return;
  }

  if (!initializationPromise || retry) {
    initializationPromise = (async () => {
      try {
        await runMigrations();
        isInitialized = true;
      } catch (error) {
        isInitialized = false;
        throw error;
      }
    })().finally(() => {
      initializationPromise = null;
    });
  }

  await initializationPromise;
}

async function execute<T>(
  sql: string,
  params: SQLParams = [],
  isRetry = false
): Promise<StatementResult<T>> {
  await ensureInitialized();
  try {
    return await executeOnDatabase<T>(db, sql, params);
  } catch (error) {
    if (!isRetry && isSchemaError(error)) {
      console.warn('[sqlite] Schema mismatch detected, rerunning migrations.', error);
      await ensureInitialized(true);
      return execute<T>(sql, params, true);
    }
    throw error;
  }
}

export const query = async <T = Record<string, unknown>>(
  sql: string,
  params: SQLParams = []
): Promise<T[]> => {
  const result = await execute<T>(sql, params);
  return result.rows;
};

export const run = async (sql: string, params: SQLParams = []) => {
  await execute(sql, params);
};

export const transaction = async (callback: () => Promise<void>) => {
  await ensureInitialized();
  return db.withTransactionAsync(callback);
};

export async function initDb(force = false) {
  if (force) {
    isInitialized = false;
  }
  await ensureInitialized(force);
}

export { TABLE_NAME };
