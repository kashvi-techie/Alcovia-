import { v4 as uuidv4 } from 'uuid';
import {
  Operation,
  FocusSession,
  FocusFailReason,
  LogicalClock,
  COINS_PER_SESSION,
} from '@alvico/shared';
import { storage } from './storage';

export class ClientSyncEngine {
  private clock: LogicalClock;
  private pendingOperations: Operation[] = [];
  private networkOnline = navigator.onLine;

  constructor() {
    this.clock = new LogicalClock();
    this.clock.set(storage.getLocalSequence());
    this.pendingOperations = storage.getPendingOperations();

    window.addEventListener('online', () => {
      this.networkOnline = true;
    });
    window.addEventListener('offline', () => {
      this.networkOnline = false;
    });
  }

  getIsOnline(): boolean {
    return this.networkOnline && !storage.isForceOffline();
  }

  private persistSequence(sequence: number): void {
    storage.setLocalSequence(sequence);
  }

  recordTaskChange(
    subjectId: string,
    chapterId: string,
    taskId: string,
    status: string,
    clientId: string
  ): Operation {
    const sequence = this.clock.increment();
    const operation: Operation = {
      operationId: uuidv4(),
      sequenceNumber: sequence,
      timestamp: Date.now(),
      type: 'task_status_change',
      clientId,
      data: { subjectId, chapterId, taskId, status },
    };

    this.pendingOperations.push(operation);
    storage.addPendingOperation(operation);
    this.persistSequence(sequence);
    return operation;
  }

  recordTaskDelete(
    subjectId: string,
    chapterId: string,
    taskId: string,
    clientId: string
  ): Operation {
    const sequence = this.clock.increment();
    const operation: Operation = {
      operationId: uuidv4(),
      sequenceNumber: sequence,
      timestamp: Date.now(),
      type: 'task_delete',
      clientId,
      data: { subjectId, chapterId, taskId },
    };

    this.pendingOperations.push(operation);
    storage.addPendingOperation(operation);
    this.persistSequence(sequence);
    return operation;
  }

  recordFocusSession(
    sessionId: string,
    targetDurationMinutes: number,
    actualDurationMs: number,
    status: 'completed' | 'abandoned',
    failReason: FocusFailReason | undefined,
    startedAt: number,
    clientId: string
  ): { session: FocusSession; operation: Operation } {
    const sequence = this.clock.increment();

    const session: FocusSession = {
      sessionId,
      targetDurationMinutes,
      actualDurationMs,
      status,
      failReason,
      startedAt,
      endedAt: Date.now(),
    };

    const operation: Operation = {
      operationId: uuidv4(),
      sequenceNumber: sequence,
      timestamp: Date.now(),
      type: 'focus_session',
      clientId,
      data: session as unknown as Record<string, unknown>,
    };

    this.pendingOperations.push(operation);
    storage.addPendingOperation(operation);
    storage.addPendingSession(session);
    this.persistSequence(sequence);

    if (status === 'completed') {
      const stats = storage.getStudentStats();
      storage.setStudentStats({
        ...stats,
        totalCoins: stats.totalCoins + COINS_PER_SESSION,
        todayFocusMinutes: stats.todayFocusMinutes + targetDurationMinutes,
      });
    }

    return { session, operation };
  }

  getPendingOperations(): Operation[] {
    return [...this.pendingOperations];
  }

  getCurrentSequence(): number {
    return this.clock.get();
  }

  clearPendingOperations(): void {
    this.pendingOperations = [];
    storage.clearPendingOperations();
    storage.clearPendingSessions();
  }

  reloadPendingOperations(): void {
    this.pendingOperations = storage.getPendingOperations();
  }
}

export const syncEngine = new ClientSyncEngine();
