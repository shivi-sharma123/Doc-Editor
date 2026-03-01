# TODO — Collaborative Document Editor (CRDT)

> Track progress across all implementation phases. Check off tasks as they are completed.

---

## Phase 1 — CRDT Core Library

The foundation. Pure CRDT logic with zero dependencies, shared between client and server.

- [x] **#1 — Set up monorepo with npm workspaces and TypeScript config**
  - Root `package.json` with npm workspaces (`packages/crdt-core`, `packages/server`, `packages/client`)
  - Shared `tsconfig.base.json`
  - Scaffold directory structure for all three packages

- [x] **#2 — Define CRDTChar type** *(blocked by #1)*
  - Unique ID: `{ siteId: string, clock: number }`
  - Character value (`string`)
  - Tombstone flag (`boolean`) for soft deletes
  - Parent reference (ID of the character this was inserted after)

- [x] **#3 — Define Insert/Delete operation types** *(blocked by #1)*
  - `InsertOp`: char ID, parent ID, value
  - `DeleteOp`: char ID
  - Serializable for WebSocket transport

- [x] **#4 — Implement RGA core** *(blocked by #2, #3)*
  - Ordered sequence of `CRDTChar` nodes
  - Constructor with `siteId`, internal storage, logical clock
  - `getText()` — render visible text (skip tombstoned chars)

- [x] **#5 — Implement localInsert and localDelete** *(blocked by #4)*
  - `localInsert(index, char)` — map visible index to CRDT position, create char, return operation
  - `localDelete(index)` — find char at visible index, set tombstone, return operation

- [x] **#6 — Implement applyRemote** *(blocked by #4)*
  - `applyRemote(operation)` — merge remote insert/delete into local state
  - Insert: find parent by ID, resolve position among siblings via tie-breaking (compare site IDs)
  - Delete: find char by ID, set tombstone

- [x] **#7 — Write CRDT unit tests** *(blocked by #5, #6)*
  - Basic insert and delete
  - Concurrent inserts at the same position
  - Concurrent deletes of the same character
  - Insert-delete conflicts
  - Convergence: two replicas applying ops in different orders produce identical text
  - Empty document edge cases

---

## Phase 2 — Server + WebSocket Transport

Simple relay server — broadcasts operations, stores state. No conflict resolution here.

- [x] **#8 — Build Express + WebSocket server** *(blocked by #7)*
  - HTTP endpoints: `GET /documents`, `POST /documents`, `GET /documents/:id`
  - WebSocket server (`ws` library) with room-based connections
  - On client connect: send full CRDT state for the document
  - On receiving operation: broadcast to all other clients in the room

- [x] **#9 — Add SQLite persistence** *(blocked by #8)*
  - Store serialized CRDT state per document
  - Persist on every operation (or batched)
  - Create, load, and update documents

---

## Phase 3 — Frontend + Editor Integration

Wire the CRDT to a real editor UI so users can actually type and collaborate.

- [x] **#10 — Set up React + Vite frontend with Monaco Editor** *(blocked by #7)*
  - Scaffold React app with Vite
  - Install and configure `@monaco-editor/react`
  - Basic `App.tsx` with routing (document list ↔ editor)

- [x] **#11 — Implement useCrdt and useWebSocket hooks** *(blocked by #10, #8)*
  - `useCrdt` — holds local RGA instance, exposes insert/delete/getText
  - `useWebSocket` — manages connection, sends local ops, receives + applies remote ops

- [x] **#12 — Bind Monaco Editor to CRDT** *(blocked by #11)*
  - `onDidChangeContent` → generate CRDT ops from editor deltas
  - Apply remote ops → update Monaco model without re-triggering broadcast
  - `DocumentList` component — create new docs, join existing ones via URL

---

## Phase 4 — User Presence + Polish

Make it feel collaborative and production-ready.

- [x] **#13 — Add user presence** *(blocked by #12)*
  - Broadcast cursor positions via WebSocket
  - Show remote cursors + user labels in Monaco (decorations API)
  - `UserPresence` component — connected users sidebar
  - Handle disconnection/reconnection with state re-sync

- [x] **#14 — Final polish** *(blocked by #13)*
  - CSS styling and layout
  - Edge cases: reconnection logic, large document performance, error states
  - Integration testing with multiple browser tabs

---

## Phase 5 — Fix CRDT Edge Cases

- [x] **#15 — Fix replica identity collision**
  - Stop persisting `siteId` to `localStorage` in `App.tsx` so tabs have unique identities.
- [x] **#16 — Queue out-of-order insert dependencies**
  - Add `insertBacklog` to `RGA` to hold inserts missing parents.
- [x] **#17 — Cache out-of-order deletes**
  - Add `tombstonedIds` to `RGA` to track deletes for characters not yet received.
- [x] **#18 — Fix and add tests**
  - Assert convergence in existing tests and add tests for the new out-of-order scenarios.

---

## Phase 6 — Editor Polish and Performance

- [x] **#19 — Replace editor.setValue with surgical executeEdits updates**
  - Refactored RGA to emit precise indices, mapped to Monaco via `executeEdits()`
- [x] **#20 — Fix useWebSocket infinite reconnect loops**
  - Swapped dependency arrays for `useRef` to maintain constant hook identity
- [x] **#21 — Add exponential backoff WebSocket reconnect logic**
  - Handled automated reconnections mimicking live application resilience
- [x] **#22 — Resolve dbPath correctly relative to process.cwd()**
  - Switched `__dirname` to `process.cwd()` to prevent mismatch between `src` and `dist` environments 

---

## Progress Summary

| Phase   | Tasks | Done |
| ------- | ----- | ---- |
## Phase 7 — Detailed Documentation

- [x] **#23 — Create `docs/ARCHITECTURE.md`**
  - Documented the mathematical model of the Replicated Growable Array, and the physical monorepo boundaries tying it to React and Node.
- [x] **#24 — Create `docs/DATAFLOW.md`**
  - Formulated the stepwise lifecycle of Local Inserts, Remote Ingestion flows, and Out-Of-Order Eventual Consistency catches for async tombstones.
- [x] **#25 — Create `docs/TECH_STACK.md`**
  - Documented the logic behind choosing Vite, Monaco, generic WS, and raw native TypeScript over external OT libraries or Socket.io.

---

## Progress Summary

| Phase   | Tasks | Done |
| ------- | ----- | ---- |
| Phase 1 | 7     | 7    |
| Phase 2 | 2     | 2    |
| Phase 3 | 3     | 3    |
| Phase 4 | 2     | 2    |
| Phase 5 | 4     | 4    |
| Phase 6 | 4     | 4    |
| Phase 7 | 3     | 3    |
| **Total** | **25** | **25** |
