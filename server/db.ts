import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, "wordtower.db");

let _db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 1,
        source TEXT NOT NULL DEFAULT 'telegram',
        telegram_user_id TEXT,
        telegram_username TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        moderated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_words_status ON words(status);
      CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);

      CREATE TABLE IF NOT EXISTS users (
        telegram_user_id TEXT PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at);

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_user_id TEXT NOT NULL,
        direction TEXT NOT NULL CHECK(direction IN ('incoming','outgoing')),
        text TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(telegram_user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

      -- backfill users from existing words data
      INSERT OR IGNORE INTO users (telegram_user_id, username)
      SELECT DISTINCT telegram_user_id, telegram_username
      FROM words WHERE telegram_user_id IS NOT NULL;
    `);
  }
  return _db;
}

export function insertWord(
  word: string,
  telegramUserId?: string,
  telegramUsername?: string
) {
  const db = getDB();
  // If same word is already pending, just increment its count
  const existing = db
    .prepare("SELECT id, count FROM words WHERE word = ? AND status = 'pending'")
    .get(word) as { id: number; count: number } | undefined;

  if (existing) {
    db.prepare("UPDATE words SET count = count + 1 WHERE id = ?").run(existing.id);
    return { id: existing.id, word, count: existing.count + 1, isNew: false };
  }

  const result = db
    .prepare(
      "INSERT INTO words (word, source, telegram_user_id, telegram_username) VALUES (?, 'telegram', ?, ?)"
    )
    .run(word, telegramUserId || null, telegramUsername || null);

  return { id: result.lastInsertRowid, word, count: 1, isNew: true };
}

export function getPendingWords() {
  const db = getDB();
  return db
    .prepare(
      "SELECT id, word, count, telegram_username, telegram_user_id, created_at FROM words WHERE status = 'pending' ORDER BY created_at DESC"
    )
    .all();
}

export function approveWord(id: number): boolean {
  const db = getDB();
  const result = db
    .prepare(
      "UPDATE words SET status = 'approved', moderated_at = datetime('now') WHERE id = ? AND status = 'pending'"
    )
    .run(id);
  return result.changes > 0;
}

export function rejectWord(id: number): boolean {
  const db = getDB();
  const result = db
    .prepare(
      "UPDATE words SET status = 'rejected', moderated_at = datetime('now') WHERE id = ? AND status = 'pending'"
    )
    .run(id);
  return result.changes > 0;
}

export function deleteApprovedWord(word: string): boolean {
  const db = getDB();
  const result = db
    .prepare("DELETE FROM words WHERE word = ? AND status = 'approved'")
    .run(word);
  return result.changes > 0;
}

export function getApprovedWordsMap(): Record<string, number> {
  const db = getDB();
  const rows = db
    .prepare(
      "SELECT word, SUM(count) as total FROM words WHERE status = 'approved' GROUP BY word"
    )
    .all() as { word: string; total: number }[];

  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.word] = row.total;
  }
  return map;
}

// ─── Users & Messages ───────────────────────────────────

export function upsertUser(
  telegramUserId: string,
  username?: string,
  firstName?: string,
  lastName?: string
) {
  const db = getDB();
  db.prepare(`
    INSERT INTO users (telegram_user_id, username, first_name, last_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(telegram_user_id) DO UPDATE SET
      username = COALESCE(excluded.username, users.username),
      first_name = COALESCE(excluded.first_name, users.first_name),
      last_name = COALESCE(excluded.last_name, users.last_name),
      last_seen_at = datetime('now')
  `).run(telegramUserId, username || null, firstName || null, lastName || null);
}

export function getUsers() {
  const db = getDB();
  return db.prepare(`
    SELECT u.telegram_user_id, u.username, u.first_name, u.last_name,
           u.first_seen_at, u.last_seen_at,
           (SELECT COUNT(*) FROM messages m WHERE m.telegram_user_id = u.telegram_user_id AND m.direction = 'incoming') as message_count
    FROM users u
    ORDER BY u.last_seen_at DESC
  `).all();
}

export function insertMessage(
  telegramUserId: string,
  direction: "incoming" | "outgoing",
  text: string
) {
  const db = getDB();
  db.prepare(
    "INSERT INTO messages (telegram_user_id, direction, text) VALUES (?, ?, ?)"
  ).run(telegramUserId, direction, text);
}

export function getMessages(telegramUserId: string, limit = 50, offset = 0) {
  const db = getDB();
  return db.prepare(`
    SELECT id, telegram_user_id, direction, text, created_at
    FROM messages
    WHERE telegram_user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(telegramUserId, limit, offset);
}

export function getAllUserIds(): string[] {
  const db = getDB();
  const rows = db.prepare("SELECT telegram_user_id FROM users").all() as { telegram_user_id: string }[];
  return rows.map(r => r.telegram_user_id);
}
