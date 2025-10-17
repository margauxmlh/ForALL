CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  barcode TEXT,
  quantity REAL,
  unit TEXT,
  purchase_date TEXT,
  expiry_date TEXT,
  location TEXT,
  notes TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  start TEXT,
  end TEXT,
  location TEXT,
  notes TEXT,
  sharedWithPartner INTEGER
);

CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  ingredients TEXT,
  steps TEXT,
  images TEXT,
  tags TEXT,
  rating INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS recipe_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipeId INTEGER,
  author TEXT,
  content TEXT,
  createdAt TEXT
);
