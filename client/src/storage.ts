import {
  Operation,
  Syllabus,
  FocusSession,
  StudentStats,
  initializeSyllabus,
  initializeStudentStats,
} from '@alvico/shared';

export class ClientStorage {
  private clientId: string;
  private forceOffline = false;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  private getKey(key: string): string {
    return `alvico_${this.clientId}_${key}`;
  }

  setForceOffline(value: boolean): void {
    this.forceOffline = value;
    localStorage.setItem(this.getKey('force_offline'), value ? '1' : '0');
  }

  isForceOffline(): boolean {
    const stored = localStorage.getItem(this.getKey('force_offline'));
    if (stored !== null) {
      this.forceOffline = stored === '1';
    }
    return this.forceOffline;
  }

  setSyllabus(syllabus: Syllabus): void {
    localStorage.setItem(this.getKey('syllabus'), JSON.stringify(syllabus));
  }

  getSyllabus(): Syllabus {
    const data = localStorage.getItem(this.getKey('syllabus'));
    return data ? JSON.parse(data) : initializeSyllabus();
  }

  setStudentStats(stats: StudentStats): void {
    localStorage.setItem(this.getKey('student_stats'), JSON.stringify(stats));
  }

  getStudentStats(): StudentStats {
    const data = localStorage.getItem(this.getKey('student_stats'));
    return data ? JSON.parse(data) : initializeStudentStats();
  }

  setPendingOperations(operations: Operation[]): void {
    localStorage.setItem(this.getKey('pending_ops'), JSON.stringify(operations));
  }

  getPendingOperations(): Operation[] {
    const data = localStorage.getItem(this.getKey('pending_ops'));
    return data ? JSON.parse(data) : [];
  }

  addPendingOperation(operation: Operation): void {
    const ops = this.getPendingOperations();
    ops.push(operation);
    this.setPendingOperations(ops);
  }

  clearPendingOperations(): void {
    localStorage.removeItem(this.getKey('pending_ops'));
  }

  setPendingSessions(sessions: FocusSession[]): void {
    localStorage.setItem(this.getKey('pending_sessions'), JSON.stringify(sessions));
  }

  getPendingSessions(): FocusSession[] {
    const data = localStorage.getItem(this.getKey('pending_sessions'));
    return data ? JSON.parse(data) : [];
  }

  addPendingSession(session: FocusSession): void {
    const sessions = this.getPendingSessions();
    sessions.push(session);
    this.setPendingSessions(sessions);
  }

  clearPendingSessions(): void {
    localStorage.removeItem(this.getKey('pending_sessions'));
  }

  setLastSyncSequence(sequence: number): void {
    localStorage.setItem(this.getKey('last_sync_seq'), String(sequence));
  }

  getLastSyncSequence(): number {
    const data = localStorage.getItem(this.getKey('last_sync_seq'));
    return data ? parseInt(data, 10) : 0;
  }

  setLocalSequence(sequence: number): void {
    localStorage.setItem(this.getKey('local_seq'), String(sequence));
  }

  getLocalSequence(): number {
    const data = localStorage.getItem(this.getKey('local_seq'));
    return data ? parseInt(data, 10) : 0;
  }

  setWebhookLogs(logs: Array<{ sessionId: string; message: string; timestamp: number }>): void {
    localStorage.setItem(this.getKey('webhook_logs'), JSON.stringify(logs));
  }

  getWebhookLogs(): Array<{ sessionId: string; message: string; timestamp: number }> {
    const data = localStorage.getItem(this.getKey('webhook_logs'));
    return data ? JSON.parse(data) : [];
  }

  addWebhookLog(sessionId: string, message: string): void {
    const logs = this.getWebhookLogs();
    if (logs.some((l) => l.sessionId === sessionId)) return;
    logs.push({ sessionId, message, timestamp: Date.now() });
    if (logs.length > 20) logs.shift();
    this.setWebhookLogs(logs);
  }

  clear(): void {
    const prefix = `alvico_${this.clientId}_`;
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => localStorage.removeItem(k));
  }
}

export function getClientIdFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('client') || 'A';
}

export const clientId = getClientIdFromUrl();
export const storage = new ClientStorage(clientId);
