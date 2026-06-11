# Alvico Todo - Offline-First Sync Architecture

A production-grade monorepo featuring a React Native (Expo) web app with an Express backend, implementing **logical sequence operations** for offline-first sync, intelligent conflict resolution, and n8n webhook integration.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Expo Web)                        │
├─────────────────────────────────────────────────────────────┤
│  ✓ Focus Timer (with 5s background abandonment)             │
│  ✓ Syllabus Progress Tree (Subject → Chapter → Task)        │
│  ✓ localStorage with clientId namespacing (?client=A&B)    │
│  ✓ Logical Clock (incremental sequence numbers)             │
│  ✓ Optimistic local updates                                 │
│  ✓ Offline queue (pendingSync array)                        │
│  ✓ Webhook activity log panel                               │
└─────────────────────────────────────────────────────────────┘
                            ↓ POST /api/sync
                    [Sync Payload with Operations]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   SERVER (Express)                          │
├─────────────────────────────────────────────────────────────┤
│  ✓ In-memory database (SQLite-ready)                        │
│  ✓ Idempotent operation processing                          │
│  ✓ Conflict resolution (higher seq # wins)                  │
│  ✓ Session deduplication                                    │
│  ✓ n8n webhook firing                                       │
│  ✓ Audit trail & operation log                              │
└─────────────────────────────────────────────────────────────┘
                            ↓ POST (webhook)
                    [Payload: studentId, streak, coinsEarned]
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    n8n WORKFLOW                             │
├─────────────────────────────────────────────────────────────┤
│  1. Webhook Trigger (/alvico-sync)                          │
│  2. Deduplication (on sessionId)                            │
│  3. Format Log Message                                      │
│  4. HTTP Log Notification                                   │
│  5. Return Success Response                                 │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Shared Types & Sync Engine

- **STUDENT_ID:** `kashvi_pundir` (global constant)
- **Logical Clock:** Incremental sequence numbers (1, 2, 3, ...)
- **Operation Model:** UUID + seq# for deterministic deduplication
- **Conflict Resolution:** Higher sequence number wins, "completed" state priority

See [DECISIONS.md](./DECISIONS.md) for detailed architecture decisions.

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ (tested on v24 for Windows)
- npm (workspaces)
- TypeScript 5+
- Git

### ⚠️ Windows Node v24 Users

If you encounter `ENOENT: node:sea` errors on Windows with Node v24, the project includes automatic patches. See [WINDOWS_NODE_SEA_FIX.md](./WINDOWS_NODE_SEA_FIX.md) for details.

**Quick fix applied automatically:**
```bash
# The project patches Expo CLI to handle Windows colon restrictions
# Just run the normal install and start commands
```

### Installation

```bash
cd "To-DO ALvico"
npm install
```

### Development

**Terminal 1: Start Server**
```bash
cd server
npm run dev
# Server running on http://localhost:3001
```

**Terminal 2: Start Client (Expo Web)**
```bash
cd client
npm run dev
# Expo web at http://localhost:8081
```

**Terminal 3 (optional): n8n**
```bash
npx n8n
# Import n8n-workflow.json → activate workflow
# Set server env: N8N_WEBHOOK_URL=http://localhost:5678/webhook/alvico-sync
```

### Two-device demo

Open two tabs (or one incognito) so `localStorage` is isolated:

- Client A: `http://localhost:8081?client=A`
- Client B: `http://localhost:8081?client=B`

Use **Simulate Offline** in the dev panel, make conflicting edits, then **Sync Now** on each client.

### Testing Multi-Client Sync

1. Open http://localhost:19006?client=A in Browser Tab 1
2. Open http://localhost:19006?client=B in Browser Tab 2
3. In Tab A: Complete a task (operation recorded locally, seq++
4. In Tab B: Complete a different task
5. In Tab A: Go offline → Add focus session → Go online → Click "Sync Now"
6. Watch as both clients receive reconciled state ✨

## 📦 Project Structure

```
To-DO ALvico/
├── shared/                  # Shared types & sync engine
│   ├── src/
│   │   ├── types.ts        # Operation, Syllabus, FocusSession types
│   │   ├── sync-engine.ts  # LogicalClock, OperationLog, conflict resolution
│   │   └── index.ts        # Export barrel
│   └── package.json
│
├── server/                  # Express backend
│   ├── src/
│   │   ├── index.ts        # Main server & routes
│   │   ├── database.ts     # In-memory DB with deduplication
│   │   ├── webhook-service.ts  # n8n webhook firing
│   │   └── sync-processor.ts   # Operation processing logic
│   └── package.json
│
├── client/                  # Expo web app
│   ├── src/
│   │   ├── components/
│   │   │   ├── App.tsx             # Main app layout
│   │   │   ├── ControlPanel.tsx    # Network status & sync button
│   │   │   ├── FocusTimer.tsx      # Focus timer with abandonment
│   │   │   ├── SyllabusTracker.tsx # Subject/Chapter/Task tree
│   │   │   └── WebhookLogPanel.tsx # Webhook firing log
│   │   ├── storage.ts              # localStorage wrapper
│   │   ├── sync-engine-client.ts   # Client-side sync logic
│   │   ├── sync-client.ts          # Axios sync requests
│   │   └── index.tsx               # React entry point
│   ├── public/
│   │   └── index.html
│   ├── app.json            # Expo config
│   └── package.json
│
├── .github/                # CI/CD (future)
├── DECISIONS.md           # Architecture & conflict resolution
├── n8n-workflow.json      # n8n workflow (import this)
├── mock-n8n-workflow.json # legacy template
├── package.json           # Workspace config
└── tsconfig.json          # Root TypeScript config
```

## 🔄 Sync Flow

### 1. Client-Side Operation Creation

```typescript
// Task completion triggers operation
syncEngine.recordTaskChange(
  subjectId,
  chapterId,
  taskId,
  'completed',
  clientId
);

// Operation structure:
{
  operationId: '550e8400-e29b-41d4-a716-446655440000',
  sequenceNumber: 1,
  timestamp: 1700000000000,
  type: 'task_status_change',
  clientId: 'A',
  data: { subjectId: 'math', chapterId: 'ch1', taskId: 't1', status: 'completed' }
}
```

### 2. Offline Queueing

Operations are stored in localStorage under `alvico_${clientId}_pending_ops`:
```json
[
  { operationId: 'op-1', sequenceNumber: 1, type: 'task_status_change', ... },
  { operationId: 'op-2', sequenceNumber: 2, type: 'focus_session', ... }
]
```

### 3. Sync Request (When Online)

```bash
POST http://localhost:3001/api/sync
Content-Type: application/json

{
  "clientId": "A",
  "studentId": "kashvi_pundir",
  "operations": [...],
  "lastSyncSequence": 2
}
```

### 4. Server Processing

```typescript
// Process each operation idempotently
for (const operation of payload.operations) {
  if (operation.type === 'focus_session') {
    // Check deduplication
    if (db.isSessionProcessed(operation.data.sessionId)) {
      continue; // Skip duplicate
    }
    // Process new session
    db.markSessionProcessed(sessionId);
    await webhookService.fireWebhook(webhookPayload);
  }
}
```

### 5. Reconciliation Response

```json
{
  "success": true,
  "reconciled": {
    "syllabus": { "subjects": [...] },
    "focusSessions": [...]
  },
  "serverSequence": 15,
  "webhookFired": {
    "sessionId": "sess-xyz",
    "coinsEarned": 10,
    "streak": 1
  }
}
```

### 6. Client State Update

```typescript
storage.setSyllabus(response.reconciled.syllabus);
storage.setLastSyncSequence(response.serverSequence);
syncEngine.clearPendingOperations();
// UI updates automatically (React state)
```

## 🎯 Key Features

### 1. Logical Sequence Operations Log (LSOL)

- Every operation gets a **monotonically increasing sequence number**
- Not wall-clock time—prevents clock skew issues
- Enables causal ordering across multiple offline clients

### 2. Offline-First Architecture

- ✅ Works without network (all operations queued locally)
- ✅ Optimistic updates (UI updates instantly)
- ✅ Intelligent sync when online (batch & deduplicate)
- ✅ Deterministic conflict resolution

### 3. Conflict Resolution: Higher Sequence Wins

If two clients edit the same task:
- **Client A:** `seq=5, status='completed'`
- **Client B:** `seq=3, status='in-progress'`

**Result:** `status='completed'` (higher sequence number wins)

See [DECISIONS.md](./DECISIONS.md#2-conflict-resolution-higher-sequence-wins) for detailed rules.

### 4. Focus Timer with Background Detection

```typescript
// 5-second background rule
if (document.hidden && timeInBackground > 5000) {
  session.status = 'abandoned';  // Don't credit coins
}
```

### 5. Idempotency at Multiple Layers

| Layer | Mechanism |
|-------|-----------|
| **Client** | UUID per operation |
| **Server** | sessionId deduplication + idempotent state updates |
| **n8n** | Deduplication node on sessionId |

### 6. Multi-Client localStorage Isolation

Each client gets its own namespace:
- Client A: `alvico_A_syllabus`, `alvico_A_pending_ops`
- Client B: `alvico_B_syllabus`, `alvico_B_pending_ops`

Query params: `?client=A` or `?client=B`

## 🔌 API Endpoints

### `/api/sync` (POST)
Main sync endpoint. Accept batch of operations.

**Request:**
```json
{
  "clientId": "A",
  "studentId": "kashvi_pundir",
  "operations": [...],
  "lastSyncSequence": 5
}
```

**Response:**
```json
{
  "success": true,
  "reconciled": { "syllabus": {...}, "focusSessions": [...] },
  "serverSequence": 15,
  "webhookFired": {...}
}
```

### `/api/state` (GET)
Current server state (debugging).

```bash
curl http://localhost:3001/api/state | jq
```

### `/api/audit-trail` (GET)
Operation audit trail.

```bash
curl http://localhost:3001/api/audit-trail | jq '.[] | {seq: .sequenceNumber, type: .type, clientId: .clientId}'
```

### `/api/webhook-log` (GET)
Webhook firing history.

```bash
curl http://localhost:3001/api/webhook-log | jq
```

### `/health` (GET)
Health check.

```bash
curl http://localhost:3001/health
```

## 📊 UI Components

### ControlPanel

Network status badge + pending operations counter + sync button

```
📱 Client: A   🌐 ONLINE   📝 Pending: 3 | Seq: 7   🔄 Sync Now
```

### FocusTimer

Start/stop timer with optimistic coin calculation

```
⏱️  00:45
🟢 ACTIVE   ▶️ Start   ✅ Complete   ✕ Abandon
📊 Sessions: 5 | Completed: 4 | 🪙 Coins: 40
```

### SyllabusTracker

Interactive syllabus with optimistic progress updates

```
📚 Syllabus Progress
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mathematics [████░░░░░░░] 40%
  Algebra [██████████] 100%
    ✅ Learn Equations
    ✅ Practice Problems
    ⭕ Take Quiz
  Geometry [░░░░░░░░░░] 0%
    ...
```

### WebhookLogPanel

Real-time log of webhook firings

```
🎣 Webhook Activity Log
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Webhook fired to n8n for Session 550e8400-e29b...  [14:23:45]
✅ Webhook fired to n8n for Session 92c36f5d-1f8c...  [14:23:12]
```

## 🧪 Testing Scenarios

### Scenario 1: Offline→Online Sync

1. Open client A
2. Go offline (DevTools Network)
3. Complete 2 tasks
4. Complete 1 focus session
5. Go online
6. Click "Sync Now"
7. ✅ Check: Webhook panel shows session fired

### Scenario 2: Concurrent Edits

1. Open client A & B side-by-side
2. Client A: Complete task t1 (seq=1)
3. Client B: Complete task t1 as "in-progress" (seq=1)
4. Client A: Sync
5. Client B: Sync
6. ✅ Check: Both clients show t1 as "completed" (seq 1 > seq 1, but "completed" wins)

### Scenario 3: Duplicate Session Processing

1. Client A: Complete focus session "sess-abc"
2. Client A: Sync (webhook fired ✅)
3. Client A: Click "Sync" again (re-send same session)
4. ✅ Check: Webhook NOT fired again (dedup prevented it)
5. ✅ Check: Server log shows "Duplicate session detected"

### Scenario 4: Background Abandonment

1. Start focus session
2. Switch to another tab/app (document.hidden)
3. Wait 6+ seconds
4. Return to tab
5. ✅ Check: Session marked as "abandoned" (no coins)

## 🔧 Configuration

### Environment Variables

Create `.env` in server directory:

```bash
# .env
PORT=3001
N8N_WEBHOOK_URL=http://localhost:5678/webhook/alvico-sync
NODE_ENV=development
```

### Client Environment

Create `.env` in client directory:

```bash
# .env
REACT_APP_API_URL=http://localhost:3001
```

## 📚 Documentation

- **[DECISIONS.md](./DECISIONS.md)** - Architecture, conflict resolution, idempotency
- **[n8n-workflow.json](./n8n-workflow.json)** - n8n workflow (import & activate)
- **[Shared Types](./shared/src/types.ts)** - Type definitions
- **[Sync Engine](./shared/src/sync-engine.ts)** - Core sync logic

## 🚦 Running Tests

```bash
# Run TypeScript type checking
yarn tsc --noEmit

# Lint all packages
yarn lint
```

## 🎓 Educational Value

This monorepo demonstrates:

1. **Offline-first architecture** - PWA patterns
2. **Conflict-free replicated data types** - CRDT concepts
3. **Logical clocks** - Distributed systems fundamentals
4. **Idempotent operations** - Resilient systems design
5. **Webhook integration** - Serverless workflows (n8n)
6. **Type-safe monorepos** - TypeScript workspace management
7. **Optimistic UI updates** - Modern UX patterns

Perfect for teaching:
- Full-stack TypeScript development
- Distributed systems concepts
- Offline-first PWA design
- Sync algorithms without third-party libraries

## 🚀 Deployment

### Vercel Deployment (Frontend)

This project is Vercel-ready. Deploy the Expo web app with one click:

1. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect the `vercel.json` configuration

2. **Configure Environment Variables:**
   - Set `REACT_APP_API_URL` to your backend URL (e.g., `https://your-api.herokuapp.com`)

3. **Deploy:**
   - Click "Deploy"
   - Vercel will run `npm run vercel-build` to build the Expo web app

**Manual deployment:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Backend Deployment

The Express server can be deployed separately to platforms like:
- **Heroku**: Push to Heroku with `heroku create` and deploy
- **Railway**: Connect GitHub repo and deploy
- **Render**: Create a new Web Service from GitHub

### Full-Stack Deployment

For a complete deployment:
1. Deploy backend to Heroku/Railway/Render
2. Deploy frontend to Vercel
3. Update `REACT_APP_API_URL` in client `.env` to point to your backend URL

## 🔮 Future Enhancements

### Phase 2: Persistence
- SQLite server-side (replace in-memory)
- IndexedDB client-side metadata

### Phase 3: Real-time Sync
- WebSocket support for live updates
- Push updates to other clients

### Phase 4: Conflict UI
- Show conflicted items to users
- Manual override option

### Phase 5: Multi-Syllabus
- Multiple syllabi per student
- Teacher approval workflows
- Leaderboards & gamification

## 📄 License

MIT

## 👤 Student

**studentId:** `kashvi_pundir`

---

**Last Updated:** June 9, 2026

For detailed architecture decisions, see [DECISIONS.md](./DECISIONS.md).
