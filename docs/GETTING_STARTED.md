# Getting Started

This document outlines how to start, develop, and test the Collaborative Document Editor.

## Prerequisites
- Node.js (v18+ recommended)
- npm (v9+ recommended)

## Installation

Install all monorepo dependencies from the root directory:
```bash
make install
# or
npm install
```

## Running the Application

The project consists of a backend Node.js (Express + WebSocket) server and a frontend React (Vite) client.

### Using Make (Recommended)

To run both the server and client concurrently in a single terminal:
```bash
make dev
```
*Note: This uses `npx concurrently` to run both services together.*

### Running Manually in Separate Terminals

**1. Start the Server:**
```bash
make dev-server
# or
npm run dev --workspace=packages/server
```
*The server will start on `http://localhost:3001`.*

**2. Start the Client:**
```bash
make dev-client
# or
npm run dev --workspace=packages/client
```
*The client will start on `http://localhost:5173` (or another port if 5173 is occupied).*

## Testing the Collaboration Flow
1. Open your browser and navigate to the client URL (e.g., `http://localhost:5173`).
2. Click **Create New Document** to initialize a new CRDT session.
3. You will be redirected to an editor room with a unique document URL (e.g., `http://localhost:5173/abc1234`).
4. **Testing Remote Sync:** Open a second browser window (or an incognito tab) side-by-side and paste the exact same URL.
5. As you type in one window, you'll see your characters synchronize instantly to the other window, alongside colored indicators showing remote cursors!

## Running Automated Tests

The core CRDT logic (Replicated Growable Array) has an exhaustive test suite simulating concurrent operations, conflict resolution, and convergence.

Run the test suite:
```bash
make test
# or
npm test --workspace=packages/crdt-core
```

## Building for Production

Compile TypeScript and build the Vite frontend bundle across all workspaces:
```bash
make build
# or
npm run build --workspaces
```

## Troubleshooting

- **Server Connection Refused:** Ensure that the server is running on port `3001` and isn't being blocked by another app.
- **Out of Sync State / Stuck Documents:** The server persists documents to `data.db` (SQLite) in the project root. If you experience unexpected or corrupted state from testing, simply delete `data.db` or run `make clean`, then restart the server.
