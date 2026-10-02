# Run Instructions — CRDT Collaborative Document Editor

Complete, copy-paste ready guide to clone, install, build, and run this project.

- **Repository:** https://github.com/shivi-sharma123/Doc-Editor.git
- **Branch:** `main`
- **Stack:** Node.js + Express + `ws` + SQLite (backend), React + Vite + Monaco Editor (frontend), TypeScript CRDT core

---

## 1. Prerequisites

| Requirement | Version   | Notes                                             |
| ----------- | --------- | ------------------------------------------------- |
| Node.js     | **v18+** (tested on v24) | Download: https://nodejs.org |
| npm         | **v9+** (tested on v12)  | Ships with Node.js                               |
| Git         | any recent | Needed only for `git clone`                      |

Check your versions:

```bash
node -v
npm -v
git --version
```

> macOS/Linux users who have `make` installed can use the equivalent `make install` / `make dev` / `make test` / `make build` commands instead of the npm ones shown below.

---

## 2. Clone the repository

```bash
git clone https://github.com/shivi-sharma123/Doc-Editor.git
cd Doc-Editor
```

Already have the repo? Just pull the latest:

```bash
cd Doc-Editor
git pull origin main
```

---

## 3. Install dependencies

```bash
npm install
```

This installs the root workspace **and** all three workspaces (`crdt-core`, `server`, `client`).

### 3.1 Windows / npm 11+ extra step (native modules)

Newer npm versions block dependency install scripts by default. This project needs two of them
(`esbuild` for Vite, `sqlite3` for the database). The repo already whitelists them, but if you
see `no such table: documents`, `SQLITE_CANTOPEN`, `Cannot find module '../build/Release/node_sqlite3.node'`,
or a Vite/esbuild binary error, run:

```bash
npm install-scripts approve esbuild sqlite3
npm rebuild sqlite3 esbuild
```

Verify the native SQLite binding loads:

```bash
node -e "require('sqlite3'); console.log('sqlite3 OK')"
```

---

## 4. Run in development mode

```bash
npm run dev
```

This single command starts **both** processes:

| Service    | URL                       |
| ---------- | ------------------------- |
| Backend (Express + WebSocket relay + SQLite) | http://localhost:3001 |
| Frontend (Vite dev server)                   | http://localhost:5173 |

Open **http://localhost:5173** in your browser. Stop both processes with `Ctrl + C`.

### 4.1 Running in separate terminals

Terminal 1 — backend only:

```bash
npm run dev:server
```

Terminal 2 — frontend only:

```bash
npm run dev:client
```

---

## 5. Test the collaboration flow

1. Open <http://localhost:5173>.
2. Click **Create New Document** — you are redirected to a room, e.g. `/a1b2c3d`.
3. Open the **same URL** in a second window (or a private/incognito window).
4. Type in either window:
   - Characters appear instantly in the other window.
   - Remote cursors with generated names (e.g. "Swift Otter") are shown inline.
   - The header shows `N online` participants and the live character count.
5. Delete characters, insert text at the same position from both windows simultaneously —
   both replicas converge to the same text with no lock and no merge conflict.

---

## 6. Run the unit tests

```bash
npm test
```

Runs the Jest suite for `@crdts/crdt-core` (8 tests): local insert/delete, single-op sync,
concurrent inserts at the same position, concurrent deletes, insert/delete conflicts,
multi-replica convergence, out-of-order insert dependencies, and out-of-order tombstoning.

Expected output ends with:

```
Tests:       8 passed, 8 total
```

---

## 7. Lint

```bash
npm run lint
```

---

## 8. Build and run for production

```bash
npm run build     # tsc for crdt-core + server, tsc -b && vite build for client
npm start         # runs the compiled server + `vite preview` of the built client
```

| Service | URL                       |
| ------- | ------------------------- |
| Backend | http://localhost:3001     |
| Frontend (preview) | http://localhost:4173 |

---

## 9. Clean / reset

```bash
npm run clean
```

Removes `node_modules`, all `dist` folders and `data.db`. Re-run `npm install` afterwards.
(macOS/Linux: `make clean`)

To reset only the documents, delete `data.db` from the repo root while the server is stopped.

---

## 10. Environment variables

| Variable        | Used by        | Default                        | Purpose                                        |
| --------------- | -------------- | ------------------------------ | ---------------------------------------------- |
| `PORT`          | server         | `3001` (hard-coded fallback)   | Backend HTTP + WebSocket port                   |
| `DB_PATH`       | server         | `<repo-root>/data.db`           | Override the SQLite file location               |
| `VITE_API_URL`  | client         | `http://localhost:3001`         | Backend base URL the browser talks to           |

To point the frontend at a different backend, create `packages/client/.env.local`:

```
VITE_API_URL=https://my-backend.example.com
```

---

## 11. Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `Port 3001 is already in use` | Close the process holding the port, or set a different `PORT`. |
| Page shows **"Still waiting for the relay server…"** | The backend is not running — start it with `npm run dev:server`. |
| Page shows **"Could not reach the collaboration server."** | Backend is down, or `VITE_API_URL` points somewhere wrong. |
| Editor stuck on **"Loading editor…"** | Monaco Editor loads from a CDN on first paint; the browser needs internet access. |
| `SQLITE_CANTOPEN` / `no such table: documents` | Run `npm rebuild sqlite3`, then `npm install-scripts approve esbuild sqlite3`. |
| `Cannot find module '@crdts/crdt-core'` | Run `npm install` from the repo root (not inside a package folder). |
| Documents disappear after restart | Expected — rooms are only persisted once an edit happens; the file is `data.db`. |
| `EADDRINUSE` on 5173 | Another Vite server is running. Stop it or run `npm run dev:client -- --port 5174`. |

---

## 12. Command cheat sheet

```bash
npm install          # install all workspace dependencies
npm run dev          # run server + client concurrently
npm run dev:server   # backend only  (http://localhost:3001)
npm run dev:client   # frontend only (http://localhost:5173)
npm test             # CRDT core unit tests
npm run lint         # ESLint (client)
npm run build        # compile everything for production
npm start            # run the production build
npm run clean        # remove node_modules, dist folders and data.db
```
