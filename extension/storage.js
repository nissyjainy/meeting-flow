/** Shared chrome.storage.local helpers for extension contexts that support it. */

function getExtensionStorageLocal() {
  const root = typeof globalThis !== "undefined" ? globalThis : self;
  const storage = root.chrome?.storage ?? root.browser?.storage;
  return storage?.local ?? null;
}

function assertExtensionStorageLocal(context) {
  const local = getExtensionStorageLocal();
  if (!local) {
    throw new Error(`Extension storage API is unavailable in ${context}.`);
  }
  return local;
}

async function extensionStorageGet(keys, context = "this context") {
  const local = assertExtensionStorageLocal(context);
  return local.get(keys);
}

async function extensionStorageSet(values, context = "this context") {
  const local = assertExtensionStorageLocal(context);
  return local.set(values);
}

async function extensionStorageRemove(keys, context = "this context") {
  const local = assertExtensionStorageLocal(context);
  return local.remove(keys);
}
