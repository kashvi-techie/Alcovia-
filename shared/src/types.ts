export const STUDENT_ID = 'kashvi_pundir';

export const COINS_PER_SESSION = 50;
export const BACKGROUND_GRACE_MS = 5000;
export const FOCUS_DURATION_OPTIONS = [25, 45, 60, 90, 120] as const;

export type TaskStatus = 'pending' | 'in-progress' | 'completed';
export type FocusFailReason = 'give_up' | 'app_switch';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  completedAt?: number;
  deleted?: boolean;
}

export interface Chapter {
  id: string;
  name: string;
  tasks: Task[];
  progressPercentage: number;
}

export interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
  progressPercentage: number;
}

export interface Syllabus {
  subjects: Subject[];
}

export interface FocusSession {
  sessionId: string;
  targetDurationMinutes: number;
  actualDurationMs: number;
  status: 'completed' | 'abandoned';
  failReason?: FocusFailReason;
  startedAt: number;
  endedAt: number;
}

export interface StudentStats {
  totalCoins: number;
  focusStreak: number;
  todayFocusMinutes: number;
  lastFocusDate: string;
}

export interface Operation {
  operationId: string;
  sequenceNumber: number;
  timestamp: number;
  type: 'task_status_change' | 'task_delete' | 'focus_session';
  clientId: string;
  data: Record<string, unknown>;
}

export interface SyncPayload {
  clientId: string;
  studentId: string;
  operations: Operation[];
  lastSyncSequence: number;
}

export interface SyncResponse {
  success: boolean;
  reconciled: {
    syllabus: Syllabus;
    focusSessions: FocusSession[];
    studentStats: StudentStats;
  };
  serverSequence: number;
  conflictsResolved: ConflictResolution[];
  webhookFired?: {
    sessionId: string;
    coinsEarned: number;
    streak: number;
    message: string;
    timestamp: number;
  };
}

export interface ConflictResolution {
  taskId: string;
  clientA: {
    clientId: string;
    status: string;
    sequence: number;
  };
  clientB: {
    clientId: string;
    status: string;
    sequence: number;
  };
  resolvedStatus: string;
  reason: string;
}

export interface TaskOperationMeta {
  status: TaskStatus;
  clientId: string;
  sequenceNumber: number;
  operationId: string;
  deleted: boolean;
}
