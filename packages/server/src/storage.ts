import sqlite3 from 'sqlite3';
import { RGA } from '@crdts/crdt-core';
import path from 'path';

// Use process.cwd() so it resolves relative to project root regardless of dist/ vs src/
const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'data.db');
const db = new sqlite3.Database(dbPath);

export function initStorage(): Promise<void> {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          state JSON
        )
      `, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

export function saveDocument(id: string, rga: RGA): Promise<void> {
    return new Promise((resolve, reject) => {
        const state = JSON.stringify({
            siteId: rga.siteId,
            clock: rga.clock,
            sequence: rga.sequence
        });

        db.run(
            `INSERT INTO documents (id, state) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET state=excluded.state`,
            [id, state],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

export function loadDocument(id: string): Promise<RGA | null> {
    return new Promise((resolve, reject) => {
        db.get(`SELECT state FROM documents WHERE id = ?`, [id], (err, row: any) => {
            if (err) return reject(err);
            if (!row) return resolve(null);

            try {
                const state = JSON.parse(row.state);
                const rga = new RGA(state.siteId);
                rga.clock = state.clock;
                rga.sequence = state.sequence;
                resolve(rga);
            } catch (e) {
                reject(e);
            }
        });
    });
}

export function getAllDocumentIds(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        db.all(`SELECT id FROM documents`, (err, rows: any[]) => {
            if (err) return reject(err);
            resolve(rows.map(row => row.id));
        });
    });
}
