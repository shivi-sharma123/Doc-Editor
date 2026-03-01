.PHONY: install dev-server dev-client dev test build clean

# Install dependencies for the root and all workspaces
install:
	npm install

# Start the Node.js/WebSocket backend server
dev-server:
	npm run dev --workspace=packages/server

# Start the Vite React frontend
dev-client:
	npm run dev --workspace=packages/client

# Start both the server and the client concurrently
dev:
	npx concurrently "make dev-server" "make dev-client"

# Run CRDT core unit tests
test:
	npm test --workspace=packages/crdt-core

# Build all packages
build:
	npm run build --workspaces

# Remove node_modules and compiled artifacts
clean:
	rm -rf node_modules
	rm -rf packages/*/node_modules
	rm -rf packages/*/dist
	rm -f data.db
