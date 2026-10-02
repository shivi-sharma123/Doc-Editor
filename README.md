# Collaborative Document Editor using CRDTs

A real-time collaborative document editor where multiple users can simultaneously edit the same document without conflicts. The system uses **CRDTs (Conflict-free Replicated Data Types)** to guarantee eventual consistency — every user sees the same final document regardless of network delays, partitions, or edit ordering.

---

## 🚀 Features

- **Real-Time Collaboration**: Multiple users can edit the same document simultaneously, with changes syncing instantly.
- **Conflict-Free**: Custom implementation of an RGA (Replicated Growable Array) Sequence CRDT ensures mathematical convergence. No central authority or Operational Transformation (OT) required.
- **Robust Out-of-Order Handling**: The CRDT engine gracefully handles asynchronous delays, buffering dependent inserts and caching ghost-deletes to ensure total eventual consistency.
- **User Presence**: Live tracking of remote users, displaying their native cursor positions and names in real-time.
- **Offline Capable Architecture**: Because edits evaluate locally first, the client is implicitly prepared for disconnected work (with local caching extensions).
- **Persistent Storage**: Rooms and documents are saved safely to an SQLite database so editing sessions can be resumed later.

---

## 🏗 Architecture & Tech Stack

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

| Layer        | Technology     | Purpose                                              |
| ------------ | -------------- | ---------------------------------------------------- |
| **Frontend** | React + Vite   | Fast dev experience, component model                 |
| **Editor**   | Monaco Editor  | Battle-tested, rich API for programmatic text control |
| **Data Type**| Custom CRDT    | RGA Sequence CRDT built from scratch (no dependencies)|
| **Transport**| WebSocket (ws) | Low-latency bidirectional communication              |
| **Backend**  | Node.js + Express | Simple HTTP + WebSocket server                    |
| **Storage**  | SQLite         | Zero-config, persistent storage  |
| **Language** | TypeScript     | Shared types between client and server               |

---

## 📦 Project Structure

This project uses npm workspaces to manage a monorepo setup.

```
crdts/
├── packages/
│   ├── crdt-core/           # Pure CRDT logic (shared between client & server)
│   │   ├── src/
│   │   │   ├── rga.ts        # RGA (Replicated Growable Array) implementation
│   │   │   ├── char.ts       # CRDT character node (ID, value, tombstone)
│   │   │   └── operation.ts  # Insert/Delete operation types
│   │   └── package.json
│   │
│   ├── server/              # Backend Express + WebSocket Relay Server
│   │   ├── src/
│   │   │   ├── index.ts      # HTTP + WS Server
│   │   │   ├── room.ts       # Document room + socket broadcast management
│   │   │   └── storage.ts    # SQLite persistence
│   │   └── package.json
│   │
│   └── client/              # Frontend React Application
│       ├── src/
│       │   ├── components/
│       │   │   ├── Editor.tsx        # Monaco wrapper with CRDT binding
│       │   │   └── DocumentList.tsx  # Document generation and routing
│       │   └── hooks/
│       │       ├── useCrdt.ts        # CRDT state management hook
│       │       └── useWebSocket.ts   # Resilient WebSocket connection hook
│       └── package.json
│
├── Makefile                 # Optional task runner (macOS/Linux)
└── run-Instruction.md       # Step-by-step clone + run guide
└── package.json             # Workspace root
```

---

## 🛠 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm (v9+ recommended)

### Installation

Install all monorepo dependencies from the root directory:
```bash
npm install
```
*(On macOS/Linux you can use `make install` instead.)*

> **Windows note:** `npm` 11+ blocks dependency install scripts by default. This project needs
> `esbuild` and `sqlite3` to run theirs. The repository already approves them via `allowScripts`
> in the root `package.json`. If you ever hit a native-module error, run:
> ```bash
> npm install-scripts approve esbuild sqlite3
> npm rebuild sqlite3 esbuild
> ```

### Running the Application (Development)

To run both the backend server and frontend client concurrently:
```bash
npm run dev
```
- The backend server will start on `http://localhost:3001`
- The Vite frontend will start on `http://localhost:5173`

To run them in separate terminals instead:
```bash
npm run dev:server     # backend only
npm run dev:client     # frontend only
```

*(On macOS/Linux `make dev` is equivalent to `npm run dev`.)*

### Testing the Collaboration Flow
1. Open your browser to `http://localhost:5173`.
2. Click **Create New Document** to initialize a new CRDT session. You will be redirected to an editing room.
3. Open a second browser window (or an incognito tab) side-by-side and paste the exact same URL.
4. Type in either window. Observe real-time character synchronization and remote cursor movements with zero conflict!

---

## 🧪 Testing

The custom CRDT core (`@crdts/crdt-core`) has a comprehensive Jest test suite that guarantees algorithmic validity across a wide range of asynchronous scenarios, including:
- Concurrent operations at identical positions.
- Cross-insert-delete conflict resolutions.
- Out-of-order dependency resolution (inserts arriving before their target parents).
- Out-of-order tombstoning (deletes arriving before the character insertion).
- Multi-replica convergence assertions.

Run the test suite:
```bash
npm test
```

## 🏗 Building for Production

To compile TypeScript and build the Vite frontend bundle across all workspaces:
```bash
npm run build
```

Then serve the compiled output:
```bash
npm start
```
- Backend (`node packages/server/dist/index.js`) on `http://localhost:3001`
- Frontend (Vite preview of `packages/client/dist`) on `http://localhost:4173`

## 🎨 Linting

```bash
npm run lint
```

## 🐛 Troubleshooting

- **Server Connection Refused:** Ensure that the server isn't being blocked by another app on port `3001`.
- **`SQLITE_CANTOPEN` / `no such table: documents`:** Stop every running instance of the server, then delete `data.db` and restart.
- **Blank page with "Loading editor…":** Monaco Editor is loaded from a CDN by `@monaco-editor/react`, so the first load needs an internet connection.
- **Unexpected Document States:** The server persists document CRDT state in `data.db` in the monorepo root. To wipe testing data, run `npm run clean` (or `make clean`) and restart the server.

