// src/indexedDB.ts
export interface Task {
    id?: number;
    text: string;
    completed: boolean;
    isSynced: boolean;
  }
  
  type OutboxOp = 'create' | 'update' | 'delete';
  export interface OutboxItem {
    id?: number;
    op: OutboxOp;
    task?: Task;
    taskId?: number;
  }
  
  const DB_NAME = 'PwaTasksDB';
  const TASKS_STORE = 'tasks';
  const OUTBOX_STORE = 'outbox';
  const DB_VERSION = 3; // ⬅️ Forzamos migración para asegurar 'outbox'
  
  let db: IDBDatabase | null = null;
  
  export const openDB = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB no está disponible.'));
      }
      if (db) return resolve(db);
  
      const request = indexedDB.open(DB_NAME, DB_VERSION);
  
      request.onupgradeneeded = (event) => {
        const dbInstance = (event.target as IDBOpenDBRequest).result;
        if (!dbInstance.objectStoreNames.contains(TASKS_STORE)) {
          dbInstance.createObjectStore(TASKS_STORE, { keyPath: 'id', autoIncrement: true });
        }
        if (!dbInstance.objectStoreNames.contains(OUTBOX_STORE)) {
          dbInstance.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
  
      request.onsuccess = (event) => {
        db = (event.target as IDBOpenDBRequest).result;
        db.onversionchange = () => {
          try { db?.close(); } catch {}
          db = null;
        };
        resolve(db);
      };
  
      request.onerror = (event) => {
        console.error('Error al abrir IndexedDB:', (event.target as IDBOpenDBRequest).error);
        reject(new Error('Error al abrir la base de datos.'));
      };
    });
  
  /* ===== TAREAS ===== */
  export const getTasksFromDB = async (): Promise<Task[]> => {
    const database = await openDB();
    const tx = database.transaction(TASKS_STORE, 'readonly');
    const store = tx.objectStore(TASKS_STORE);
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as Task[]) ?? []);
      req.onerror = () => resolve([]);
    });
  };
  
  export const addTaskToDB = async (task: Omit<Task, 'id'>): Promise<Task> => {
    const database = await openDB();
    const tx = database.transaction(TASKS_STORE, 'readwrite');
    const store = tx.objectStore(TASKS_STORE);
  
    const newTask: Omit<Task, 'id'> = {
      ...task,
      isSynced: typeof task.isSynced === 'boolean' ? task.isSynced : false,
    };
  
    return new Promise((resolve, reject) => {
      const req = store.add(newTask);
      req.onsuccess = (e) => {
        const key = (e.target as IDBRequest<IDBValidKey>).result as number;
        resolve({ ...newTask, id: key });
      };
      req.onerror = (e) => {
        console.error('Error al agregar tarea:', (e as any).target?.error);
        reject(new Error('Error al guardar la tarea en DB.'));
      };
    });
  };
  
  export const updateTaskInDB = async (task: Task): Promise<void> => {
    if (typeof task.id !== 'number') return;
    const database = await openDB();
    const tx = database.transaction(TASKS_STORE, 'readwrite');
    const store = tx.objectStore(TASKS_STORE);
    return new Promise((resolve) => {
      const req = store.put(task);
      req.onsuccess = () => resolve();
      req.onerror = (e) => { console.error('Error al actualizar tarea:', e); resolve(); };
    });
  };
  
  export const updateTaskSyncStatus = async (task: Task, isSynced: boolean): Promise<void> => {
    if (typeof task.id !== 'number') return;
    await updateTaskInDB({ ...task, isSynced });
  };
  
  export const removeTaskFromDB = async (id: number): Promise<void> => {
    const database = await openDB();
    const tx = database.transaction(TASKS_STORE, 'readwrite');
    const store = tx.objectStore(TASKS_STORE);
    return new Promise((resolve) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => { console.error('Error al eliminar tarea:', e); resolve(); };
    });
  };
  
  export const getTasksToSync = async (): Promise<Task[]> => {
    const tasks = await getTasksFromDB();
    return tasks.filter((t) => !t.isSynced);
  };
  
  /* ===== OUTBOX ===== */
  export const queueOutbox = async (item: Omit<OutboxItem, 'id'>): Promise<void> => {
    const database = await openDB();
    const tx = database.transaction(OUTBOX_STORE, 'readwrite');
    const store = tx.objectStore(OUTBOX_STORE);
    return new Promise((resolve) => {
      const req = store.add(item);
      req.onsuccess = () => resolve();
      req.onerror = (e) => { console.error('Error encolando outbox:', e); resolve(); };
    });
  };
  
  /* ===== Helpers de depuración (opcionales) ===== */
  export const getOutboxAll = async (): Promise<OutboxItem[]> => {
    const database = await openDB();
    const tx = database.transaction(OUTBOX_STORE, 'readonly');
    const store = tx.objectStore(OUTBOX_STORE);
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as OutboxItem[]) ?? []);
      req.onerror = () => resolve([]);
    });
  };
  
  export const clearOutbox = async (): Promise<void> => {
    const database = await openDB();
    const tx = database.transaction(OUTBOX_STORE, 'readwrite');
    const store = tx.objectStore(OUTBOX_STORE);
    return new Promise((resolve) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  };
  