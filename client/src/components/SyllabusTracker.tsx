import React, { useState, useEffect } from 'react';
import { Syllabus, Task, Chapter, Subject, recalculateSyllabusProgress } from '@alvico/shared';
import { syncEngine } from '../sync-engine-client';
import { storage, clientId } from '../storage';

const styles = {
  container: { padding: '16px', backgroundColor: '#e8f5e9', borderRadius: '8px', margin: '12px 0' },
  title: { fontSize: '16px', fontWeight: 'bold' as const, marginBottom: '12px', color: '#1b5e20' },
  task: {
    marginLeft: '16px',
    padding: '6px 8px',
    backgroundColor: 'white',
    borderRadius: '3px',
    marginBottom: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    border: '1px solid #ddd',
    gap: '8px',
  },
};

export const SyllabusTracker: React.FC = () => {
  const [syllabus, setSyllabus] = useState<Syllabus>(storage.getSyllabus());

  useEffect(() => {
    const interval = setInterval(() => setSyllabus(storage.getSyllabus()), 500);
    return () => clearInterval(interval);
  }, []);

  const updateTaskStatus = (
    subjectId: string,
    chapterId: string,
    taskId: string,
    newStatus: string
  ) => {
    syncEngine.recordTaskChange(subjectId, chapterId, taskId, newStatus, clientId);

    const updated = recalculateSyllabusProgress(JSON.parse(JSON.stringify(syllabus)));
    const subject = updated.subjects.find((s: Subject) => s.id === subjectId);
    const chapter = subject?.chapters.find((c: Chapter) => c.id === chapterId);
    const task = chapter?.tasks.find((t: Task) => t.id === taskId);
    if (task) {
      task.status = newStatus as Task['status'];
      if (newStatus === 'completed') task.completedAt = Date.now();
    }

    storage.setSyllabus(updated);
    setSyllabus(updated);
  };

  const deleteTask = (subjectId: string, chapterId: string, taskId: string) => {
    syncEngine.recordTaskDelete(subjectId, chapterId, taskId, clientId);

    const updated = JSON.parse(JSON.stringify(syllabus)) as Syllabus;
    const task = updated.subjects
      .find((s) => s.id === subjectId)
      ?.chapters.find((c) => c.id === chapterId)
      ?.tasks.find((t) => t.id === taskId);
    if (task) task.deleted = true;

    const recalculated = recalculateSyllabusProgress(updated);
    storage.setSyllabus(recalculated);
    setSyllabus(recalculated);
  };

  const cycleStatus = (task: Task) => {
    if (task.status === 'pending') return 'in-progress';
    if (task.status === 'in-progress') return 'completed';
    return 'pending';
  };

  return (
    <div style={styles.container}>
      <div style={styles.title}>📚 Syllabus Progress</div>

      {syllabus.subjects.map((subject) => (
        <div key={subject.id} style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
            {subject.name} — {subject.progressPercentage}%
          </div>

          {subject.chapters.map((chapter) => (
            <div key={chapter.id} style={{ marginLeft: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                {chapter.name} ({chapter.progressPercentage}%)
              </div>

              {chapter.tasks
                .filter((t) => !t.deleted)
                .map((task) => (
                  <div key={task.id} style={styles.task}>
                    <span
                      style={{ flex: 1, cursor: 'pointer' }}
                      onClick={() =>
                        updateTaskStatus(
                          subject.id,
                          chapter.id,
                          task.id,
                          cycleStatus(task)
                        )
                      }
                    >
                      {task.title} — {task.status}
                    </span>
                    <button
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        cursor: 'pointer',
                      }}
                      onClick={() => deleteTask(subject.id, chapter.id, task.id)}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
