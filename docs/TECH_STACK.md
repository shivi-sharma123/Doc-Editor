# Tech Stack Breakdown

This document provides a holistic breakdown of the libraries, packages, and underlying technologies powering the Collaborative Document Editor.

---

## 🎨 1. The Frontend (React + Vite)
- **Vite (v5.x)**: Handles instant hot-module-replacement (HMR) and optimized rollup-based production bundling. We utilize Vite because Create-React-App is effectively deprecated, and Vite offers massively superior compile speeds for TypeScript workspaces.
- **React (v18.x)**: The UI framework. We employ raw functional hooks (`useCallback`, `useRef`, `useEffect`) heavily isolated inside custom domains (`useCrdt`, `useWebSocket`) to minimize re-render waterfall loops on intense keystroke velocities.
- **Monaco Editor (`@monaco-editor/react`)**: The exact rendering engine under VS Code. It is crucial because standard HTML `<textarea>` implementations cannot easily handle multi-color remote cursor overlays (decorations API) or targeted delta-range application (`executeEdits()`). Monaco makes syntax highlighting and code editing feel robust.
- **React Router Dom (`react-router-dom`)**: Handles SPA browser history. It allows users to initialize `/` and get dynamically pushed into random GUID document rooms like `/room/xyz890`.
- **Lucide React (`lucide-react`)**: Clean, lightweight SVG iconography utilized across the UI.

## 🧮 2. The Core Math (TypeScript & Jest)
The CRDT logic is written completely in vanilla `.ts` without any external dependencies enforcing algorithm purity.
- **TypeScript**: Shared completely utilizing npm workspaces. An interface defined in `@crdts/crdt-core` like `InsertOp` is strictly imported and validated by the backend relay and frontend hook components simultaneously, guaranteeing no drift in object shapes over the wire.
- **Jest (`jest`, `ts-jest`)**: Utilized to run heavy mathematical simulations of the RGA array. The automated tests emulate high-latency concurrent overlaps, ensuring that replica texts always identical `expect(rga1.getText()).toBe(rga2.getText())`.

## ⚙️ 3. The Backend (Node.js & Express)
- **Node.js**: The underlying V8 engine running the server module.
- **Express (`express`)**: A minimal HTTP framework. Used strictly to bind cross-origin resource sharing (CORS) defaults and mount the initial HTTP server instance over which WebSockets upgrade.
- **WebSocket (`ws`)**: The defacto standard node module for WebSocket implementation. `ws` is utilized over `Socket.io` to ensure a bare-minimum, low-level binary data footprint without HTTP long-polling callbacks. It focuses strictly on bidirectional `<->` string messaging.

## 💾 4. The Storage (SQLite)
- **SQLite3 (`sqlite3`)**: The backend mounts a `sqlite3.Database` file locally mapped as `data.db`.
  - **Why SQLite?** For a localized prototype workspace, SQLite removes the barrier of spinning up a generic Postgres/Docker daemon. It runs purely on the localized disk, performing localized ACID disk writes.
  - **Implementation Strategy**: The storage strategy operates utilizing `JSON.stringify()`. Raw arrays of CRDT character objects are serialized natively into DB string columns matched to Document Room IDs.

## 🔌 5. Tooling
- **npm Workspaces**: Bound in the root `package.json`, workspaces (`packages/*`) allow `node_modules` to be centrally hoisted, resulting in clean internal dependency linking without requiring un-published library usage via tools like Lerna.
- **Make (`Makefile`)**: Contains shortcut build macros for spinning up parallel server processes (`make dev`) utilizing the underlying `npx concurrently` bash wrapper.
