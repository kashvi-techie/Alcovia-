# DECISIONS.md — Sync Model & Conflict Resolution

## Data model

Each client maintains:

- **Local syllabus** (optimistic UI)
- **Pending operations queue** (`operationId`, `clientId`, `sequenceNumber`, `type`, `data`)
- **Student stats** (coins, streak, today's focus minutes) — overwritten by server on sync

The server holds the **authoritative global state**: syllabus, focus sessions, student stats, processed `operationId`s, processed `sessionId`s, and per-task metadata for merge.

Operations are the unit of sync — not full state snapshots. Clients push ops; server merges and returns reconciled state.

## Logical clocks (not wall-clock)

Each client increments a **local sequence number** per edit. These numbers are only strictly ordered *within* one client. Cross-client ordering uses domain rules below, not `Date.now()`.

## Conflict resolution

### Task status (phone Done vs laptop In progress)

For the same `taskId`, the server keeps the latest winning metadata in `taskMeta`. A new operation is applied only if it wins:

1. **Status priority:** `completed` > `in-progress` > `pending`
2. **Then higher `sequenceNumber`** (same client's causal order)
3. **Then `clientId` lexicographic** tie-break (deterministic)

### Task deleted on one device, edited on another

`task_delete` operations participate in the same resolver. Deletion wins when its sequence is ≥ the competing edit, or on tie with lexicographic `clientId`. If deletion wins, later edits to that task are ignored.

### Duplicate / out-of-order sync messages

- **`operationId`:** server skips already-processed ops (safe retries)
- **`sessionId`:** focus rewards and webhooks fire once per session
- Ops are sorted by `(sequenceNumber, clientId)` before apply for deterministic ordering

## Why two devices converge

Both clients eventually sync to the same Express state. The server applies the same ordered merge rules regardless of arrival order. After sync, each client replaces local syllabus + `studentStats` with `reconciled` from the response. Same inputs → same merged state on both tabs.

## Idempotency

| Layer | Mechanism |
|-------|-----------|
| Client | UUID `operationId` per op; durable `localStorage` queue |
| Server | `processedOperations` + `processedSessions` sets; server computes coins/streak |
| n8n | `Remove Duplicates` node on `sessionId` |
| Mock sink | Server also dedupes notifications in `notificationLog` by session |

Webhook path: Express → n8n webhook → mock `POST /api/mock-notify`. If n8n is down, Express logs directly to the mock sink so dev/demo still works.

## Focus sessions

- Target duration: 25–120 minutes (selectable)
- Success: timer reaches zero, or manual complete early
- Fail: **Give up** (`give_up`) or background > 5s (`app_switch`)
- Rewards (+50 coins, streak, today's minutes) applied **only on server** for `status: completed`

## Tradeoff

We use **server-authoritative merge** instead of peer-to-peer CRDTs. This is simpler and easy to audit, but clients do not receive live updates until they sync — there is no push/WebSocket. For a study app with intermittent connectivity, that is acceptable; next step would be polling or SSE after sync.

## Where it could still break

- Server in-memory state resets on restart (acceptable for take-home; SQLite next)
- Clock skew on streak "yesterday" uses server UTC date only
- Very large offline queues are not paginated
