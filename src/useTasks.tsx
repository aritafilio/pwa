// src/useTasks.tsx
import { useState, useEffect, useCallback } from 'react';
import type { Task } from './indexedDB';
import {
  getTasksFromDB,
  addTaskToDB,
  updateTaskSyncStatus,
  updateTaskInDB,
  removeTaskFromDB,
  queueOutbox,
} from './indexedDB';

export default function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const stored = await getTasksFromDB();
      setTasks(stored);
    } catch (err) {
      console.error('Fallo al cargar tareas:', err);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  /**
   * Registra Background Sync. Nota: algunos tipos de TS no incluyen
   * ServiceWorkerRegistration.sync, así que usamos cast a any.
   */
  const registerSync = useCallback(async () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await (reg as any).sync?.register('sync-entries'); // <- FIX de tipos
        console.log('Background Sync registrado para tareas pendientes.');
      } catch (e) {
        console.error('Fallo al registrar Background Sync:', e);
      }
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); registerSync(); };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [registerSync]);

  // Lee el estado de red en TIEMPO REAL (evita desfases del state)
  const isReallyOffline = () =>
    typeof navigator !== 'undefined' ? !navigator.onLine : isOffline;

  // ───────────────────────── Actions ─────────────────────────
  const addTask = async (text: string) => {
    const offlineNow = isReallyOffline();
    const tempId = Date.now();
    const newTask: Omit<Task, 'id'> = { text, completed: false, isSynced: !offlineNow };

    // Optimista en UI
    setTasks(prev => [...prev, { ...newTask, id: tempId }]);
    try {
      const saved = await addTaskToDB(newTask);
      setTasks(prev => prev.map(t => (t.id === tempId ? saved : t)));

      if (offlineNow) {
        await queueOutbox({ op: 'create', task: { ...saved, isSynced: false } });
        await registerSync();
        console.log('[addTask] queued create in outbox');
      }
    } catch (e) {
      console.error('No se pudo guardar la tarea en IndexedDB:', e);
      setTasks(prev => prev.filter(t => t.id !== tempId));
    }
  };

  const markTaskAsSynced = async (taskId: number) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, isSynced: true } : t)));
    const task = tasks.find(t => t.id === taskId);
    if (task) await updateTaskSyncStatus(task, true);
  };

  const toggleTaskCompleted = async (taskId: number) => {
    const current = tasks.find(t => t.id === taskId);
    if (!current) return;

    const offlineNow = isReallyOffline();
    const updated: Task = { ...current, completed: !current.completed, isSynced: !offlineNow };

    setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)));
    try {
      await updateTaskInDB(updated);
      if (offlineNow) {
        await queueOutbox({ op: 'update', task: { ...updated, isSynced: false } });
        await registerSync();
        console.log('[toggle] queued update in outbox');
      }
    } catch (e) {
      console.error('No se pudo actualizar la tarea en DB:', e);
      setTasks(prev => prev.map(t => (t.id === taskId ? current : t)));
    }
  };

  const editTaskText = async (taskId: number, newText: string) => {
    const current = tasks.find(t => t.id === taskId);
    if (!current) return;

    const offlineNow = isReallyOffline();
    const updated: Task = { ...current, text: newText, isSynced: !offlineNow };

    setTasks(prev => prev.map(t => (t.id === taskId ? updated : t)));
    try {
      await updateTaskInDB(updated);
      if (offlineNow) {
        await queueOutbox({ op: 'update', task: { ...updated, isSynced: false } });
        await registerSync();
        console.log('[edit] queued update in outbox');
      }
    } catch (e) {
      console.error('No se pudo editar la tarea en DB:', e);
      setTasks(prev => prev.map(t => (t.id === taskId ? current : t)));
    }
  };

  const deleteTask = async (taskId: number) => {
    const prev = tasks;
    const offlineNow = isReallyOffline();

    // Optimista en UI
    setTasks(curr => curr.filter(t => t.id !== taskId));
    try {
      await removeTaskFromDB(taskId);
      if (offlineNow) {
        await queueOutbox({ op: 'delete', taskId });
        await registerSync();
        console.log('[delete] queued delete in outbox');
      } else {
        // Online: aquí podrías hacer fetch DELETE directo al backend si quieres.
      }
    } catch (e) {
      console.error('No se pudo eliminar la tarea de DB:', e);
      setTasks(prev); // revertir
    }
  };

  return {
    tasks,
    isLoading,
    isOffline,
    addTask,
    markTaskAsSynced,
    toggleTaskCompleted,
    editTaskText,
    deleteTask,
    loadTasks,
  };
}
