import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SQLite from 'expo-sqlite'

export type InstallationRow = {
  id: string
  name: string
  savedAt: number
  thumb: string | null
  schemaVersion: number
  doc: unknown
}

const LIB_KEY_V1 = 'gatetouch_library_v1'
const LIB_KEY_V2 = 'gatetouch_library_v2'

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

async function openDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('gatetouch.db')
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS installations (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          saved_at INTEGER NOT NULL,
          thumb TEXT,
          schema_version INTEGER NOT NULL,
          doc TEXT NOT NULL
        );
      `)
      return db
    })()
  }
  return dbPromise
}

async function loadFromAsyncStorage(): Promise<InstallationRow[]> {
  try {
    const v2 = await AsyncStorage.getItem(LIB_KEY_V2)
    const raw = v2 ?? (await AsyncStorage.getItem(LIB_KEY_V1))
    if (!raw) return []
    const arr = JSON.parse(raw) as Array<Record<string, unknown>>
    return arr
      .map((e) => ({
        id: String(e.id ?? ''),
        name: String(e.name ?? 'Installation'),
        savedAt: typeof e.savedAt === 'number' ? e.savedAt : Date.now(),
        thumb: typeof e.thumb === 'string' ? e.thumb : null,
        schemaVersion: typeof e.schemaVersion === 'number' ? e.schemaVersion : 0,
        doc: e.doc,
      }))
      .filter((e) => e.id)
  } catch {
    return []
  }
}

export async function loadInstallations(): Promise<InstallationRow[]> {
  try {
    const db = await openDb()
    const rows = await db.getAllAsync<{
      id: string
      name: string
      saved_at: number
      thumb: string | null
      schema_version: number
      doc: string
    }>('SELECT id, name, saved_at, thumb, schema_version, doc FROM installations ORDER BY saved_at DESC')
    if (rows.length) {
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        savedAt: r.saved_at,
        thumb: r.thumb,
        schemaVersion: r.schema_version,
        doc: JSON.parse(r.doc) as unknown,
      }))
    }
    const legacy = await loadFromAsyncStorage()
    if (legacy.length) await replaceInstallations(legacy)
    return legacy
  } catch {
    return loadFromAsyncStorage()
  }
}

export async function replaceInstallations(lib: InstallationRow[]): Promise<void> {
  const db = await openDb()
  const keep = new Set(lib.map((e) => e.id))
  await db.withTransactionAsync(async () => {
    const existing = await db.getAllAsync<{ id: string }>('SELECT id FROM installations')
    for (const row of existing) {
      if (!keep.has(row.id)) {
        await db.runAsync('DELETE FROM installations WHERE id = ?', row.id)
      }
    }
    for (const e of lib) {
      await db.runAsync(
        `INSERT INTO installations (id, name, saved_at, thumb, schema_version, doc)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           saved_at = excluded.saved_at,
           thumb = excluded.thumb,
           schema_version = excluded.schema_version,
           doc = excluded.doc`,
        e.id,
        e.name,
        e.savedAt,
        e.thumb,
        e.schemaVersion,
        JSON.stringify(e.doc),
      )
    }
  })
}
