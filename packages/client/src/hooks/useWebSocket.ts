import { useEffect, useRef, useState } from 'react';
import type { InsertOp, DeleteOp, CRDTChar } from '@crdts/crdt-core';

type CursorMessage = { type: 'cursor', siteId: string, position: { lineNumber: number, column: number } };

export function useWebSocket(
    docId: string | undefined,
    onRemoteOp: (op: InsertOp | DeleteOp) => void,
    onSync: (sequence: CRDTChar[]) => void,
    onCursor: (cursor: CursorMessage) => void
) {
    const wsRef = useRef<WebSocket | null>(null);
    const [connected, setConnected] = useState(false);

    const onRemoteOpRef = useRef(onRemoteOp);
    const onSyncRef = useRef(onSync);
    const onCursorRef = useRef(onCursor);

    // Keep refs fresh
    useEffect(() => {
        onRemoteOpRef.current = onRemoteOp;
        onSyncRef.current = onSync;
        onCursorRef.current = onCursor;
    }, [onRemoteOp, onSync, onCursor]);

    useEffect(() => {
        if (!docId) return;

        let reconnectTimeout: ReturnType<typeof setTimeout>;
        let isUnmounted = false;
        let attempt = 0;

        function connect() {
            if (isUnmounted) return;
            const wsUrl = `ws://localhost:3001/${docId}`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setConnected(true);
                attempt = 0;
            };

            ws.onclose = () => {
                setConnected(false);
                if (!isUnmounted) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                    attempt++;
                    reconnectTimeout = setTimeout(connect, delay);
                }
            };

            ws.onerror = () => ws.close();

            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.type === 'sync') {
                    onSyncRef.current(msg.sequence);
                } else if (msg.type === 'insert' || msg.type === 'delete') {
                    onRemoteOpRef.current(msg);
                } else if (msg.type === 'cursor') {
                    onCursorRef.current(msg);
                }
            };
        }

        connect();

        return () => {
            isUnmounted = true;
            clearTimeout(reconnectTimeout);
            if (wsRef.current) wsRef.current.close();
        };
    }, [docId]);

    const sendOp = (op: InsertOp | DeleteOp | CursorMessage) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(op));
        }
    };

    return { connected, sendOp };
}
