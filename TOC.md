# Table of Contents

## 📖 Documentation

Start with these in order:

1. **[BUILD_SUMMARY.md](./BUILD_SUMMARY.md)** ← **START HERE**
   - What was built
   - Quick start instructions
   - System overview diagram

2. **[README.md](./README.md)**
   - Full feature list
   - Architecture overview
   - API endpoint reference
   - UI component documentation

3. **[DECISIONS.md](./DECISIONS.md)**
   - Logical Sequence Operations Log (LSOL)
   - Conflict resolution strategy
   - Idempotency at 3 layers
   - Trade-offs vs. Replicache

4. **[ARCHITECTURE.md](./ARCHITECTURE.md)**
   - System diagrams
   - Data flow walkthroughs
   - Component relationships
   - Detailed sync flow example

5. **[SETUP.md](./SETUP.md)**
   - Installation instructions
   - 6 testing scenarios with pass/fail criteria
   - Debugging guide
   - Troubleshooting

6. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)**
   - API quick reference
   - Code snippets
   - Common tasks
   - Debugging commands

---

## 📁 Source Code

### Shared Types & Sync Logic (`/shared/src/`)

- **[types.ts](./shared/src/types.ts)** (68 lines)
  - `Operation` - Base type for sync operations
  - `FocusSession` - Focus timer data
  - `Syllabus` - Subject/Chapter/Task hierarchy
  - `SyncPayload` - Client→Server request
  - `SyncResponse` - Server→Client response
  - Interfaces for conflict resolution

- **[sync-engine.ts](./shared/src/sync-engine.ts)** (210 lines)
  - `LogicalClock` - Incremental sequence numbers
  - `OperationLog` - Operation storage & retrieval
  - `resolveTaskConflict()` - Deterministic conflict resolution
  - `applyOperationToSyllabus()` - State merge logic
  - `initializeSyllabus()` - Demo data

- **[index.ts](./shared/src/index.ts)** (2 lines)
  - Barrel export

### Server (`/server/src/`)

- **[index.ts](./server/src/index.ts)** (74 lines)
  - Express app setup
  - POST /api/sync endpoint
  - GET /api/state endpoint
  - GET /api/audit-trail endpoint
  - GET /api/webhook-log endpoint
  - GET /health endpoint
  - Server startup logging

- **[database.ts](./server/src/database.ts)** (109 lines)
  - `Database` class - In-memory state management
  - `processedSessions` Set - Deduplication
  - `sessionRewards` Map - Reward tracking
  - `operationLog` Map - Audit trail
  - `clientStates` Map - Per-client state
  - Global state getter/setter methods

- **[webhook-service.ts](./server/src/webhook-service.ts)** (52 lines)
  - `WebhookService` class - n8n webhook firing
  - `fireWebhook()` - Axios POST with retry/timeout
  - `getWebhookLog()` - Webhook history
  - `clearWebhookLog()` - Reset logs
  - Error handling for webhook failures

- **[sync-processor.ts](./server/src/sync-processor.ts)** (98 lines)
  - `processSync()` - Main sync logic
  - Operation processing loop
  - Task status updates
  - Session deduplication
  - Webhook firing trigger
  - State reconciliation
  - Helper functions: `getServerState()`, `getAuditTrail()`, `getWebhookLog()`

### Client (`/client/src/`)

#### Storage & Sync

- **[storage.ts](./client/src/storage.ts)** (73 lines)
  - `ClientStorage` class - localStorage wrapper
  - Namespaced keys: `alvico_${clientId}_*`
  - Methods for syllabus, operations, sessions, logs
  - `getClientIdFromUrl()` - Parse query param
  - Singleton: `storage`, `clientId`

- **[sync-engine-client.ts](./client/src/sync-engine-client.ts)** (132 lines)
  - `ClientSyncEngine` class - Client-side sync
  - `LogicalClock` instance per client
  - `recordTaskChange()` - Create task operation
  - `recordFocusSession()` - Create session operation
  - Online/offline event handlers
  - Pending operation management
  - Singleton: `syncEngine`

- **[sync-client.ts](./client/src/sync-client.ts)** (55 lines)
  - `SyncClient` class - HTTP client
  - `sync()` - POST to /api/sync
  - Error handling
  - Response processing
  - Webhook log updates
  - Singleton: `syncClient`

#### Components

- **[components/App.tsx](./client/src/components/App.tsx)** (28 lines)
  - Main app layout wrapper
  - Renders: ControlPanel → FocusTimer → SyllabusTracker → WebhookLogPanel
  - Global styles

- **[components/ControlPanel.tsx](./client/src/components/ControlPanel.tsx)** (90 lines)
  - Network status badge (🌐 ONLINE / 📡 OFFLINE)
  - Pending operations counter
  - Sequence number display
  - "Sync Now" button
  - Auto-refresh on interval
  - Props: `onSync` callback

- **[components/FocusTimer.tsx](./client/src/components/FocusTimer.tsx)** (177 lines)
  - MM:SS timer display
  - Start/Complete/Abandon buttons
  - Active/Idle status badge
  - Background abandonment detection (5s rule)
  - Session statistics
  - Coins earned counter
  - Props: `onSessionComplete` callback

- **[components/SyllabusTracker.tsx](./client/src/components/SyllabusTracker.tsx)** (196 lines)
  - Subject → Chapter → Task hierarchy
  - Click task to cycle status
  - Real-time progress bars
  - Percentage calculations
  - Color-coded status badges
  - Optimistic local updates
  - Props: `onUpdate` callback

- **[components/WebhookLogPanel.tsx](./client/src/components/WebhookLogPanel.tsx)** (71 lines)
  - Webhook firing history display
  - Last 20 entries (circular buffer)
  - Session ID + timestamp
  - Auto-refresh on interval
  - "No webhooks yet" state
  - No props

#### Entry Points

- **[index.tsx](./client/src/index.tsx)** (8 lines)
  - React root render
  - App component mount

- **[public/index.html](./client/public/index.html)** (30 lines)
  - HTML template
  - Root div
  - Global styles

### Configuration

- **[package.json](./package.json)** - Root workspace config
- **[tsconfig.json](./tsconfig.json)** - Root TypeScript config
- **[shared/package.json](./shared/package.json)** - Shared workspace
- **[shared/tsconfig.json](./shared/tsconfig.json)** - Shared TypeScript
- **[server/package.json](./server/package.json)** - Server workspace
- **[server/tsconfig.json](./server/tsconfig.json)** - Server TypeScript
- **[server/.env.example](./server/.env.example)** - Environment template
- **[client/package.json](./client/package.json)** - Client workspace
- **[client/tsconfig.json](./client/tsconfig.json)** - Client TypeScript
- **[client/app.json](./client/app.json)** - Expo configuration
- **[client/.env.example](./client/.env.example)** - Environment template

### Workflow & Integration

- **[mock-n8n-workflow.json](./mock-n8n-workflow.json)** (98 lines)
  - n8n workflow definition
  - 5 nodes: Webhook → Dedup → Format → HTTP → Response
  - Deduplication on sessionId
  - Mock HTTP log endpoint
  - Importable into n8n

### Project Files

- **[.gitignore](./.gitignore)** - Git exclude patterns
- **[LICENSE](./LICENSE)** - MIT License
- **[README.md](./README.md)** - Main documentation
- **[DECISIONS.md](./DECISIONS.md)** - Architecture decisions
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
- **[SETUP.md](./SETUP.md)** - Testing & setup guide
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Developer quick ref
- **[BUILD_SUMMARY.md](./BUILD_SUMMARY.md)** - Build summary
- **[TOC.md](./TOC.md)** - This file!

---

## 🗂️ File Statistics

| Category | Count | Lines |
|----------|-------|-------|
| Documentation | 7 | ~3,500 |
| Shared Code | 3 | 280 |
| Server Code | 4 | 333 |
| Client Components | 5 | 652 |
| Client Core | 3 | 260 |
| Configuration | 12 | 150 |
| **Total** | **34** | **~5,175** |

---

## 🔍 Quick Navigation

### By Role

**Architect:** [DECISIONS.md](./DECISIONS.md) → [ARCHITECTURE.md](./ARCHITECTURE.md)  
**Backend Dev:** [server/src/](./server/src/) → [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)  
**Frontend Dev:** [client/src/components/](./client/src/components/) → [README.md](./README.md)  
**Full Stack:** [BUILD_SUMMARY.md](./BUILD_SUMMARY.md) → [SETUP.md](./SETUP.md)  
**QA/Tester:** [SETUP.md](./SETUP.md) → [API endpoints in README](./README.md#-api-endpoints)  
**DevOps:** [.env.example files](./server/.env.example) → Configuration section above

### By Task

**Set up locally:** [SETUP.md](./SETUP.md) - Installation  
**Understand sync:** [DECISIONS.md](./DECISIONS.md) - Logical Sequence Operations Log  
**Debug issue:** [SETUP.md](./SETUP.md#-debugging) - Debugging section  
**Add feature:** [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#-common-tasks)  
**Run tests:** [SETUP.md](./SETUP.md#-testing-scenarios)  
**Deploy:** [README.md](./README.md#-configuration) - Configuration section

### By Concept

**Offline-first:** [ARCHITECTURE.md](./ARCHITECTURE.md#-system-diagram)  
**Conflict resolution:** [DECISIONS.md](./DECISIONS.md#2-conflict-resolution-higher-sequence-wins)  
**Logical clocks:** [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#-key-acronyms--concepts)  
**Webhook integration:** [README.md](./README.md#-focus-session-workflow)  
**Focus timer:** [client/src/components/FocusTimer.tsx](./client/src/components/FocusTimer.tsx)  
**Syllabus tracker:** [client/src/components/SyllabusTracker.tsx](./client/src/components/SyllabusTracker.tsx)  

---

## 📊 Architecture at a Glance

```
shared/
├─ Types (Operation, Syllabus, FocusSession)
└─ SyncEngine (LogicalClock, conflict resolution)

server/
├─ Express server (:3001)
├─ Database (in-memory)
├─ WebhookService (n8n integration)
└─ SyncProcessor (operation handling)

client/
├─ React UI (5 components)
├─ ClientStorage (localStorage wrapper)
├─ ClientSyncEngine (logical clock + queue)
└─ SyncClient (HTTP requests)
```

---

## 🎯 Key Principles

1. **Offline-First** - Sync when online, queue when offline
2. **Logical Clocks** - Sequence numbers, not wall-clock time
3. **Deterministic** - Same inputs always → same conflict resolution
4. **Idempotent** - Safe to replay; happens at 3 layers (client UUID, server dedup, n8n dedup)
5. **Transparent** - Audit trails, console logs, API endpoints for debugging
6. **Type-Safe** - Full TypeScript, strict mode
7. **Zero Deps** - No Replicache, no CRDTs library, just core logic

---

## 🚀 Getting Started

```bash
# 1. Install
cd "To-DO ALvico"
yarn install

# 2. Start server (Terminal 1)
cd server && yarn dev

# 3. Start client (Terminal 2)
cd client && yarn dev

# 4. Test
# Open http://localhost:19006?client=A
# Open http://localhost:19006?client=B
# Follow scenarios in SETUP.md
```

---

## 📚 For More Information

- **Overview:** [README.md](./README.md)
- **Architecture:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Decisions:** [DECISIONS.md](./DECISIONS.md)
- **Testing:** [SETUP.md](./SETUP.md)
- **Reference:** [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **Build Summary:** [BUILD_SUMMARY.md](./BUILD_SUMMARY.md)

---

**Version:** 1.0.0  
**Student:** kashvi_pundir  
**Date:** June 9, 2026  
**License:** MIT

🎉 **Complete offline-first monorepo with intelligent sync & conflict resolution**
