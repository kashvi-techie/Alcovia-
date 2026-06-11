# Quick Reference Guide

## 🎯 Key Acronyms & Concepts

| Term | Meaning | Example |
|------|---------|---------|
| **LSOL** | Logical Sequence Operations Log | seq=1,2,3 instead of timestamps |
| **UUID** | Universally Unique Identifier | `550e8400-e29b-41d4-a716...` |
| **Dedup** | Deduplication | Skip duplicate sessions |
| **Reconciliation** | Merging states from multiple sources | Server combines Client A + B states |
| **Idempotent** | Safe to replay multiple times | Setting task status twice = once |
| **Causal Ordering** | Event A happened before B | seq=5 > seq=3 means seq=5 is "later" |

---

## 📱 Client-Side Quick Reference

### Storage Namespaces

```javascript
// Stored in localStorage under these keys:
localStorage['alvico_A_syllabus']          // Current state
localStorage['alvico_A_pending_ops']       // Waiting to sync
localStorage['alvico_A_pending_sessions']  // Focus sessions waiting
localStorage['alvico_A_last_sync_seq']     // Current sequence
localStorage['alvico_A_webhook_logs']      // Webhook history
```

### LogicalClock API

```typescript
import { LogicalClock } from '@alvico/shared';

const clock = new LogicalClock();
clock.increment();  // → 1
clock.increment();  // → 2
clock.get();        // → 2
clock.set(5);       // Set to 5
clock.increment();  // → 6
```

### Creating Operations

```typescript
import { syncEngine } from './sync-engine-client';

// Task change
syncEngine.recordTaskChange(
  subjectId,
  chapterId,
  taskId,
  'completed',  // 'pending', 'in-progress', or 'completed'
  clientId
);

// Focus session
const { session, operation } = syncEngine.recordFocusSession(
  sessionId,           // UUID
  durationMs,          // milliseconds
  'completed',         // 'completed' or 'abandoned'
  clientId
);
```

### Syncing

```typescript
import { syncClient } from './sync-client';

// Returns null if offline or no pending ops
const response = await syncClient.sync();

if (response) {
  console.log('Synced successfully');
  console.log(response.webhookFired);  // { sessionId, coinsEarned, streak }
}
```

### Check Status

```typescript
import { syncEngine } from './sync-engine-client';
import { storage, clientId } from './storage';

// Online status
syncEngine.getIsOnline();  // true or false

// Pending operations
syncEngine.getPendingOperations().length;  // Number pending

// Current sequence
syncEngine.getCurrentSequence();  // e.g., 7

// Last sync sequence
storage.getLastSyncSequence();  // e.g., 5

// Webhook logs
storage.getWebhookLogs();  // Array of { sessionId, timestamp }
```

---

## 🖥️ Server-Side Quick Reference

### Database API

```typescript
import { db } from './database';

// Check if session already processed
db.isSessionProcessed('sess-abc');  // true or false

// Mark session as processed
db.markSessionProcessed('sess-abc', coinsEarned, streak);

// Get session reward info
db.getSessionReward('sess-abc');  // { coinsEarned, streak, timestamp }

// Record operation for audit
db.recordOperation(operation);

// Get global state
const { syllabus, focusSessions, lastSyncSequence } = db.getGlobalState();

// Increment global sequence
db.incrementGlobalSequence();  // Returns new sequence

// Get audit trail
db.getAuditTrail();  // All operations in order

// Update global state
db.updateGlobalState(newSyllabus, newFocusSessions);
```

### Webhook Service API

```typescript
import { webhookService } from './webhook-service';

// Fire webhook
const success = await webhookService.fireWebhook({
  studentId: 'kashvi_pundir',
  streak: 1,
  coinsEarned: 10,
  sessionId: 'sess-xyz',
  timestamp: Date.now()
});

// Get webhook log
webhookService.getWebhookLog();
// [
//   { payload, status: 'success'|'failed', statusCode, error, timestamp },
//   ...
// ]

// Clear webhook log
webhookService.clearWebhookLog();
```

### Sync Processing

```typescript
import { processSync, getServerState, getAuditTrail } from './sync-processor';

// Process sync from client
const response = await processSync(syncPayload);
// Returns SyncResponse with reconciled state

// Get current server state
const { syllabus, focusSessions, sequence } = getServerState();

// Get operation history
const trail = getAuditTrail();
```

### Routes

```typescript
// Main sync endpoint
POST /api/sync
// Body: SyncPayload
// Response: SyncResponse

// Get current state
GET /api/state
// Response: { syllabus, focusSessions, sequence }

// Get operation history
GET /api/audit-trail
// Response: Operation[]

// Get webhook history
GET /api/webhook-log
// Response: { payload, status, statusCode, error, timestamp }[]

// Health check
GET /health
// Response: { status: 'ok' }
```

---

## 🎨 React Components Quick Reference

### ControlPanel

Shows network status, pending count, and sync button.

```tsx
import { ControlPanel } from './components/ControlPanel';

<ControlPanel onSync={() => console.log('Synced!')} />
```

**Props:**
- `onSync?: () => void` - Called when sync completes

**Display:**
- Network badge (🌐 ONLINE or 📡 OFFLINE)
- Pending operations count
- Current sequence number
- Sync button (enabled only when online + pending)

---

### FocusTimer

Timer with start/complete/abandon actions.

```tsx
import { FocusTimer } from './components/FocusTimer';

<FocusTimer onSessionComplete={() => console.log('Session ended')} />
```

**Props:**
- `onSessionComplete?: () => void` - Called when session ends

**Features:**
- MM:SS display
- Active/idle status badge
- Start/Complete/Abandon buttons
- Session counter
- Coins earned counter

---

### SyllabusTracker

Interactive subject/chapter/task tree.

```tsx
import { SyllabusTracker } from './components/SyllabusTracker';

<SyllabusTracker onUpdate={() => console.log('Task updated')} />
```

**Props:**
- `onUpdate?: () => void` - Called when task status changes

**Features:**
- Click task to cycle status: pending → in-progress → completed → pending
- Real-time progress bar updates
- Subject & chapter progress percentages
- Color-coded status badges

---

### WebhookLogPanel

Displays recent webhook firings.

```tsx
import { WebhookLogPanel } from './components/WebhookLogPanel';

<WebhookLogPanel />
```

**Features:**
- Shows last 20 webhook firings
- Session ID + timestamp
- Auto-refreshes every 500ms
- "No webhooks yet" message when empty

---

## 📊 Data Structures

### Operation

```typescript
interface Operation {
  operationId: string;        // UUID
  sequenceNumber: number;     // Logical clock
  timestamp: number;          // Wall-clock (reference only)
  type: 'task_status_change' | 'focus_session' | 'sync_complete';
  clientId: string;           // 'A', 'B', 'default', etc
  data: Record<string, any>;  // Type-specific payload
}
```

### FocusSession

```typescript
interface FocusSession {
  sessionId: string;           // UUID
  duration: number;            // milliseconds
  status: 'completed' | 'abandoned';
  startedAt: number;           // timestamp
  endedAt: number;             // timestamp
  coinsEarned: number;         // 0 or 10 (if completed)
  streak: number;              // 0 or 1 (if completed)
}
```

### SyncPayload

```typescript
interface SyncPayload {
  clientId: string;            // 'A', 'B', etc
  studentId: string;           // 'kashvi_pundir'
  operations: Operation[];     // Batch to sync
  lastSyncSequence: number;    // Client's current seq
}
```

### SyncResponse

```typescript
interface SyncResponse {
  success: boolean;
  reconciled: {
    syllabus: Syllabus;
    focusSessions: FocusSession[];
  };
  serverSequence: number;
  webhookFired?: {
    sessionId: string;
    coinsEarned: number;
    streak: number;
    timestamp: number;
  };
}
```

---

## 🧪 Testing Checklist

- [ ] Client A completes task → sequence increments
- [ ] Client goes offline → pending ops queued
- [ ] Client goes online → "Sync Now" button enabled
- [ ] Click "Sync Now" → webhook log updates
- [ ] Server log shows operation processed
- [ ] Client B sees same state after refresh
- [ ] Two clients complete same task → conflict resolved
- [ ] Focus session abandoned after 5s → no coins earned
- [ ] Focus session completed → coins earned, webhook fired
- [ ] Sync again with same session → webhook NOT fired again

---

## 🔍 Debugging Commands

### Check Server State
```bash
curl http://localhost:3001/api/state | jq '.'
```

### See Operations in Order
```bash
curl http://localhost:3001/api/audit-trail | jq '.[] | {seq: .sequenceNumber, type: .type, clientId: .clientId}'
```

### Check Webhook History
```bash
curl http://localhost:3001/api/webhook-log | jq '.'
```

### Check localStorage (DevTools Console)
```javascript
// Client A's state
JSON.parse(localStorage['alvico_A_syllabus'])
JSON.parse(localStorage['alvico_A_pending_ops'])
JSON.parse(localStorage['alvico_A_webhook_logs'])

// Client B's state
JSON.parse(localStorage['alvico_B_syllabus'])
JSON.parse(localStorage['alvico_B_pending_ops'])
```

### View Network Requests (DevTools Network Tab)
- Look for POST requests to `http://localhost:3001/api/sync`
- Check request body (SyncPayload)
- Check response body (SyncResponse)

---

## 🚀 Common Tasks

### Add a New Task to Syllabus
Edit `shared/src/sync-engine.ts` → `initializeSyllabus()` function:

```typescript
{
  id: 'ch1',
  name: 'Algebra',
  tasks: [
    { id: 't1', title: 'Learn Equations', status: 'pending' },
    { id: 't2', title: 'Practice Problems', status: 'pending' },
    // ADD NEW TASK HERE:
    { id: 't3', title: 'New Task Title', status: 'pending' }
  ]
}
```

### Change Conflict Resolution Strategy

Edit `shared/src/sync-engine.ts` → `resolveTaskConflict()` function:

```typescript
// Example: Last-write-wins instead of sequence-based
if (operation1.timestamp > operation2.timestamp) {
  return operation1.status;
} else {
  return operation2.status;
}
```

### Log Every Operation

Edit `server/src/sync-processor.ts` → `processSync()` function:

```typescript
for (const operation of payload.operations) {
  console.log(`Processing: ${operation.type} from ${operation.clientId}`);  // ADD THIS
  db.recordOperation(operation);
  // ...
}
```

### Change Webhook URL

Set environment variable:
```bash
export N8N_WEBHOOK_URL=https://your-webhook.com/alvico
yarn dev  # Restart server
```

Or edit `server/.env`:
```
N8N_WEBHOOK_URL=https://your-webhook.com/alvico
```

---

## 📚 Further Reading

- **[DECISIONS.md](./DECISIONS.md)** - Deep dive into architecture choices
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System diagram and flow
- **[README.md](./README.md)** - Full documentation
- **[SETUP.md](./SETUP.md)** - Testing scenarios and debugging

---

## 🎓 Key Takeaways

1. **Logical clocks** beat wall-clock time for distributed sync
2. **UUIDs** at every layer ensure idempotency
3. **Offline-first** means queue first, sync later
4. **Conflict resolution** must be deterministic
5. **Deduplication** at 3 layers (client, server, n8n)
6. **localStorage namespacing** enables multi-client isolation
7. **Optimistic updates** make UI feel responsive
8. **Audit trails** make debugging transparent

---

*Last updated: June 9, 2026*
