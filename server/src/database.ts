import {
  Operation,
  Syllabus,
  FocusSession,
  StudentStats,
  TaskOperationMeta,
  initializeSyllabus,
  initializeStudentStats,
} from '@alvico/shared';

interface GlobalState {
  syllabus: Syllabus;
  focusSessions: FocusSession[];
  studentStats: StudentStats;
  lastSyncSequence: number;
}

export class Database {
  private processedSessions = new Set<string>();
  private processedOperations = new Set<string>();
  private notifiedSessions = new Set<string>();
  private taskMeta = new Map<string, TaskOperationMeta>();
  private operationLog = new Map<string, Operation>();
  private globalState: GlobalState = {
    syllabus: initializeSyllabus(),
    focusSessions: [],
    studentStats: initializeStudentStats(),
    lastSyncSequence: 0,
  };

  isOperationProcessed(operationId: string): boolean {
    return this.processedOperations.has(operationId);
  }

  markOperationProcessed(operationId: string): void {
    this.processedOperations.add(operationId);
  }

  isSessionProcessed(sessionId: string): boolean {
    return this.processedSessions.has(sessionId);
  }

  markSessionProcessed(sessionId: string): void {
    this.processedSessions.add(sessionId);
  }

  isSessionNotified(sessionId: string): boolean {
    return this.notifiedSessions.has(sessionId);
  }

  markSessionNotified(sessionId: string): void {
    this.notifiedSessions.add(sessionId);
  }

  recordOperation(operation: Operation): void {
    this.operationLog.set(operation.operationId, operation);
  }

  getGlobalState(): GlobalState {
    return this.globalState;
  }

  getTaskMeta(): Map<string, TaskOperationMeta> {
    return this.taskMeta;
  }

  updateGlobalState(
    syllabus: Syllabus,
    focusSessions: FocusSession[],
    studentStats: StudentStats
  ): void {
    this.globalState.syllabus = syllabus;
    this.globalState.focusSessions = focusSessions;
    this.globalState.studentStats = studentStats;
  }

  incrementGlobalSequence(): number {
    this.globalState.lastSyncSequence++;
    return this.globalState.lastSyncSequence;
  }

  getAuditTrail(): Operation[] {
    return Array.from(this.operationLog.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }
}

export const db = new Database();
