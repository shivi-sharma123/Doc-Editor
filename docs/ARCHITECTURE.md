# Collaborative Editor Architecture

This document explores the structural architecture of the Collaborative Document Editor, how the Monorepo is split, and the core responsibilities of each fundamental component.

---

## 🏗 Monorepo Structure

The project uses npm workspaces to isolate concerns while allowing deep type-sharing across the client and server.

### 1. The Core Library (`@crdts/crdt-core`)
This package contains the mathematical truth of the application. It is completely framework-agnostic (no React, no Node.js specifics) and implements a **Replicated Growable Array (RGA)** CRDT.
- `rga.ts`: The primary engine. It maintains an array of `CRDTChar` objects, handles logical clock updates, and exposes `localInsert`, `localDelete`, and `applyRemote` functions. It uses an `insertBacklog` and a `tombstoneCache` to gracefully handle out-of-order network operations.
- `operation.ts`: Defines the strict TypeScript structures for inserts and deletes that travel over the wire.
- `char.ts`: Defines the atomic unit of the CRDT—a character with a unique `CharId`, a value, a parent reference, and a boolean `tombstone`.

### 2. The Frontend Client (`@crdts/client`)
This is a standard React application bootstrapped with Vite.
- **Monaco Editor (`Editor.tsx`)**: The UI surface. Monaco provides rich operational hooks and decoration APIs for rendering remote cursors. 
- **CRDT Hook (`useCrdt.ts`)**: Initializes a local instance of the `RGA` core and exposes safe React-callbacks corresponding to editor operations. It returns `RemoteOperationEvent` arrays which map CRDT logical mutations into absolute row/col editor edits.
- **WebSocket Hook (`useWebSocket.ts`)**: Manages the socket lifecycle, exponential backoff reconnections, and relays messages between the remote relay server and the local `useCrdt` hooks.

### 3. The Backend Server (`@crdts/server`)
A dual HTTP and WebSocket relay server running in Node.js.
- **WebSocket Relay (`index.ts` / `room.ts`)**: The server does **not** evaluate CRDT math or resolve conflicts. It is a "dumb" pipe that multiplexes JSON operations to all other connected clients in a "Room" (document ID).
- **Storage Layer (`storage.ts`)**: Listens to the operations flowing through rooms and streams them generically into an SQLite `data.db` file located in the project root. This allows documents to persist between server reboots.

---

## 🧠 The CRDT RGA Algorithm Design

The app's sync mechanism relies heavily on the **RGA (Replicated Growable Array)** algorithm implementation over generic Eventual Consistency models.

### Why not Operational Transformation (OT)?
Google Docs relies on OT. OT requires a central server to mathematically transform concurrent edits onto a single timeline. If the server goes down, clients cannot sync.
CRDTs embed the truth *inside* the data structure. Because our `rga.ts` resolves edits locally via relative parent pointers (`CharId` dependencies), the backend server is only a relay. Clients can operate fully offline and sync cleanly when reconnected.

### Logical Clocks & Site IDs
A huge architectural pillar is deterministic tie-breaking. 
If User A and User B concurrently type the letter "x" at the exact same time and place, the document might diverge (`xx` vs `xx`).
To prevent this, every tab session generates a unique `siteId` (e.g., `0.34f8a...`) and maintains a `logicalClock` integer. Every keystroke is tagged as `{ siteId, clock }`. If two characters share the same parent, they are deterministically sorted by their `siteId`. This mathematically locks all connected browsers into the identical sequence outcome regardless of when the packets arrived!
