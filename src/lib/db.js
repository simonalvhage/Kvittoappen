import * as SQLite from 'expo-sqlite';

const DB_NAME = 'kvittoappen.db';

let _db = null;

export async function getDB() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(_db);
  return _db;
}

async function migrate(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'resa',
      start_date TEXT,
      end_date TEXT,
      emoji TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER,
      trip_day TEXT,
      store TEXT,
      purchased_at TEXT,
      currency TEXT,
      total REAL,
      total_sek REAL,
      fx_rate REAL,
      card TEXT,
      image_path TEXT,
      raw_json TEXT,
      note TEXT,
      split_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS receipt_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id INTEGER NOT NULL,
      name_original TEXT,
      name_sv TEXT,
      price REAL,
      quantity REAL DEFAULT 1,
      position INTEGER DEFAULT 0,
      FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_receipts_trip ON receipts(trip_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_purchased ON receipts(purchased_at);
    CREATE INDEX IF NOT EXISTS idx_items_receipt ON receipt_items(receipt_id);
  `);
}

// --- Trips ---

export async function listTrips() {
  const db = await getDB();
  return db.getAllAsync(`
    SELECT t.*,
      (SELECT COUNT(*) FROM receipts r WHERE r.trip_id = t.id) AS receipt_count,
      (SELECT COALESCE(SUM(r.total_sek), SUM(r.total)) FROM receipts r WHERE r.trip_id = t.id) AS total_sek
    FROM trips t
    ORDER BY COALESCE(t.start_date, t.created_at) DESC
  `);
}

export async function getTrip(id) {
  const db = await getDB();
  return db.getFirstAsync('SELECT * FROM trips WHERE id = ?', [id]);
}

export async function createTrip({ name, kind = 'resa', start_date = null, end_date = null, emoji = null }) {
  const db = await getDB();
  const res = await db.runAsync(
    'INSERT INTO trips (name, kind, start_date, end_date, emoji) VALUES (?, ?, ?, ?, ?)',
    [name, kind, start_date, end_date, emoji]
  );
  return res.lastInsertRowId;
}

export async function updateTrip(id, { name, start_date, end_date, emoji, kind }) {
  const db = await getDB();
  await db.runAsync(
    'UPDATE trips SET name = ?, kind = ?, start_date = ?, end_date = ?, emoji = ? WHERE id = ?',
    [name, kind, start_date, end_date, emoji, id]
  );
}

export async function deleteTrip(id) {
  const db = await getDB();
  await db.runAsync('UPDATE receipts SET trip_id = NULL, trip_day = NULL WHERE trip_id = ?', [id]);
  await db.runAsync('DELETE FROM trips WHERE id = ?', [id]);
}

// --- Receipts ---

export async function listInboxReceipts() {
  const db = await getDB();
  return db.getAllAsync(`
    SELECT * FROM receipts WHERE trip_id IS NULL ORDER BY created_at DESC
  `);
}

export async function listAllReceipts() {
  const db = await getDB();
  return db.getAllAsync(`
    SELECT r.*, t.name AS trip_name, t.emoji AS trip_emoji
    FROM receipts r LEFT JOIN trips t ON r.trip_id = t.id
    ORDER BY COALESCE(r.purchased_at, r.created_at) DESC
  `);
}

export async function listReceiptsByTrip(tripId) {
  const db = await getDB();
  return db.getAllAsync(
    'SELECT * FROM receipts WHERE trip_id = ? ORDER BY COALESCE(purchased_at, created_at) ASC',
    [tripId]
  );
}

export async function getReceipt(id) {
  const db = await getDB();
  return db.getFirstAsync('SELECT * FROM receipts WHERE id = ?', [id]);
}

export async function getReceiptItems(receiptId) {
  const db = await getDB();
  return db.getAllAsync(
    'SELECT * FROM receipt_items WHERE receipt_id = ? ORDER BY position ASC, id ASC',
    [receiptId]
  );
}

export async function createReceiptFromParsed({ parsed, imagePath, fxRate, totalSek }) {
  const db = await getDB();
  const res = await db.runAsync(
    `INSERT INTO receipts
      (store, purchased_at, currency, total, total_sek, fx_rate, card, image_path, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      parsed.store || null,
      parsed.date || null,
      parsed.currency || null,
      parsed.total ?? null,
      totalSek ?? null,
      fxRate ?? null,
      parsed.card || null,
      imagePath || null,
      JSON.stringify(parsed),
    ]
  );
  const receiptId = res.lastInsertRowId;
  const items = parsed.items || [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    await db.runAsync(
      `INSERT INTO receipt_items (receipt_id, name_original, name_sv, price, quantity, position)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [receiptId, it.name_original || it.name || null, it.name_sv || null, it.price ?? null, it.quantity ?? 1, i]
    );
  }
  return receiptId;
}

export async function assignReceipt(receiptId, { tripId, tripDay }) {
  const db = await getDB();
  await db.runAsync(
    'UPDATE receipts SET trip_id = ?, trip_day = ? WHERE id = ?',
    [tripId ?? null, tripDay ?? null, receiptId]
  );
}

export async function setReceiptSplit(receiptId, count) {
  const db = await getDB();
  await db.runAsync('UPDATE receipts SET split_count = ? WHERE id = ?', [Math.max(1, count | 0), receiptId]);
}

export async function updateReceipt(id, fields) {
  const db = await getDB();
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = ?`).join(', ');
  const vals = keys.map((k) => fields[k]);
  await db.runAsync(`UPDATE receipts SET ${set} WHERE id = ?`, [...vals, id]);
}

export async function deleteReceipt(id) {
  const db = await getDB();
  await db.runAsync('DELETE FROM receipts WHERE id = ?', [id]);
}

// --- Stats ---

export async function statsTotal() {
  const db = await getDB();
  return db.getFirstAsync(`
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(COALESCE(total_sek, total)), 0) AS total_sek
    FROM receipts
  `);
}

export async function statsByStore() {
  const db = await getDB();
  return db.getAllAsync(`
    SELECT
      COALESCE(store, 'Okänd butik') AS store,
      COUNT(*) AS count,
      COALESCE(SUM(COALESCE(total_sek, total)), 0) AS total_sek
    FROM receipts
    GROUP BY COALESCE(store, 'Okänd butik')
    ORDER BY total_sek DESC
  `);
}
