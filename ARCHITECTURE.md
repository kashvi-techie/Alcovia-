# Architecture Summary

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ALVICO TODO SYSTEM                         │
└─────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────┐
                    │   Student: kashvi    │
                    └──────────────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
              CLIENT A         CLIENT B
          (browser A&C)     (browser tab)
        (?client=A)         (?client=B)
              │                 │
         [Storage A]       [Storage B]
         [LogicalClock A]  [LogicalClock B]
              │                 │
              └────────┬────────┘
                       │
                [Network Check]
              (navigator.onLine)
                       │
                    ONLINE?
                   /        \
                 YES         NO
                 │            └─→ [Queue Locally]
              [Batch]            (localStorage)
                 │
              [SYNC]             [Later...]
        POST /api/sync             │
           [Payload]               │
          operations[]      RECONNECT?
                 │            │
                 └────┬───────┘
                      │
         ┌────────────▼──────────────┐
         │   EXPRESS SERVER          │
         │  PORT 3001                │
         │                           │
         │ ┌───────────────────────┐ │
         │ │ Process Operations    │ │
         │ │ - Deduplicate         │ │
         │ │ - Apply to State      │ │
         │ │ - Resolve Conflicts   │ │
         │ └───────────────────────┘ │
         │                           │
         │ ┌───────────────────────┐ │
         │ │ Database              │ │
         │ │ - Processed sessions  │ │
         │ │ - Global state        │ │
         │ │ - Audit trail         │ │
         │ └───────────────────────┘ │
         │                           │
         │ ┌───────────────────────┐ │
         │ │ WebhookService        │ │
         │ │ - Fire n8n POST       │ │
         │ │ - Log attempts        │ │
         │ │ - Handle failures     │ │
         │ └───────────────────────┘ │
         └────────────┬──────────────┘
                      │
            [SyncResponse]
       reconciled.syllabus
       reconciled.sessions
       serverSequence
       webhookFired?
                      │
         ┌────────────▼──────────────┐
         │   CLIENTS RECEIVE         │
         │                           │
         │ storage.setSyllabus()     │
         │ storage.setLastSyncSeq()  │
         │ clearPendingOps()         │
         │                           │
         │ [UI Updates] ✨           │
         │ - Progress bars           │
         │ - Task statuses           │
         │ - Webhook log             │
         └───────────────────────────┘
                      │
                      │
              ┌───────▼────────┐
              │  n8n WORKFLOW  │
              │  (if webhook   │
              │   fired)       │
              │                │
              │ 1. Webhook     │
              │ 2. Deduplicate │
              │ 3. Format      │
              │ 4. HTTP Log    │
              │ 5. Response    │
              └────────────────┘
```

---

## Key Concepts

### 1. Logical Sequence Numbers

**Not wall-clock time.** Every operation gets an incrementing counter:

```
Client A offline:
  op1: seq=1, type=task_change, task_id=t1, status=done
  op2: seq=2, type=focus_session, status=complete
  op3: seq=3, type=task_change, task_id=t2, status=in-progress

Client B offline:
  op1: seq=1, type=task_change, task_id=t1, status=in-progress
  op2: seq=2, type=focus_session, status=complete

When both sync, server sees:
  [A:seq1, B:seq1, A:seq2, B:seq2, A:seq3]

On conflict (task t1):
  A says seq=1 "done", B says seq=1 "in-progress"
  → Tiebreaker: "done" wins (completion priority)
```

**Why this works:**
- No clock skew problems (no wall-clock dependency)
- Pure causal ordering
- Reproducible resolution (same inputs → same output)

---

### 2. Offline-First Queue

All local changes stored in **localStorage** under client namespace:

```json
{
  "alvico_A_pending_ops": [
    { "operationId": "uuid-1", "sequenceNumber": 1, "data": {...} },
    { "operationId": "uuid-2", "sequenceNumber": 2, "data": {...} }
  ],
  "alvico_A_pending_sessions": [
    { "sessionId": "sess-1", "status": "completed", "coinsEarned": 10 }
  ]
}
```

When client goes online:
1. Batch all pending operations
2. POST to `/api/sync`
3. Wait for reconciled state
4. Update UI
5. Clear pending queue

---

### 3. Deterministic Conflict Resolution

**Rule hierarchy:**

1. **Higher sequence number wins**
   - seq=7 > seq=5 → use seq=7

2. **Completion priority**
   - If sequences equal: "completed" always wins

3. **Alphabetical tiebreaker**
   - If neither rule applies: sort alphabetically, pick first

```typescript
function resolveTaskConflict(
  taskId, 
  statusA, seqA,
  statusB, seqB
) {
  if (seqA > seqB) return statusA;  // Higher seq wins
  if (seqB > seqA) return statusB;
  
  // Equal sequences
  if (statusA === 'completed') return 'completed';
  if (statusB === 'completed') return 'completed';
  
  // Neither completed: alphabetical
  return [statusA, statusB].sort()[0];
}
```

**Deterministic guarantee:** Given the same inputs, this always produces the same output across all replicas (server, client A, client B, etc.)

---

### 4. Idempotency at Three Layers

#### Layer 1: Client (UUID)

```typescript
const operation = {
  operationId: uuidv4(),  // "550e8400-e29b-41d4-a716..."
  sequenceNumber: 1,
  data: { taskId: 't1', status: 'completed' }
};
```

If retransmitted → same `operationId` → server recognizes as duplicate.

#### Layer 2: Server (Session Dedup)

```typescript
class Database {
  private processedSessions: Set<string> = new Set();

  isSessionProcessed(sessionId: string) {
    return this.processedSessions.has(sessionId);
  }
}

// In sync handler:
if (db.isSessionProcessed(session.sessionId)) {
  continue;  // Skip, already processed
}
db.markSessionProcessed(session.sessionId);
fireWebhook();  // Fire ONLY for new sessions
```

#### Layer 3: n8n (Dedup Node)

```json
{
  "type": "deduplication",
  "properties": {
    "field": "sessionId"
  }
}
```

If webhook POSTed multiple times with same `sessionId`:
- First POST → passes through, fires notification ✅
- Second POST → blocked by dedup node ❌

**Triple defense:** Even if network retries or bugs cause duplicate sync, webhook only fires once.

---

### 5. Sync Flow Example

**Scenario: Client A completes task, goes offline for a bit, comes back online**

```
STEP 1: Task Completion
┌──────────────────────────────────┐
│ User clicks task "Learn Algebra" │
└──────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ syncEngine.recordTaskChange(                         │
│   subjectId='math',                                  │
│   chapterId='ch1',                                   │
│   taskId='t1',                                       │
│   status='completed',                                │
│   clientId='A'                                       │
│ )                                                    │
└──────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ Operation Created:                                   │
│ {                                                    │
│   operationId: 'uuid-1',                             │
│   sequenceNumber: 1,  (auto-increment)               │
│   timestamp: 1700000000000,                          │
│   type: 'task_status_change',                        │
│   clientId: 'A',                                     │
│   data: {                                            │
│     subjectId: 'math',                               │
│     chapterId: 'ch1',                                │
│     taskId: 't1',                                    │
│     status: 'completed'                              │
│   }                                                  │
│ }                                                    │
└──────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ localStorage Update:                                 │
│ alvico_A_pending_ops = [<operation above>]           │
│ alvico_A_syllabus updated locally (optimistic)       │
│ alvico_A_last_sync_seq = 1                           │
│                                                      │
│ UI UPDATES INSTANTLY ✨                              │
│ - Progress bar: 0% → 33%                             │
│ - Task status: ⭕ Pending → ✅ Completed             │
│ - Seq counter: Seq: 1                                │
└──────────────────────────────────────────────────────┘

STEP 2: Go Offline
                 │
    User disconnects network
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ navigator.onLine = false                             │
│ Control Panel: "📡 OFFLINE"                          │
│ Sync button: DISABLED (grayed out)                   │
│                                                      │
│ User can still:                                      │
│ ✓ Complete more tasks (queued)                       │
│ ✓ Start focus sessions (queued)                      │
│ ✗ Sync (button disabled)                             │
└──────────────────────────────────────────────────────┘

STEP 3: User Does More Edits (Offline)
                 │
        ┌────────┴────────┐
        │                 │
    Task 2             Focus Session
    completed          started & completed
        │                 │
        ▼                 ▼
  Operation 2         Operation 3
  seq=2               seq=3
        │                 │
        └────────┬────────┘
                 │
              localStorage:
          alvico_A_pending_ops
              [op1, op2, op3]

STEP 4: Go Online
                 │
    User reconnects network
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ navigator.onLine = true                              │
│ Control Panel: "🌐 ONLINE"                           │
│ Sync button: ENABLED                                 │
│ Pending: 3 operations                                │
└──────────────────────────────────────────────────────┘

STEP 5: Manual Sync
                 │
    User clicks "🔄 Sync Now"
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ syncClient.sync()                                    │
│ Prepare SyncPayload:                                 │
│ {                                                    │
│   clientId: 'A',                                     │
│   studentId: 'kashvi_pundir',                        │
│   operations: [op1, op2, op3],                       │
│   lastSyncSequence: 3                                │
│ }                                                    │
└──────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ HTTP POST to http://localhost:3001/api/sync         │
│ Headers: Content-Type: application/json              │
│ Body: <SyncPayload above>                            │
│ Timeout: 10 seconds                                  │
└──────────────────────────────────────────────────────┘

STEP 6: Server Processes
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ Express /api/sync handler:                           │
│                                                      │
│ For each operation:                                  │
│ 1. Record in audit trail                             │
│ 2. If task_change: apply to syllabus                 │
│    - Find subject/chapter/task                       │
│    - Update status                                   │
│    - Recalculate progress %                          │
│                                                      │
│ 3. If focus_session: deduplicate                     │
│    - Check: isSessionProcessed(sessionId)?           │
│    - If new: mark processed, add to list             │
│    - Fire webhook!                                   │
└──────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ webhookService.fireWebhook({                         │
│   studentId: 'kashvi_pundir',                        │
│   streak: 1,                                         │
│   coinsEarned: 10,                                   │
│   sessionId: 'sess-xyz',                             │
│   timestamp: 1700000100000                           │
│ })                                                   │
│                                                      │
│ HTTP POST to n8n webhook URL ✅                      │
└──────────────────────────────────────────────────────┘

STEP 7: Server Response
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ SyncResponse:                                        │
│ {                                                    │
│   success: true,                                     │
│   reconciled: {                                      │
│     syllabus: { ... },    ← Updated for ALL clients  │
│     focusSessions: [...]  ← All sessions             │
│   },                                                 │
│   serverSequence: 15,     ← Server's next seq #      │
│   webhookFired: {                                    │
│     sessionId: 'sess-xyz',                           │
│     coinsEarned: 10,                                 │
│     streak: 1                                        │
│   }                                                  │
│ }                                                    │
└──────────────────────────────────────────────────────┘

STEP 8: Client Receives & Updates
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ Client-side sync completion:                         │
│                                                      │
│ storage.setSyllabus(response.reconciled.syllabus)   │
│ storage.setLastSyncSequence(response.serverSequence)│
│ syncEngine.clearPendingOperations()                  │
│ storage.addWebhookLog(response.webhookFired)        │
│                                                      │
│ React state updates:                                 │
│ - UI re-renders with new syllabus                    │
│ - Webhook log panel gets new entry                   │
│ - Pending counter resets to 0                        │
│ - Sync button disabled until new changes             │
└──────────────────────────────────────────────────────┘

STEP 9: UI Displays Results
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ ControlPanel:                                        │
│ "🌐 ONLINE | 📝 Pending: 0 | Seq: 3 | 🔄 Sync Now" │
│                                                      │
│ WebhookLogPanel:                                     │
│ "✅ Webhook fired to n8n for Session sess-xyz..."   │
│                                                      │
│ SyllabusTracker:                                     │
│ Shows updated progress from server ✨               │
│                                                      │
│ FocusTimer:                                          │
│ "Sessions: 1 | Completed: 1 | Coins: 10"            │
└──────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `shared/src/types.ts` | Type definitions (Operation, SyncPayload, etc) |
| `shared/src/sync-engine.ts` | LogicalClock, OperationLog, conflict resolution |
| `server/src/index.ts` | Express server & /api/sync route |
| `server/src/database.ts` | In-memory database, session dedup |
| `server/src/webhook-service.ts` | n8n webhook firing |
| `server/src/sync-processor.ts` | Operation processing & reconciliation |
| `client/src/storage.ts` | localStorage wrapper with namespacing |
| `client/src/sync-engine-client.ts` | Client-side sync logic, LogicalClock |
| `client/src/sync-client.ts` | Axios HTTP client for /api/sync |
| `client/src/components/ControlPanel.tsx` | Network status + sync button |
| `client/src/components/FocusTimer.tsx` | Focus timer with background detection |
| `client/src/components/SyllabusTracker.tsx` | Subject/Chapter/Task tree |
| `client/src/components/WebhookLogPanel.tsx` | Webhook activity display |
| `DECISIONS.md` | Architecture deep dive |
| `mock-n8n-workflow.json` | n8n workflow template |

---

## Data Flow Summary

```
┌────────────────────────────────────┐
│   User Interaction                 │
│   - Task completion                │
│   - Timer start/stop               │
│   - Network toggle                 │
└────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────┐
│   Client-Side Changes              │
│   - LogicalClock++                 │
│   - Operation created              │
│   - localStorage updated           │
│   - UI updates optimistically      │
└────────────────────────────────────┘
              │
         ┌────┴───────┐
         │             │
    ONLINE?        NO → Queue Locally
    YES │             │ (survive refresh)
        ▼             │
   [Batch Ops]   (reconnect later)
        │
        ▼
┌────────────────────────────────────┐
│   HTTP POST /api/sync              │
│   - SyncPayload with ops[]         │
│   - Includes clientId, seq#        │
└────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────┐
│   Server Processing                │
│   - Deduplication                  │
│   - State merging                  │
│   - Conflict resolution            │
│   - Audit logging                  │
└────────────────────────────────────┘
        │
        ├─→ [Fire n8n webhook]
        │   (if session completed)
        │
        ▼
┌────────────────────────────────────┐
│   SyncResponse                     │
│   - reconciled.syllabus            │
│   - reconciled.sessions            │
│   - serverSequence                 │
│   - webhookFired?                  │
└────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────┐
│   Client Updates                   │
│   - localStorage updated           │
│   - Pending ops cleared            │
│   - UI reflects server state       │
│   - Webhook log updated            │
└────────────────────────────────────┘
```

---

See [README.md](./README.md), [DECISIONS.md](./DECISIONS.md), and [SETUP.md](./SETUP.md) for more details.
