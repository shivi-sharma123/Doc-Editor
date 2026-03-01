import { CRDTChar, CharId } from './char';
import { InsertOp, DeleteOp, CRDTOperation } from './operation';

export type RemoteOperationEvent =
    | { type: 'insert'; index: number; value: string }
    | { type: 'delete'; index: number };

export class RGA {
    public siteId: string;
    public clock: number;
    public sequence: CRDTChar[];

    private insertBacklog: InsertOp[];
    private tombstoneCache: Set<string>;

    constructor(siteId: string) {
        this.siteId = siteId;
        this.clock = 0;
        this.sequence = [];
        this.insertBacklog = [];
        this.tombstoneCache = new Set();
    }

    /**
     * Generates a new unique clock value for the local site.
     */
    public nextClock(): number {
        return ++this.clock;
    }

    /**
     * Returns the visible text representation of the document.
     * Skips any characters marked as tombstones.
     */
    public getText(): string {
        return this.sequence
            .filter((char) => !char.tombstone)
            .map((char) => char.value)
            .join('');
    }

    /**
     * Helper to find the absolute index in the sequence array
     * from a visible 0-based index.
     */
    private findSequenceIndex(visibleIndex: number): number {
        if (visibleIndex === 0) return -1;
        let count = 0;
        for (let i = 0; i < this.sequence.length; i++) {
            if (!this.sequence[i].tombstone) {
                count++;
                if (count === visibleIndex) {
                    return i;
                }
            }
        }
        throw new Error(`Visible index ${visibleIndex} out of bounds`);
    }

    /**
     * Generates a local insert operation at a given visible index.
     */
    public localInsert(visibleIndex: number, value: string): InsertOp {
        const seqIndex = this.findSequenceIndex(visibleIndex);
        const parentId = seqIndex === -1 ? null : this.sequence[seqIndex].id;

        const char: CRDTChar = {
            id: { siteId: this.siteId, clock: this.nextClock() },
            value,
            tombstone: false,
            parentId
        };

        // For local inserts, we can just insert directly after the found sequence index
        // because there are no concurrent operations from our own site.
        // All remote operations are handled by applyRemote.
        this.sequence.splice(seqIndex + 1, 0, char);

        return {
            type: 'insert',
            id: char.id,
            value: char.value,
            parentId: char.parentId
        };
    }

    /**
     * Generates a local delete operation at a given visible index.
     */
    public localDelete(visibleIndex: number): DeleteOp {
        // To delete the character at `visibleIndex`, we just need to find the `visibleIndex + 1`th
        // visible character, because `findSequenceIndex` finds the character AFTER which an insert would go.
        // Wait, findSequenceIndex(1) returns the 1st visible character. So to delete index 0, we look for visibleIndex 1.
        const seqIndex = this.findSequenceIndex(visibleIndex + 1);

        if (seqIndex === -1) {
            throw new Error(`No character found at visible index ${visibleIndex}`);
        }

        const char = this.sequence[seqIndex];
        char.tombstone = true;

        return {
            type: 'delete',
            id: char.id
        };
    }

    /**
     * Applies a remote operation to the local sequence.
     * Returns an array of events that should be applied to the view (editor).
     */
    public applyRemote(op: CRDTOperation): RemoteOperationEvent[] {
        const events: RemoteOperationEvent[] = [];
        if (op.type === 'insert') {
            this.applyInsert(op, events);
        } else if (op.type === 'delete') {
            this.applyDelete(op, events);
        }
        return events;
    }

    private charIdToString(id: CharId): string {
        return `${id.siteId}:${id.clock}`;
    }

    private findCharIndex(id: CharId): number {
        return this.sequence.findIndex(
            (c) => c.id.siteId === id.siteId && c.id.clock === id.clock
        );
    }

    private applyInsert(op: InsertOp, events: RemoteOperationEvent[]): void {
        // If we already have this char, ignore it (idempotency)
        if (this.findCharIndex(op.id) !== -1) return;

        // Find parent index
        let parentIndex = -1;
        if (op.parentId !== null) {
            parentIndex = this.findCharIndex(op.parentId);
            if (parentIndex === -1) {
                // Dependency missing, queue in backlog
                this.insertBacklog.push(op);
                return;
            }
        }

        const char: CRDTChar = {
            id: op.id,
            value: op.value,
            tombstone: false,
            parentId: op.parentId
        };

        let insertIndex = parentIndex + 1;
        while (insertIndex < this.sequence.length) {
            const current = this.sequence[insertIndex];

            let currentParentIndex = -1;
            if (current.parentId !== null) {
                currentParentIndex = this.findCharIndex(current.parentId);
            }

            if (currentParentIndex < parentIndex) {
                // current is a sibling of an ancestor. Stop skipping.
                break;
            }

            if (currentParentIndex === parentIndex) {
                // Sibling. Tie-break.
                if (op.id.siteId > current.id.siteId) {
                    break;
                } else if (op.id.siteId === current.id.siteId && op.id.clock > current.id.clock) {
                    break;
                }
            }

            // If currentParentIndex > parentIndex, current is a descendant of a sibling we skipped.
            insertIndex++;
        }

        let visibleIndex = 0;
        for (let i = 0; i < insertIndex; i++) {
            if (!this.sequence[i].tombstone) {
                visibleIndex++;
            }
        }

        // Check if this new node was already tombstoned out of order
        if (this.tombstoneCache.has(this.charIdToString(char.id))) {
            char.tombstone = true;
            this.tombstoneCache.delete(this.charIdToString(char.id));
        } else {
            // Only emit insert event if it wasn't immediately tombstoned
            events.push({ type: 'insert', index: visibleIndex, value: char.value });
        }

        this.sequence.splice(insertIndex, 0, char);

        // Process backlog to see if any pending inserts can now be applied
        this.processBacklog(events);
    }

    private processBacklog(events: RemoteOperationEvent[]): void {
        let appliedAny = true;
        while (appliedAny) {
            appliedAny = false;
            for (let i = 0; i < this.insertBacklog.length; i++) {
                const op = this.insertBacklog[i];
                if (op.parentId === null || this.findCharIndex(op.parentId) !== -1) {
                    this.insertBacklog.splice(i, 1);
                    this.applyInsert(op, events);
                    appliedAny = true;
                    break;
                }
            }
        }
    }

    private applyDelete(op: DeleteOp, events: RemoteOperationEvent[]): void {
        const index = this.findCharIndex(op.id);
        if (index !== -1) {
            if (!this.sequence[index].tombstone) {
                let visibleIndex = 0;
                for (let i = 0; i < index; i++) {
                    if (!this.sequence[i].tombstone) visibleIndex++;
                }
                this.sequence[index].tombstone = true;
                events.push({ type: 'delete', index: visibleIndex });
            }
        } else {
            // Target node doesn't exist yet, save to cache
            this.tombstoneCache.add(this.charIdToString(op.id));
        }
    }
}
