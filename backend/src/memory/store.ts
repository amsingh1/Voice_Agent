// @ts-expect-error sql.js has no type declarations
import initSqlJs from 'sql.js';
type Database = ReturnType<Awaited<ReturnType<typeof initSqlJs>>['prototype']['constructor']> & {
  run: (sql: string, params?: unknown[]) => void;
  prepare: (sql: string) => { bind: (params?: unknown[]) => void; step: () => boolean; getAsObject: () => Record<string, unknown>; free: () => void };
  export: () => Uint8Array;
  close: () => void;
};
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = resolve(__dirname, '../../data');
const DB_PATH = resolve(DATA_DIR, 'conversations.db');

let db: Database;
let saveTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Persist the in-memory SQLite database to disk.
 * Called periodically and on shutdown to avoid data loss.
 */
function persistToDisk(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

export async function initDatabase(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  // Load existing database file if it exists
  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tool_calls (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      arguments TEXT,
      result TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'success', 'error')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tool_calls_conversation ON tool_calls(conversation_id)');

  // Auto-persist every 30 seconds
  saveTimer = setInterval(persistToDisk, 30_000);

  console.log('[Memory] SQLite database initialized (sql.js)');
}

export function createConversation(): string {
  const id = uuidv4();
  db.run('INSERT INTO conversations (id) VALUES (?)', [id]);
  persistToDisk();
  return id;
}

export function addMessage(conversationId: string, role: string, content: string): string {
  const id = uuidv4();
  db.run(
    'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)',
    [id, conversationId, role, content]
  );
  db.run("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?", [conversationId]);
  return id;
}

export function addToolCall(
  conversationId: string,
  toolName: string,
  args: string,
  result: string,
  status: 'success' | 'error' = 'success'
): string {
  const id = uuidv4();
  db.run(
    'INSERT INTO tool_calls (id, conversation_id, tool_name, arguments, result, status) VALUES (?, ?, ?, ?, ?, ?)',
    [id, conversationId, toolName, args, result, status]
  );
  return id;
}

export interface HistoryEntry {
  role: string;
  content: string;
  created_at: string;
}

export function getConversationHistory(conversationId: string): HistoryEntry[] {
  const stmt = db.prepare(
    'SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at'
  );
  stmt.bind([conversationId]);

  const rows: HistoryEntry[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as HistoryEntry;
    rows.push(row);
  }
  stmt.free();
  return rows;
}

/**
 * Get a summary of recent conversation context to inject into new sessions.
 * This enables cross-session memory — MARVIN can recall recent interactions.
 */
export function getRecentContext(maxMessages: number = 20): string {
  const stmt = db.prepare(`
    SELECT m.role, m.content, m.created_at, c.id as conversation_id
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT ?
  `);
  stmt.bind([maxMessages]);

  const rows: Array<{ role: string; content: string; created_at: string }> = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as { role: string; content: string; created_at: string });
  }
  stmt.free();

  if (rows.length === 0) return '';

  // Reverse to chronological order
  rows.reverse();
  return rows
    .map((r) => `[${r.role}] ${r.content}`)
    .join('\n');
}

export function closeDatabase(): void {
  if (saveTimer) {
    clearInterval(saveTimer);
    saveTimer = null;
  }
  if (db) {
    persistToDisk();
    db.close();
  }
}
