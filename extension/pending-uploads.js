/** IndexedDB persistence for recordings that failed to upload. */

const PENDING_DB_NAME = "meetflow-pending-uploads";
const PENDING_DB_VERSION = 1;
const PENDING_STORE = "pending";
const PENDING_KEY = "current";

function openPendingDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PENDING_DB_NAME, PENDING_DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Could not open pending uploads database."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function runPendingTransaction(mode, fn) {
  return openPendingDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(PENDING_STORE, mode);
        const store = tx.objectStore(PENDING_STORE);
        let result;
        try {
          result = fn(store);
        } catch (error) {
          reject(error);
          return;
        }
        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("Pending upload transaction failed."));
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error("Pending upload transaction aborted."));
        };
      }),
  );
}

/**
 * @param {object} input
 * @param {Blob} input.blob
 */
async function savePendingUpload(input) {
  const record = {
    id: crypto.randomUUID(),
    fileName: input.fileName,
    mimeType: input.mimeType,
    bytes: input.bytes,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    meetUrl: input.meetUrl ?? null,
    meetTitle: input.meetTitle ?? null,
    tabTitle: input.tabTitle ?? null,
    platform: input.platform ?? null,
    meetCode: input.meetCode ?? null,
    diagnostics: input.diagnostics ?? null,
    error: input.error ?? null,
    blob: input.blob,
  };

  await runPendingTransaction("readwrite", (store) => {
    store.put(record, PENDING_KEY);
  });

  return record;
}

async function getPendingUpload() {
  const record = await runPendingTransaction("readonly", (store) => store.get(PENDING_KEY));
  if (!record?.blob) return null;
  return record;
}

async function clearPendingUpload() {
  await runPendingTransaction("readwrite", (store) => {
    store.delete(PENDING_KEY);
  });
}

async function hasPendingUpload() {
  const record = await getPendingUpload();
  return Boolean(record);
}
