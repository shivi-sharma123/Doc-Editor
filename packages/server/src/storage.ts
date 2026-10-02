import sqlite3 from 'sqlite3';
import { RGA } from '@crdts/crdt-core';
import path from 'path';

// Anchor the database at the monorepo root so the file does not move between
// `src/` (ts-node) and `dist/` (compiled) launches, and never depends on cwd.
const ROOT = path.resolve(__dirname, '..', '..', '..');
const dbPath = process.env.DB_PATH || path.join(ROOT, 'data.db');
const db = new sqlite3.Database(dbPath);

console.log(`SQLite database: ${dbPath}`);

interface DocumentState {
    siteId: string;
    clock: number;
    sequence: RGA['sequence'];
}

/**
 * node-sqlite3 v6 no longer serializes statements issued on the same handle by
 * default, so a burst of `run` calls can execute out of order and persist stale
 * CRDT snapshots. Chaining every statement through one promise keeps writes
 * strictly sequential and last-write-wins.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task, task);
    queue = result.then(
        () => undefined,
        () => undefined
    );
    return result;
}

function run(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err: Error | null) => (err ? reject(err) : resolve()));
    });
}

function get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err: Error | null, row: T | undefined) =>
            err ? reject(err) : resolve(row)
        );
    });
}

function all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err: Error | null, rows: T[]) =>
            err ? reject(err) : resolve(rows)
        );
    });
}

export function initStorage(): Promise<void> {
    return enqueue(() =>
        run(`CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL
    )`)
    );
}

export function saveDocument(id: string, rga: RGA): Promise<void> {
    const state = JSON.stringify({
        siteId: rga.siteId,
        clock: rga.clock,
        sequence: rga.sequence
    } satisfies DocumentState);

    return enqueue(() =>
        run(
            `INSERT INTO documents (id, state) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET state=excluded.state`,
            [id, state]
        )
    );
}

export function loadDocument(id: string): Promise<RGA | null> {
    return enqueue(async () => {
        const row = await get<{ state: string }>(
            `SELECT state FROM documents WHERE id = ?`,
            [id]
        );
        if (!row) return null;

        const state = JSON.parse(row.state) as DocumentState;
        const rga = new RGA(state.siteId);
        rga.clock = state.clock;
        rga.sequence = state.sequence;
        return rga;
    });
}

export function getAllDocumentIds(): Promise<string[]> {
    return enqueue(async () => {
        const rows = await all<{ id: string }>(`SELECT id FROM documents`);
        return rows.map((row) => row.id);
    });
}

/** Flushes any queued writes and releases the database handle. */
export function closeStorage(): Promise<void> {
    return enqueue(
        () =>
            new Promise<void>((resolve) => {
                db.close(() => resolve());
            })
    );
}