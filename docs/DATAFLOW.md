# Dataflows and Synchronization

This document explains the step-by-step lifecycles of operations as they travel through the Collaborative Editor.

---

## 📥 1. Local Insert Flow

When a user types directly into their Monaco Editor window:

1. **Monaco Event:** The `onChange` event in Monaco detects an insertion payload.
2. **Editor API:** `Editor.tsx` intercepts the row/column offset and genericizes it to a flat `index` (e.g., character 45).
3. **CRDT Generation:** It calls `localInsert(index, "A")` inside `useCrdt.ts`.
4. **CRDT Core Validation:** Within `@crdts/crdt-core/rga.ts`, the engine looks up the character currently at index 44 to establish it as the **parent** associated with this new character.
5. **Clock Bump:** The local logical clock ticks up `+1`. The new character is minted as a `CRDTChar` with a unique `CharId`.
6. **Network Dispatch:** The operation `{ type: 'insert', id: CharId, parentId: CharId, value: "A" }` is forwarded to `useWebSocket.ts`.
7. **WebSocket:** The JSON payload is sent over the wire to `ws://localhost:3001/:docId`.

## 📤 2. Remote Synchronization Flow

When the server broadcasts User A's edit to User B:

1. **WebSocket Relay:** The Node.js server receives the JSON insert operation and `ws.send`s it to every client socket mapped to `room.clients` except the sender.
2. **Client Ingestion:** User B's `useWebSocket.ts` receives the message and triggers the `onRemoteOp` callback.
3. **CRDT Core Application:** The operation is passed to `RGA.applyRemote(op)` in `@crdts/crdt-core`.
4. **Parent Resolution:** The CRDT searches for the `parentId`. 
    - *Happy Path:* It finds the parent, resolves sibling determinism, and splices the payload precisely into the local `this.sequence` array.
    - *Missing Parent (Out-of-Order):* The client buffers the operation into `insertBacklog`. It remains invisible until the latency packet containing its parent arrives.
5. **Event Emission:** The CRDT core determines the *visible index* resulting from the math and returns a `RemoteOperationEvent`.
6. **Monaco UI Render:** Instead of doing a destructive `setValue()`, the `Editor.tsx` script uses Monaco's `executeEdits('remote')` API to surgically inject the character into User B's text buffer without ripping their native cursor position away!

## 👻 3. Deletions and Tombstoning Flow

CRDTs do not delete data—they flag it.

1. **Local Delete:** User A presses backspace at index 45. The CRDT engine locates the target `CharId`, flips `char.tombstone = true`, and emits a delete operation.
2. **Remote Ingestion:** User B receives the `{ type: 'delete', id: CharId }` payload.
3. **Ghost Deletes (Out-of-Order):** What happens if User B receives the *Delete* payload before they receive the *Insert* payload due to an asynchronous hiccup?
    - `rga.ts` fails to find the target `CharId`.
    - Instead of throwing an error, it drops the `CharId` into a `tombstoneCache` `Set`.
4. **Resolution:** When the original Insert payload finally arrives at User B, `applyInsert()` checks the `tombstoneCache`. It sees the ID, inserts the character, but immediately forces its target flag to `tombstone: true`, preventing a momentary flicker in the editor!

## 🔌 4. Initialization / Catch-Up Flow

1. **Connection:** When a generic Client first opens `http://localhost:5173/doc123`, a WebSocket upgrade request occurs.
2. **Hydration Sync:** The Server intercepts the connection and fetches the entirety of `room.sequence` (the raw CRDT character array) from the SQLite DB.
3. **Dispatch:** The server fires a `{ type: 'sync', sequence: [...] }` payload exclusively to the new client.
4. **Bootstrapping:** The client's `useCrdt.ts` fires `initFromSequence()`, entirely overriding its local RAM sequence and aligning its `logicalClock` to the highest observed value across the entire payload. The Monaco editor mounts the visible text and standard real-time collaboration begins.
