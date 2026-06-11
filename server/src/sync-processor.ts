import {
  SyncPayload,
  SyncResponse,
  Syllabus,
  FocusSession,
  StudentStats,
  ConflictResolution,
  applyOperationToSyllabus,
  todayDateString,
  COINS_PER_SESSION,
} from '@alvico/shared';
import { db } from './database';
import { webhookService } from './webhook-service';

function applySuccessfulSessionRewards(
  stats: StudentStats,
  session: FocusSession
): StudentStats {
  const today = todayDateString();
  const next: StudentStats = { ...stats };

  if (next.lastFocusDate === today) {
    // same day - streak unchanged
  } else if (next.lastFocusDate === '') {
    next.focusStreak = 1;
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    next.focusStreak =
      next.lastFocusDate === todayDateString(yesterday) ? next.focusStreak + 1 : 1;
  }

  next.lastFocusDate = today;
  next.totalCoins += COINS_PER_SESSION;
  next.todayFocusMinutes += session.targetDurationMinutes;

  return next;
}

export async function processSync(payload: SyncPayload): Promise<SyncResponse> {
  const globalState = db.getGlobalState();
  let syllabus: Syllabus = JSON.parse(JSON.stringify(globalState.syllabus));
  let focusSessions = [...globalState.focusSessions];
  let studentStats: StudentStats = { ...globalState.studentStats };
  const taskMeta = db.getTaskMeta();
  const conflictsResolved: ConflictResolution[] = [];

  let webhookFired: SyncResponse['webhookFired'];

  const sortedOps = [...payload.operations].sort((a, b) => {
    if (a.sequenceNumber !== b.sequenceNumber) {
      return a.sequenceNumber - b.sequenceNumber;
    }
    return a.clientId.localeCompare(b.clientId);
  });

  for (const operation of sortedOps) {
    if (db.isOperationProcessed(operation.operationId)) {
      continue;
    }

    db.recordOperation(operation);
    db.markOperationProcessed(operation.operationId);

    if (operation.type === 'task_status_change' || operation.type === 'task_delete') {
      syllabus = applyOperationToSyllabus(syllabus, operation, taskMeta, conflictsResolved);
    } else if (operation.type === 'focus_session') {
      const session = operation.data as unknown as FocusSession;

      if (db.isSessionProcessed(session.sessionId)) {
        continue;
      }

      db.markSessionProcessed(session.sessionId);
      focusSessions.push(session);

      if (session.status === 'completed') {
        studentStats = applySuccessfulSessionRewards(studentStats, session);

        if (!db.isSessionNotified(session.sessionId)) {
          const webhookPayload = {
            studentId: payload.studentId,
            streak: studentStats.focusStreak,
            coinsEarned: COINS_PER_SESSION,
            sessionId: session.sessionId,
            timestamp: Date.now(),
            message: `Streak now ${studentStats.focusStreak} days, +${COINS_PER_SESSION} coins.`,
          };

          const webhookSuccess = await webhookService.fireWebhook(webhookPayload);
          if (webhookSuccess) {
            db.markSessionNotified(session.sessionId);
            webhookFired = {
              sessionId: session.sessionId,
              coinsEarned: COINS_PER_SESSION,
              streak: studentStats.focusStreak,
              message: webhookPayload.message,
              timestamp: Date.now(),
            };
          }
        }
      }
    }
  }

  const serverSequence = db.incrementGlobalSequence();
  db.updateGlobalState(syllabus, focusSessions, studentStats);

  return {
    success: true,
    reconciled: {
      syllabus,
      focusSessions,
      studentStats,
    },
    serverSequence,
    conflictsResolved,
    webhookFired,
  };
}

export function getServerState() {
  const state = db.getGlobalState();
  return {
    syllabus: state.syllabus,
    focusSessions: state.focusSessions,
    studentStats: state.studentStats,
    sequence: state.lastSyncSequence,
  };
}

export function getAuditTrail() {
  return db.getAuditTrail();
}

export function getWebhookLog() {
  return webhookService.getWebhookLog();
}

export function getNotificationLog() {
  return webhookService.getNotificationLog();
}
