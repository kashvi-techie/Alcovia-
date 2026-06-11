import { v4 as uuidv4 } from 'uuid';
import {
  Operation,
  Syllabus,
  Task,
  Chapter,
  Subject,
  ConflictResolution,
  TaskOperationMeta,
  TaskStatus,
  StudentStats,
} from './types';

export class LogicalClock {
  private sequence = 0;

  increment(): number {
    return ++this.sequence;
  }

  set(value: number): void {
    if (value > this.sequence) {
      this.sequence = value;
    }
  }

  get(): number {
    return this.sequence;
  }
}

export class OperationLog {
  private operations = new Map<string, Operation>();
  private sequenceMap = new Map<number, string>();

  addOperation(
    type: Operation['type'],
    clientId: string,
    data: Record<string, unknown>,
    sequence: number
  ): Operation {
    const operation: Operation = {
      operationId: uuidv4(),
      sequenceNumber: sequence,
      timestamp: Date.now(),
      type,
      clientId,
      data,
    };

    this.operations.set(operation.operationId, operation);
    this.sequenceMap.set(sequence, operation.operationId);
    return operation;
  }

  getAllOperations(): Operation[] {
    return Array.from(this.operations.values()).sort(
      (a, b) => a.sequenceNumber - b.sequenceNumber
    );
  }
}

const STATUS_RANK: Record<TaskStatus, number> = {
  completed: 3,
  'in-progress': 2,
  pending: 1,
};

/**
 * Cross-client conflict resolution:
 * 1. Deleted vs edit → deletion wins if same or higher sequence from deleting client
 * 2. Same client → higher sequence wins
 * 3. Different clients → higher status rank wins, then higher sequence, then clientId
 */
export function resolveTaskConflict(
  _taskId: string,
  clientAId: string,
  clientAStatus: string,
  clientASequence: number,
  clientBId: string,
  clientBStatus: string,
  clientBSequence: number
): { resolvedStatus: string; reason: string } {
  if (clientAStatus === 'deleted' || clientBStatus === 'deleted') {
    if (clientAStatus === 'deleted' && clientBStatus === 'deleted') {
      return {
        resolvedStatus: 'deleted',
        reason: 'Both deleted — keep deleted',
      };
    }
    if (clientAStatus === 'deleted') {
      const wins =
        clientASequence >= clientBSequence ||
        (clientASequence === clientBSequence && clientAId <= clientBId);
      return {
        resolvedStatus: wins ? 'deleted' : clientBStatus,
        reason: wins ? 'Deletion wins over edit' : 'Edit has higher sequence than delete',
      };
    }
    const wins =
      clientBSequence >= clientASequence ||
      (clientBSequence === clientASequence && clientBId <= clientAId);
    return {
      resolvedStatus: wins ? 'deleted' : clientAStatus,
      reason: wins ? 'Deletion wins over edit' : 'Edit has higher sequence than delete',
    };
  }

  const rankA = STATUS_RANK[clientAStatus as TaskStatus] ?? 0;
  const rankB = STATUS_RANK[clientBStatus as TaskStatus] ?? 0;

  let resolvedStatus = clientAStatus;
  let reason = '';

  if (clientAId === clientBId) {
    if (clientASequence >= clientBSequence) {
      resolvedStatus = clientAStatus;
      reason = `Same client (${clientAId}): seq ${clientASequence} >= ${clientBSequence}`;
    } else {
      resolvedStatus = clientBStatus;
      reason = `Same client (${clientBId}): seq ${clientBSequence} > ${clientASequence}`;
    }
  } else if (rankA > rankB) {
    resolvedStatus = clientAStatus;
    reason = `Status priority: ${clientAStatus} > ${clientBStatus}`;
  } else if (rankB > rankA) {
    resolvedStatus = clientBStatus;
    reason = `Status priority: ${clientBStatus} > ${clientAStatus}`;
  } else if (clientASequence > clientBSequence) {
    resolvedStatus = clientAStatus;
    reason = `Equal status; seq ${clientASequence} > ${clientBSequence}`;
  } else if (clientBSequence > clientASequence) {
    resolvedStatus = clientBStatus;
    reason = `Equal status; seq ${clientBSequence} > ${clientASequence}`;
  } else {
    resolvedStatus = clientAId < clientBId ? clientAStatus : clientBStatus;
    reason = `Tie-breaker: clientId ${clientAId < clientBId ? clientAId : clientBId}`;
  }

  return { resolvedStatus, reason };
}

export function recalculateSyllabusProgress(syllabus: Syllabus): Syllabus {
  for (const subject of syllabus.subjects) {
    for (const chapter of subject.chapters) {
      const activeTasks = chapter.tasks.filter((t) => !t.deleted);
      const completedTasks = activeTasks.filter((t) => t.status === 'completed').length;
      chapter.progressPercentage =
        activeTasks.length === 0 ? 0 : Math.round((completedTasks / activeTasks.length) * 100);
    }

    const chapterProgress =
      subject.chapters.reduce((sum, c) => sum + c.progressPercentage, 0) /
      Math.max(subject.chapters.length, 1);
    subject.progressPercentage = Math.round(chapterProgress);
  }

  return syllabus;
}

export function applyOperationToSyllabus(
  syllabus: Syllabus,
  operation: Operation,
  taskMeta: Map<string, TaskOperationMeta>,
  conflictsResolved: ConflictResolution[]
): Syllabus {
  if (operation.type === 'task_delete') {
    const { subjectId, chapterId, taskId } = operation.data as {
      subjectId: string;
      chapterId: string;
      taskId: string;
    };

    const task = findTask(syllabus, subjectId, chapterId, taskId);
    if (!task) return syllabus;

    const existing = taskMeta.get(taskId);
    if (existing) {
      const { resolvedStatus, reason } = resolveTaskConflict(
        taskId,
        existing.clientId,
        existing.deleted ? 'deleted' : existing.status,
        existing.sequenceNumber,
        operation.clientId,
        'deleted',
        operation.sequenceNumber
      );

      if (resolvedStatus !== 'deleted') {
        conflictsResolved.push({
          taskId,
          clientA: {
            clientId: existing.clientId,
            status: existing.deleted ? 'deleted' : existing.status,
            sequence: existing.sequenceNumber,
          },
          clientB: { clientId: operation.clientId, status: 'deleted', sequence: operation.sequenceNumber },
          resolvedStatus,
          reason: `Delete conflict: ${reason}`,
        });
        return syllabus;
      }
    }

    task.deleted = true;
    taskMeta.set(taskId, {
      status: task.status,
      clientId: operation.clientId,
      sequenceNumber: operation.sequenceNumber,
      operationId: operation.operationId,
      deleted: true,
    });

    return recalculateSyllabusProgress(syllabus);
  }

  if (operation.type !== 'task_status_change') {
    return syllabus;
  }

  const { subjectId, chapterId, taskId, status } = operation.data as {
    subjectId: string;
    chapterId: string;
    taskId: string;
    status: TaskStatus;
  };

  const task = findTask(syllabus, subjectId, chapterId, taskId);
  if (!task || task.deleted) return syllabus;

  const existing = taskMeta.get(taskId);
  if (existing && existing.operationId !== operation.operationId) {
    if (existing.deleted) {
      conflictsResolved.push({
        taskId,
        clientA: { clientId: existing.clientId, status: 'deleted', sequence: existing.sequenceNumber },
        clientB: { clientId: operation.clientId, status, sequence: operation.sequenceNumber },
        resolvedStatus: 'deleted',
        reason: 'Deletion wins over edit',
      });
      return syllabus;
    }

    const { resolvedStatus, reason } = resolveTaskConflict(
      taskId,
      existing.clientId,
      existing.status,
      existing.sequenceNumber,
      operation.clientId,
      status,
      operation.sequenceNumber
    );

    if (resolvedStatus !== status) {
      conflictsResolved.push({
        taskId,
        clientA: { clientId: existing.clientId, status: existing.status, sequence: existing.sequenceNumber },
        clientB: { clientId: operation.clientId, status, sequence: operation.sequenceNumber },
        resolvedStatus,
        reason,
      });
      return syllabus;
    }
  }

  task.status = status;
  if (status === 'completed') {
    task.completedAt = operation.timestamp;
  }

  taskMeta.set(taskId, {
    status,
    clientId: operation.clientId,
    sequenceNumber: operation.sequenceNumber,
    operationId: operation.operationId,
    deleted: false,
  });

  return recalculateSyllabusProgress(syllabus);
}

function findTask(
  syllabus: Syllabus,
  subjectId: string,
  chapterId: string,
  taskId: string
): Task | undefined {
  const subject = syllabus.subjects.find((s) => s.id === subjectId);
  const chapter = subject?.chapters.find((c) => c.id === chapterId);
  return chapter?.tasks.find((t) => t.id === taskId);
}

export function initializeSyllabus(): Syllabus {
  return recalculateSyllabusProgress({
    subjects: [
      {
        id: 'math',
        name: 'Mathematics',
        chapters: [
          {
            id: 'ch1',
            name: 'Algebra',
            progressPercentage: 0,
            tasks: [
              { id: 't1', title: 'Learn Equations', status: 'pending' },
              { id: 't2', title: 'Practice Problems', status: 'pending' },
              { id: 't3', title: 'Take Quiz', status: 'pending' },
            ],
          },
          {
            id: 'ch2',
            name: 'Geometry',
            progressPercentage: 0,
            tasks: [
              { id: 't4', title: 'Understand Shapes', status: 'pending' },
              { id: 't5', title: 'Calculate Areas', status: 'pending' },
            ],
          },
        ],
        progressPercentage: 0,
      },
      {
        id: 'science',
        name: 'Science',
        chapters: [
          {
            id: 'ch3',
            name: 'Physics',
            progressPercentage: 0,
            tasks: [
              { id: 't6', title: 'Motion Basics', status: 'pending' },
              { id: 't7', title: 'Forces & Friction', status: 'pending' },
            ],
          },
        ],
        progressPercentage: 0,
      },
    ],
  });
}

export function initializeStudentStats(): StudentStats {
  return {
    totalCoins: 0,
    focusStreak: 0,
    todayFocusMinutes: 0,
    lastFocusDate: '',
  };
}

export function todayDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
