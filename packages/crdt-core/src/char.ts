/**
 * Unique identifier for a character in the CRDT.
 * Consists of a site ID (to be unique across the network) and a logical clock (to order operations from the same site).
 */
export interface CharId {
    siteId: string;
    clock: number;
}

/**
 * Represents a single character in the CRDT sequence.
 */
export interface CRDTChar {
    /** Uniquely identifies this character */
    id: CharId;

    /** The actual character value */
    value: string;

    /** If true, the character is considered deleted */
    tombstone: boolean;

    /** 
     * ID of the character this character was inserted after. 
     * null means it was inserted at the beginning of the document (or after a synthetic "root" node).
     */
    parentId: CharId | null;
}
