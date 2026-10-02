import { useCallback, useEffect, useRef, useState } from 'react';
import { RGA } from '@crdts/crdt-core';
import type { CRDTOperation, RemoteOperationEvent } from '@crdts/crdt-core';
import { useWebSocket, type ServerMessage } from './useWebSocket';

export interface RemoteCursor {
    siteId: string;
    name: string;
    line: number;
    column: number;
}

/**
 * A change that must be reflected in the editor view.
 * `replace` is only used when the whole document is replaced (initial sync / reconnect).
 */
export type ViewEdit = RemoteOperationEvent | { type: 'replace'; value: string };

export interface UseCrdtResult {
    /** False until the server has delivered the initial document state. */
    ready: boolean;
    /** Current text as tracked by the CRDT. */
    text: string;
    remoteCursors: RemoteCursor[];
    peers: { siteId: string; name: string }[];
    /** Reconciles a full editor value produced by a local edit into CRDT operations. */
    applyLocalText: (next: string) => void;
    /** Broadcasts the local cursor position for presence. */
    broadcastCursor: (line: number, column: number) => void;
}

const CURSOR_THROTTLE_MS = 60;
const PRESENCE_INTERVAL_MS = 5000;
const PEER_TIMEOUT_MS = 20000;

/**
 * Binds a local RGA replica to a document room.
 *
 * The RGA is the source of truth: local editor edits are diffed against the CRDT text
 * to produce operations, and remote operations are translated back into view edits.
 */
export function useCrdt(
    docId: string,
    siteId: string,
    onViewEdit: (edits: ViewEdit[]) => void
): UseCrdtResult {
    const [ready, setReady] = useState(false);
    const [text, setText] = useState('');
    const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
    const [peers, setPeers] = useState<{ siteId: string; name: string }[]>([]);

    const rgaRef = useRef<RGA | null>(null);
    /** Operations generated locally, replayed on top of every server sync. */
    const localLogRef = useRef<CRDTOperation[]>([]);
    const peersRef = useRef(new Map<string, { name: string; lastSeen: number }>());
    const lastCursorSentRef = useRef(0);
    const displayNameRef = useRef(pickDisplayName(siteId));

    const onViewEditRef = useRef(onViewEdit);
    useEffect(() => {
        onViewEditRef.current = onViewEdit;
    }, [onViewEdit]);

    if (rgaRef.current === null) {
        rgaRef.current = new RGA(siteId);
    }

    const handleMessage = useCallback(
        (message: ServerMessage) => {
            const rga = rgaRef.current;
            if (!rga || !message) return;

            switch (message.type) {
                case 'sync': {
                    const sequence = Array.isArray(message.sequence) ? message.sequence : [];
                    rga.sequence = sequence;
                    rga.clock = Math.max(rga.clock, message.clock ?? 0);

                    // Rebuild the view from the server state, then re-apply everything
                    // this replica has produced so far so local edits are never dropped.
                    const edits: ViewEdit[] = [{ type: 'replace', value: rga.getText() }];
                    for (const op of localLogRef.current) {
                        edits.push(...rga.applyRemote(op));
                    }

                    setText(rga.getText());
                    setReady(true);
                    onViewEditRef.current(edits);
                    break;
                }
                case 'insert':
                case 'delete': {
                    const edits = rga.applyRemote(message as CRDTOperation);
                    if (edits.length > 0) {
                        setText(rga.getText());
                        onViewEditRef.current(edits);
                    }
                    break;
                }
                case 'cursor': {
                    if (message.siteId === siteId) return;
                    peersRef.current.set(message.siteId, {
                        name: message.name,
                        lastSeen: Date.now()
                    });
                    setRemoteCursors((current) => [
                        ...current.filter((c) => c.siteId !== message.siteId),
                        {
                            siteId: message.siteId,
                            name: message.name,
                            line: message.line ?? 1,
                            column: message.column ?? 1
                        }
                    ]);
                    break;
                }
                default:
                    break;
            }
        },
        [siteId]
    );

    const { status, send } = useWebSocket(docId, handleMessage);

    const sendCursor = useCallback(
        (line: number, column: number) => {
            send({
                type: 'cursor',
                siteId,
                name: displayNameRef.current,
                line,
                column
            });
        },
        [send, siteId]
    );

    // Announce presence on connect and keep peers fresh while the session is alive.
    useEffect(() => {
        if (status !== 'open' || !ready) return;

        sendCursor(1, 1);
        const announce = setInterval(() => sendCursor(1, 1), PRESENCE_INTERVAL_MS);
        const prune = setInterval(() => {
            const cutoff = Date.now() - PEER_TIMEOUT_MS;
            for (const [id, peer] of peersRef.current) {
                if (peer.lastSeen < cutoff) peersRef.current.delete(id);
            }
            setPeers(
                Array.from(peersRef.current, ([id, peer]) => ({
                    siteId: id,
                    name: peer.name
                }))
            );
            setRemoteCursors((current) =>
                current.filter((c) => peersRef.current.has(c.siteId))
            );
        }, PRESENCE_INTERVAL_MS);

        return () => {
            clearInterval(announce);
            clearInterval(prune);
        };
    }, [status, ready, sendCursor]);

    const applyLocalText = useCallback(
        (next: string) => {
            const rga = rgaRef.current;
            if (!rga) return;

            const previous = rga.getText();
            if (next === previous) return;

            const prefix = commonPrefixLength(previous, next);
            const suffix = commonSuffixLength(previous, next, prefix);
            const removed = previous.length - prefix - suffix;
            const inserted = next.slice(prefix, next.length - suffix);

            const ops: CRDTOperation[] = [];
            for (let i = 0; i < removed; i++) {
                ops.push(rga.localDelete(prefix));
            }
            for (let i = 0; i < inserted.length; i++) {
                ops.push(rga.localInsert(prefix + i, inserted[i]));
            }

            for (const op of ops) {
                localLogRef.current.push(op);
                send(op);
            }
            setText(rga.getText());
        },
        [send]
    );

    const broadcastCursor = useCallback(
        (line: number, column: number) => {
            const now = Date.now();
            if (now - lastCursorSentRef.current < CURSOR_THROTTLE_MS) return;
            lastCursorSentRef.current = now;
            sendCursor(line, column);
        },
        [sendCursor]
    );

    return { ready, text, remoteCursors, peers, applyLocalText, broadcastCursor };
}

function commonPrefixLength(a: string, b: string): number {
    const max = Math.min(a.length, b.length);
    let i = 0;
    while (i < max && a[i] === b[i]) i++;
    return i;
}

function commonSuffixLength(a: string, b: string, prefix: number): number {
    const max = Math.min(a.length - prefix, b.length - prefix);
    let i = 0;
    while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
    return i;
}

const ADJECTIVES = [
    'Swift', 'Quiet', 'Bright', 'Calm', 'Bold', 'Keen', 'Warm', 'Lucky', 'Brave', 'Nimble'
];

const ANIMALS = [
    'Otter', 'Falcon', 'Badger', 'Heron', 'Lynx', 'Marten', 'Ibis', 'Puffin', 'Tapir', 'Vole'
];

/** Stable, human readable label for this replica so remote users see a name, not a hash. */
function pickDisplayName(siteId: string): string {
    let hash = 0;
    for (let i = 0; i < siteId.length; i++) {
        hash = (hash * 31 + siteId.charCodeAt(i)) >>> 0;
    }
    const adjective = ADJECTIVES[hash % ADJECTIVES.length];
    const animal = ANIMALS[Math.floor(hash / ADJECTIVES.length) % ANIMALS.length];
    return `${adjective} ${animal}`;
}
