

// IndexedDB Wrapper - High Performance Storage for Large Images & Data
// Removed LocalStorage dependency for heavy items to prevent QuotaExceededError and freezing.

import { QuestionFolder, NoteFolder, HistoryEntry, SavedSnippet, MatchedQuestion, FullArchive, Task } from '../types';

const DB_NAME = 'ExamMatcher_Ultimate_DB'; 
const DB_VERSION = 6; // Incremented for TASKS store

const STORES = {
  FOLDERS: 'folders',
  HISTORY: 'history',
  NOTES: 'notes',
  TASKS: 'tasks' // New Store
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.error("IndexedDB not supported by this browser.");
      reject("IndexedDB not supported");
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.FOLDERS)) db.createObjectStore(STORES.FOLDERS);
      if (!db.objectStoreNames.contains(STORES.HISTORY)) db.createObjectStore(STORES.HISTORY);
      if (!db.objectStoreNames.contains(STORES.NOTES)) db.createObjectStore(STORES.NOTES);
      if (!db.objectStoreNames.contains(STORES.TASKS)) db.createObjectStore(STORES.TASKS);
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    
    request.onerror = (event) => {
      console.error("IndexedDB Open Error:", (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

const getData = async (storeName: string, key: string = 'main') => {
  try {
    const db = await openDB();
    return await new Promise<any>((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn(`[Storage] Failed to read ${storeName}`, e);
    return null;
  }
};

const saveData = async (storeName: string, data: any, key: string = 'main') => {
  if (data === undefined || data === null) return; // Prevent overwriting with null

  try {
    const db = await openDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data, key);
    
    return new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error(`[Storage] Failed to save ${storeName}`, e);
    throw e; // Propagate error to let UI know
  }
};

// --- SMART IMPORT LOGIC ---

// Helper to check if a string is a valid ISO date
const isISODate = (value: string) => {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
};

// Recursive date fixer: finding date strings and converting them to Date objects
const reviveDates = (data: any): any => {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    if (isISODate(data)) return new Date(data);
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(reviveDates);
  }
  if (typeof data === 'object') {
    const result: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = reviveDates(data[key]);
      }
    }
    return result;
  }
  return data;
};

// Default Folders Structure
const DEFAULT_FOLDERS: QuestionFolder[] = [
  { id: 'f_q', name: 'أسئلة فردية مختارة', type: 'questions', subFolders: [], questions: [], snippets: [], archives: [], createdAt: new Date() }, 
  { id: 'f_z', name: 'اختبارات المحاضرات', type: 'quiz_sets', subFolders: [], questions: [], snippets: [], archives: [], createdAt: new Date() }, 
  { id: 'f_s', name: 'مقتطفات ومعلومات', type: 'snippets', subFolders: [], questions: [], snippets: [], archives: [], createdAt: new Date() }, 
  { id: 'f_m', name: 'الأرشيف الذهبي (ملخصات)', type: 'summaries', subFolders: [], questions: [], snippets: [], archives: [], createdAt: new Date() }
];

export const storageService = {
  getFolders: () => getData(STORES.FOLDERS),
  saveFolders: (folders: any) => saveData(STORES.FOLDERS, folders),
  
  getNotes: () => getData(STORES.NOTES),
  saveNotes: (notes: any) => saveData(STORES.NOTES, notes),

  getHistory: () => getData(STORES.HISTORY),
  saveHistory: (history: any) => saveData(STORES.HISTORY, history),

  getTasks: () => getData(STORES.TASKS),
  saveTasks: (tasks: any) => saveData(STORES.TASKS, tasks),

  /**
   * Smart Analysis & Repair for Imported Data
   * Reads raw JSON string, detects structure, fixes dates, ensures integrity.
   */
  smartParseAndValidate: (jsonString: string) => {
    try {
      // 1. Basic Parse
      let rawData = JSON.parse(jsonString);

      // 2. Structure Normalization (Handle Legacy formats)
      let normalizedData: { folders: QuestionFolder[], history: HistoryEntry[], notes: NoteFolder[], tasks: Task[] } = {
        folders: [],
        history: [],
        notes: [],
        tasks: []
      };

      // Scenario A: It's the full export object
      if (rawData.folders || rawData.history || rawData.notes || rawData.tasks) {
        normalizedData.folders = Array.isArray(rawData.folders) ? rawData.folders : [];
        normalizedData.history = Array.isArray(rawData.history) ? rawData.history : [];
        normalizedData.notes = Array.isArray(rawData.notes) ? rawData.notes : [];
        normalizedData.tasks = Array.isArray(rawData.tasks) ? rawData.tasks : [];
      } 
      // Scenario B: It's just an array of folders (Legacy)
      else if (Array.isArray(rawData)) {
        // Simple heuristic: does the first item look like a folder?
        if (rawData.length > 0 && (rawData[0].subFolders || rawData[0].questions)) {
             normalizedData.folders = rawData;
        } else {
             // Unknown array, maybe history? safer to ignore or treat as empty
             console.warn("Unknown array format in import");
        }
      }

      // 3. Recursive Repair (Fix Dates & Types)
      normalizedData = reviveDates(normalizedData);

      // 4. Integrity Check: Ensure Root Folders Exist
      const requiredIds = ['f_q', 'f_z', 'f_s', 'f_m'];
      const defaultMap = new Map(DEFAULT_FOLDERS.map(f => [f.id, f]));
      
      // If we have folders, merge them with defaults. If completely empty, use defaults.
      if (normalizedData.folders.length === 0) {
        normalizedData.folders = JSON.parse(JSON.stringify(DEFAULT_FOLDERS)); // Deep copy defaults
        // Re-revive dates for defaults because JSON stringify kills them
        normalizedData.folders.forEach(f => f.createdAt = new Date());
      } else {
        // Ensure all 4 root folders exist
        requiredIds.forEach(reqId => {
           if (!normalizedData.folders.find(f => f.id === reqId)) {
               const missingDefault = defaultMap.get(reqId);
               if (missingDefault) {
                   normalizedData.folders.push({
                       ...missingDefault,
                       createdAt: new Date()
                   });
               }
           }
        });
      }

      return {
        valid: true,
        stats: {
          foldersCount: normalizedData.folders.length,
          historyCount: normalizedData.history.length,
          notesCount: normalizedData.notes.length,
          tasksCount: normalizedData.tasks.length
        },
        data: normalizedData
      };

    } catch (e) {
      console.error("Smart Parse Failed:", e);
      return { valid: false, error: e };
    }
  },

  // Atomic Restore Function
  restoreBackup: async (folders: any[], history: any[], notes: any[], tasks: any[] = []) => {
    const db = await openDB();
    const tx = db.transaction([STORES.FOLDERS, STORES.HISTORY, STORES.NOTES, STORES.TASKS], 'readwrite');
    
    // Clear existing data first
    const clearPromises = [
      new Promise((resolve, reject) => {
         const req = tx.objectStore(STORES.FOLDERS).clear();
         req.onsuccess = resolve;
         req.onerror = reject;
      }),
      new Promise((resolve, reject) => {
         const req = tx.objectStore(STORES.HISTORY).clear();
         req.onsuccess = resolve;
         req.onerror = reject;
      }),
      new Promise((resolve, reject) => {
         const req = tx.objectStore(STORES.NOTES).clear();
         req.onsuccess = resolve;
         req.onerror = reject;
      }),
      new Promise((resolve, reject) => {
         const req = tx.objectStore(STORES.TASKS).clear();
         req.onsuccess = resolve;
         req.onerror = reject;
      })
    ];

    await Promise.all(clearPromises);

    // Write new data
    tx.objectStore(STORES.FOLDERS).put(folders, 'main');
    tx.objectStore(STORES.HISTORY).put(history, 'main');
    tx.objectStore(STORES.NOTES).put(notes, 'main');
    tx.objectStore(STORES.TASKS).put(tasks, 'main');

    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};