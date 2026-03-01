import { useState, useCallback, useRef } from 'react';
import { RGA } from '@crdts/crdt-core';
import type { InsertOp, DeleteOp, CRDTChar, RemoteOperationEvent } from '@crdts/crdt-core';

export function useCrdt(siteId: string) {
    const rgaRef = useRef<RGA>(new RGA(siteId));
    const [text, setText] = useState<string>('');

    const syncState = useCallback(() => {
        setText(rgaRef.current.getText());
    }, []);

    const localInsert = useCallback((index: number, char: string): InsertOp | null => {
        try {
            const op = rgaRef.current.localInsert(index, char);
            // We don't call syncState here because Monaco will update its own text.
            // Or we can, but let's avoid infinite loops between editor and state.
            // Wait, let's keep it and handle loop externally.
            syncState();
            return op;
        } catch (e) {
            console.error(e);
            return null;
        }
    }, [syncState]);

    const localDelete = useCallback((index: number): DeleteOp | null => {
        try {
            const op = rgaRef.current.localDelete(index);
            syncState();
            return op;
        } catch (e) {
            console.error(e);
            return null;
        }
    }, [syncState]);

    const applyRemote = useCallback((op: InsertOp | DeleteOp): RemoteOperationEvent[] => {
        const events = rgaRef.current.applyRemote(op);
        syncState();
        return events;
    }, [syncState]);

    const initFromSequence = useCallback((sequence: CRDTChar[]) => {
        rgaRef.current.sequence = sequence;
        let maxClock = 0;
        for (const char of sequence) {
            if (char.id.siteId === siteId && char.id.clock > maxClock) {
                maxClock = char.id.clock;
            }
        }
        rgaRef.current.clock = maxClock;
        syncState();
    }, [siteId, syncState]);

    return {
        text,
        localInsert,
        localDelete,
        applyRemote,
        initFromSequence
    };
}
