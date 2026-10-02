import { WebSocket } from 'ws';
import { RGA, CRDTOperation } from '@crdts/crdt-core';
import { saveDocument } from './storage';

/** Coalesces the write burst produced by fast typing into one SQLite upsert. */
const SAVE_DEBOUNCE_MS = 50;

export class DocumentRoom {
    public id: string;
    public rga: RGA;
    public clients: Set<WebSocket> = new Set();

    private saveTimer?: ReturnType<typeof setTimeout>;
    private pendingSave = false;

    constructor(id: string) {
        this.id = id;
        this.rga = new RGA('server');
    }

    public addClient(ws: WebSocket) {
        this.clients.add(ws);

        // Send full state to client
        ws.send(
            JSON.stringify({
                type: 'sync',
                sequence: this.rga.sequence,
                clock: this.rga.clock
            })
        );
    }

    public removeClient(ws: WebSocket) {
        this.clients.delete(ws);
    }

    public handleMessage(ws: WebSocket, messageStr: string) {
        let msg: any;
        try {
            msg = JSON.parse(messageStr);
        } catch (e) {
            console.error('Failed to parse message', e);
            return;
        }

        if (msg.type === 'insert' || msg.type === 'delete') {
            const op = msg as CRDTOperation;

            // Apply locally to server's state
            this.rga.applyRemote(op);
            this.scheduleSave();

            // Broadcast to others
            this.broadcast(messageStr, ws);
        } else if (msg.type === 'cursor') {
            // Forward cursor moves without applying locally
            this.broadcast(messageStr, ws);
        }
    }

    /** Writes the current state immediately, bypassing the debounce window. */
    public flush(): Promise<void> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = undefined;
        }
        if (!this.pendingSave) return Promise.resolve();
        this.pendingSave = false;
        return saveDocument(this.id, this.rga).catch((err) =>
            console.error(`Failed to persist document ${this.id}`, err)
        );
    }

    private broadcast(payload: string, except: WebSocket) {
        for (const client of this.clients) {
            if (client !== except && client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        }
    }

    private scheduleSave() {
        this.pendingSave = true;
        if (this.saveTimer) return;

        this.saveTimer = setTimeout(() => {
            this.saveTimer = undefined;
            this.pendingSave = false;
            saveDocument(this.id, this.rga).catch((err) =>
                console.error(`Failed to persist document ${this.id}`, err)
            );
        }, SAVE_DEBOUNCE_MS);
    }
}