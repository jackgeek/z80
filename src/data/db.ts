// IndexedDB storage — tapes, saves, session image, settings

const DB_NAME = 'zx-spectrum-db';
const DB_VERSION = 1;

export interface TapeItem {
  id: string;
  name: string;
  data: ArrayBuffer | null;
  format: 'tap' | 'tzx' | null;
  createdAt: number;
}

export interface SaveItem {
  id: string;
  parentTapeId: string;
  saveName: string;
  data: ArrayBuffer;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('tapes')) {
        db.createObjectStore('tapes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('saves')) {
        const savesStore = db.createObjectStore('saves', { keyPath: 'id' });
        savesStore.createIndex('parentTapeId', 'parentTapeId', { unique: false });
      }
      if (!db.objectStoreNames.contains('currentImage')) {
        db.createObjectStore('currentImage', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Tapes ────────────────────────────────────────────────────────────────────

export async function saveTape(
  name: string,
  data: ArrayBuffer | null,
  format: 'tap' | 'tzx' | null,
): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const item: TapeItem = { id, name, data, format, createdAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tapes', 'readwrite');
    tx.objectStore('tapes').put(item);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getTapes(): Promise<TapeItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tapes', 'readonly');
    const req = tx.objectStore('tapes').getAll();
    req.onsuccess = () => resolve(req.result as TapeItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTape(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['tapes', 'saves'], 'readwrite');
    tx.objectStore('tapes').delete(id);
    const req = tx.objectStore('saves').index('parentTapeId').getAllKeys(id);
    req.onsuccess = () => {
      for (const key of req.result) {
        tx.objectStore('saves').delete(key);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Saves ────────────────────────────────────────────────────────────────────

export async function createSave(
  parentTapeId: string,
  saveName: string,
  data: ArrayBuffer,
): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const item: SaveItem = { id, parentTapeId, saveName, data, createdAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').put(item);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSave(id: string): Promise<SaveItem | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readonly');
    const req = tx.objectStore('saves').get(id);
    req.onsuccess = () => resolve((req.result as SaveItem) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getSavesForTape(tapeId: string): Promise<SaveItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readonly');
    const req = tx.objectStore('saves').index('parentTapeId').getAll(tapeId);
    req.onsuccess = () => resolve(req.result as SaveItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSave(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Current image ─────────────────────────────────────────────────────────────

export async function saveCurrentImage(data: ArrayBuffer): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('currentImage', 'readwrite');
    tx.objectStore('currentImage').put({ id: 'current', data, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadCurrentImage(): Promise<ArrayBuffer | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('currentImage', 'readonly');
    const req = tx.objectStore('currentImage').get('current');
    req.onsuccess = () => resolve((req.result as { data: ArrayBuffer } | undefined)?.data ?? null);
    req.onerror = () => reject(req.error);
  });
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | boolean | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const req = tx.objectStore('settings').get(key);
    req.onsuccess = () => resolve((req.result as { value: string | boolean } | undefined)?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function setSetting(key: string, value: string | boolean): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
