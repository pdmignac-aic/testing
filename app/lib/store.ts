import type { Capture } from "./types";

const ROLL_KEY = "caught:roll:v1";
const DB_NAME = "caught";
const STORE = "captures";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | Promise<T>
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    Promise.resolve(fn(s)).then(
      (req) => {
        if (req && "onsuccess" in (req as object)) {
          (req as IDBRequest<T>).onsuccess = () =>
            resolve((req as IDBRequest<T>).result);
          (req as IDBRequest<T>).onerror = () =>
            reject((req as IDBRequest<T>).error);
        } else {
          resolve(req as T);
        }
      },
      (e) => reject(e)
    );
  });
}

export async function putBlob(id: string, blob: Blob): Promise<void> {
  await tx<IDBValidKey>("readwrite", (s) => s.put(blob, id));
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>("readonly", (s) => s.get(id));
}

export async function deleteBlob(id: string): Promise<void> {
  await tx<undefined>("readwrite", (s) => s.delete(id));
}

export function loadRoll(): Capture[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROLL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Capture[];
  } catch {
    return [];
  }
}

export function saveRoll(roll: Capture[]): void {
  localStorage.setItem(ROLL_KEY, JSON.stringify(roll));
}

export async function addCapture(cap: Capture, blob: Blob): Promise<Capture[]> {
  await putBlob(cap.id, blob);
  const roll = loadRoll();
  roll.push(cap);
  roll.sort((a, b) => a.capturedAt - b.capturedAt);
  saveRoll(roll);
  return roll;
}

export async function removeCapture(id: string): Promise<Capture[]> {
  await deleteBlob(id);
  const roll = loadRoll().filter((c) => c.id !== id);
  saveRoll(roll);
  return roll;
}

export async function clearRoll(): Promise<void> {
  const roll = loadRoll();
  await Promise.all(roll.map((c) => deleteBlob(c.id).catch(() => {})));
  localStorage.removeItem(ROLL_KEY);
}
