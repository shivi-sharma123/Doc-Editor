import { CharId } from './char';

export type OperationType = 'insert' | 'delete';

/**
 * Represents an operation to insert a character into the CRDT.
 */
export interface InsertOp {
    type: 'insert';
    /** ID of the character being inserted */
    id: CharId;
    /** The value of the character */
    value: string;
    /** ID of the parent character this is inserted after (null if start of document) */
    parentId: CharId | null;
}

/**
 * Represents an operation to delete (tombstone) a character in the CRDT.
 */
export interface DeleteOp {
    type: 'delete';
    /** ID of the character being deleted */
    id: CharId;
}

/**
 * Union type of all possible CRDT operations.
 * These operations are serializable as JSON and can be sent over WebSockets.
 */
export type CRDTOperation = InsertOp | DeleteOp;
