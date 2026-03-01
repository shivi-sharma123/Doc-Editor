# Collaborative Document Editor using CRDTs

## What We're Building

A real-time collaborative document editor where multiple users can simultaneously edit the same document without conflicts. The system uses **CRDTs (Conflict-free Replicated Data Types)** to guarantee eventual consistency — every user sees the same final document regardless of network delays, partitions, or edit ordering.

---

## Core Concepts

### What is a CRDT?

A CRDT is a data structure that can be replicated across multiple nodes, updated independently and concurrently without coordination, and always merged into a consistent state. No conflict resolution logic is needed — the math guarantees convergence.

### Why CRDTs for a Doc Editor?

- **No central authority needed** — edits are resolved locally, then synced
- **Offline support** — users can edit without connectivity and sync later
- **No operational transform (OT) complexity** — unlike Google Docs' OT approach, CRDTs don't require a central server to order operations
- **Eventual consistency guaranteed** — all replicas converge to the same state

### CRDT Algorithm: Sequence CRDT (LSEQ / RGA variant)

For text editing, we'll implement a **sequence CRDT** where each character has:
- A **unique ID** (site ID + logical clock)
- A **position** relative to other characters (not an array index)
- A **tombstone flag** for deletions (characters are marked deleted, not removed)

This allows inserts and deletes at any position to be merged without conflicts.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (React)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Code Editor │  │ CRDT Client  │  │  WebSocket     │  │
│  │  (Monaco)    │◄►│  (JS CRDT)   │◄►│  Connection    │  │
│  └─────────────┘  └──────────────┘  └───────┬────────┘  │
└─────────────────────────────────────────────┼────────────┘
                                              │ WebSocket
┌─────────────────────────────────────────────┼────────────┐
│                  Backend (Node.js)           │            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────┴─────────┐ │
│  │  Document    │  │  CRDT Merge  │  │  WebSocket     │ │
│  │  Storage     │◄►│  Engine      │◄►│  Server        │ │
│  │  (SQLite)    │  │              │  │                │ │
│  └──────────────┘  └──────────────┘  └────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Data flow:**
1. User types in editor → local CRDT generates an operation (insert/delete)
2. Operation is applied locally (instant feedback)
3. Operation is sent to server via WebSocket
4. Server broadcasts operation to all other connected clients
5. Each client merges the remote operation into their local CRDT
6. All clients converge to the same document state

---

## Tech Stack

| Layer        | Technology     | Why                                                  |
| ------------ | -------------- | ---------------------------------------------------- |
| Frontend     | React + Vite   | Fast dev experience, component model                 |
| Editor       | Monaco Editor  | Battle-tested, rich API for programmatic text control |
| CRDT Library | Custom (from scratch) | Learning purpose — we'll implement RGA ourselves |
| Transport    | WebSocket (ws) | Low-latency bidirectional communication              |
| Backend      | Node.js + Express | Simple HTTP + WebSocket server                    |
| Storage      | SQLite         | Zero-config, file-based, good enough for this scope  |
| Language     | TypeScript     | Shared types between client and server               |

---

## Project Structure

```
crdts/
├── packages/
│   ├── crdt-core/           # Pure CRDT logic (shared between client & server)
│   │   ├── src/
│   │   │   ├── rga.ts        # RGA (Replicated Growable Array) implementation
│   │   │   ├── char.ts       # CRDT character node (ID, value, tombstone)
│   │   │   ├── operation.ts  # Insert/Delete operation types
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   │   ├── rga.test.ts
│   │   │   └── merge.test.ts
│   │   └── package.json
│   │
│   ├── server/              # Backend
│   │   ├── src/
│   │   │   ├── index.ts      # Express + WebSocket server
│   │   │   ├── room.ts       # Document room management
│   │   │   └── storage.ts    # SQLite persistence
│   │   └── package.json
│   │
│   └── client/              # Frontend
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── Editor.tsx        # Monaco wrapper with CRDT binding
│       │   │   ├── DocumentList.tsx   # List/create documents
│       │   │   └── UserPresence.tsx   # Show connected users + cursors
│       │   ├── hooks/
│       │   │   ├── useCrdt.ts        # CRDT state management hook
│       │   │   └── useWebSocket.ts   # WebSocket connection hook
│       │   └── main.tsx
│       └── package.json
│
├── package.json             # Workspace root (npm workspaces)
├── tsconfig.base.json
└── PLAN.md
```

---

## Implementation Phases

### Phase 1 — CRDT Core Library
Build the pure CRDT logic with no dependencies. This is the heart of the project.

- [ ] Define `CRDTChar` — unique ID (siteId + clock), value, tombstone flag, parent reference
- [ ] Implement `RGA` (Replicated Growable Array) — ordered sequence of `CRDTChar` nodes
- [ ] `localInsert(index, char)` — generate an insert operation at a visible position
- [ ] `localDelete(index)` — generate a delete operation (tombstone)
- [ ] `applyRemote(operation)` — merge a remote insert/delete into local state
- [ ] `getText()` — render the current visible text (skip tombstoned chars)
- [ ] Write unit tests: concurrent inserts, concurrent deletes, insert-delete conflicts, convergence tests (two replicas applying ops in different orders must produce same text)

### Phase 2 — Server + WebSocket Transport
Simple relay server that broadcasts operations between clients.

- [ ] Express server with HTTP endpoints: `GET /documents`, `POST /documents`, `GET /documents/:id`
- [ ] WebSocket server (`ws` library) with room-based connections
- [ ] On client connect: send full CRDT state for the document
- [ ] On receiving operation: broadcast to all other clients in the room
- [ ] SQLite storage: persist document CRDT state on every operation (or batched)

### Phase 3 — Frontend + Editor Integration
Wire up the CRDT to a real editor UI.

- [ ] React app with Vite, Monaco Editor component
- [ ] `useCrdt` hook: holds local RGA instance, exposes insert/delete/getText
- [ ] `useWebSocket` hook: connects to server, sends local ops, receives remote ops
- [ ] Bind Monaco `onDidChangeContent` → generate CRDT operations from editor deltas
- [ ] Apply remote operations → update Monaco content without triggering re-broadcast
- [ ] Document list page: create new documents, join existing ones via URL

### Phase 4 — User Presence + Polish
Make it feel collaborative.

- [ ] Broadcast cursor positions via WebSocket
- [ ] Show remote cursors + user labels in Monaco (decorations API)
- [ ] Show connected user list in sidebar
- [ ] Handle disconnection/reconnection gracefully (re-sync state)
- [ ] Basic styling / layout

---

## Key Design Decisions

1. **Custom CRDT over a library (like Yjs/Automerge)** — the goal is to understand CRDTs deeply, not just use them. We'll build RGA from scratch.

2. **Server is a relay, not an authority** — the server doesn't resolve conflicts. It stores state and forwards operations. All conflict resolution happens in the CRDT math.

3. **Tombstone-based deletion** — deleted characters are marked, not removed. This is necessary for correct merging but means memory grows over time. We can add garbage collection later.

4. **Operation-based CRDT** — we send operations (insert char X after char Y) rather than full state. This is bandwidth-efficient for real-time editing.

---

## Running the Project (once built)

```bash
# Install dependencies
npm install

# Start server
npm run dev --workspace=packages/server

# Start client (separate terminal)
npm run dev --workspace=packages/client

# Run CRDT tests
npm test --workspace=packages/crdt-core
```

Open two browser tabs → same document URL → type in both → see real-time sync.
