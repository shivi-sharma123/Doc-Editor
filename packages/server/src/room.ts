import { WebSocket } from 'ws';
import { RGA, CRDTOperation } from '@crdts/crdt-core';
import { saveDocument } from './storage';

export class DocumentRoom {
    public id: string;
    public rga: RGA;
    public clients: Set<WebSocket> = new Set();

    constructor(id: string) {
        this.id = id;
        this.rga = new RGA('server');
    }

    public addClient(ws: WebSocket) {
        this.clients.add(ws);

        // Send full state to client
        ws.send(JSON.stringify({
            type: 'sync',
            sequence: this.rga.sequence
        }));
    }

    public removeClient(ws: WebSocket) {
        this.clients.delete(ws);
    }

    public handleMessage(ws: WebSocket, messageStr: string) {
        try {
            const msg = JSON.parse(messageStr);
            if (msg.type === 'insert' || msg.type === 'delete') {
                const op = msg as CRDTOperation;

                // Apply locally to server's state
                this.rga.applyRemote(op);

                // Persist asynchronously
                saveDocument(this.id, this.rga).catch(console.error);

                // Broadcast to others
                for (const client of this.clients) {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(messageStr);
                    }
                }
            } else if (msg.type === 'cursor') {
                // Forward cursor moves without applying locally
                for (const client of this.clients) {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(messageStr);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to parse message', e);
        }
    }
}
