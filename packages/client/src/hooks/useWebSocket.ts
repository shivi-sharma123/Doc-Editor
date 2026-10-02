import { useCallback, useEffect, useRef, useState } from 'react';
import type { CRDTChar, CRDTOperation } from '@crdts/crdt-core';

export type SocketStatus = 'connecting' | 'open' | 'closed';

/** Full document state pushed by the relay server right after a socket connects. */
export interface SyncMessage {
    type: 'sync';
    sequence: CRDTChar[];
    clock?: number;
}

/** Presence broadcast forwarded between peers without touching document state. */
export interface CursorMessage {
    type: 'cursor';
    siteId: string;
    name: string;
    line?: number;
    column?: number;
}

/** Every payload the relay server can send to a client. */
export type ServerMessage = SyncMessage | CursorMessage | CRDTOperation;

export interface UseWebSocketResult {
    status: SocketStatus;
    /** Sends a JSON payload. Payloads issued while the socket is down are queued and flushed on reconnect. */
    send: (payload: unknown) => void;
}

const MAX_BACKOFF_MS = 5000;
const BASE_BACKOFF_MS = 500;

/**
 * Resilient WebSocket connection to the CRDT relay server.
 *
 * Automatically reconnects with exponential backoff and keeps an outbox of messages
 * so local edits are never lost while the connection is down.
 */
export function useWebSocket(
    docId: string,
    onMessage: (message: ServerMessage) => void
): UseWebSocketResult {
    const [status, setStatus] = useState<SocketStatus>('connecting');

    const socketRef = useRef<WebSocket | null>(null);
    const outboxRef = useRef<string[]>([]);
    const attemptsRef = useRef(0);
    const closedRef = useRef(false);
    const onMessageRef = useRef(onMessage);

    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    useEffect(() => {
        if (!docId) return;

        closedRef.current = false;
        let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

        const connect = () => {
            if (closedRef.current) return;

            setStatus('connecting');
            const socket = new WebSocket(getWebSocketUrl(docId));
            socketRef.current = socket;

            socket.onopen = () => {
                if (closedRef.current) return;
                attemptsRef.current = 0;
                setStatus('open');

                const queued = outboxRef.current;
                outboxRef.current = [];
                for (const payload of queued) {
                    socket.send(payload);
                }
            };

            socket.onmessage = (event) => {
                if (closedRef.current) return;
                try {
                    onMessageRef.current(JSON.parse(event.data));
                } catch (err) {
                    console.error('Failed to parse server message', err);
                }
            };

            socket.onclose = () => {
                if (closedRef.current) return;
                setStatus('closed');
                scheduleReconnect();
            };

            socket.onerror = () => {
                socket.close();
            };
        };

        const scheduleReconnect = () => {
            if (closedRef.current) return;
            attemptsRef.current += 1;
            const delay = Math.min(
                BASE_BACKOFF_MS * 2 ** (attemptsRef.current - 1),
                MAX_BACKOFF_MS
            );
            reconnectTimer = setTimeout(connect, delay);
        };

        connect();

        return () => {
            closedRef.current = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            socketRef.current?.close();
            socketRef.current = null;
        };
    }, [docId]);

    const send = useCallback((payload: unknown) => {
        const serialized = JSON.stringify(payload);
        const socket = socketRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(serialized);
        } else {
            outboxRef.current.push(serialized);
        }
    }, []);

    return { status, send };
}

/**
 * Derives the WebSocket endpoint from the configured HTTP API base so the
 * client works regardless of the host it was served from.
 */
function getWebSocketUrl(docId: string): string {
    const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
    const url = new URL(apiBase);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = `/${docId}`;
    return url.toString();
}
