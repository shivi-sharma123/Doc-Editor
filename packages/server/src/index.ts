import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { DocumentRoom } from './room';
import { initStorage, loadDocument, getAllDocumentIds, closeStorage } from './storage';

const app = express();
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = Number(process.env.PORT) || 3001;

// Maps document ID to room
const rooms = new Map<string, DocumentRoom>();

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});

app.get('/documents', (req, res) => {
    const docs = Array.from(rooms.keys()).map(id => ({
        id,
        clients: rooms.get(id)?.clients.size || 0,
        length: rooms.get(id)?.rga.getText().length || 0
    }));
    res.json(docs);
});

app.post('/documents', (req, res) => {
    const id = Math.random().toString(36).substring(2, 9);
    rooms.set(id, new DocumentRoom(id));
    res.json({ id });
});

app.get('/documents/:id', (req, res) => {
    const id = req.params.id;
    if (rooms.has(id)) {
        res.json({ id });
    } else {
        // We can auto-create the document when navigated directly
        rooms.set(id, new DocumentRoom(id));
        res.json({ id });
    }
});

wss.on('connection', (ws, req) => {
    const url = req.url || '/';
    const docId = url.split('/').pop() || 'default';

    if (!rooms.has(docId)) {
        rooms.set(docId, new DocumentRoom(docId));
    }
    const room = rooms.get(docId)!;
    room.addClient(ws);

    ws.on('message', (message) => {
        room.handleMessage(ws, message.toString());
    });

    ws.on('close', () => {
        room.removeClient(ws);
        // Flush any debounced write so nothing is lost when the last client leaves.
        room.flush();
    });
});

initStorage().then(async () => {
    try {
        const ids = await getAllDocumentIds();
        for (const id of ids) {
            const rga = await loadDocument(id);
            if (rga) {
                const room = new DocumentRoom(id);
                room.rga = rga;
                rooms.set(id, room);
            }
        }
        console.log(`Loaded ${rooms.size} documents from storage`);
    } catch (err) {
        console.error('Failed to load documents from storage:', err);
    }

    const shutdown = async (signal: string) => {
        console.log(`\nReceived ${signal}, flushing document state…`);
        await Promise.all(Array.from(rooms.values(), (room) => room.flush()));
        await closeStorage();
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 2000).unref();
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));

    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize storage:', err);
});
