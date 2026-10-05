/**
 * Safe localStorage wrapper with fallback for restricted environments
 * (Incognito mode, privacy extensions, third-party cookie blockers)
 */

const storage = {
  get: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('[Storage] localStorage access denied, using memory fallback');
      return storage.memory?.get(key) || null;
    }
  },
  
  set: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[Storage] localStorage write denied, using memory fallback');
      storage.memory?.set(key, value);
    }
  },
  
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[Storage] localStorage remove denied, clearing memory fallback');
      storage.memory?.delete(key);
    }
  },
  
  clear: (): void => {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('[Storage] localStorage clear denied, clearing memory fallback');
      storage.memory?.clear();
    }
  }
};

// In-memory fallback storage
storage.memory = {
  store: new Map<string, string>(),
  get: (key: string) => storage.memory!.store.get(key) || null,
  set: (key: string, value: string) => storage.memory!.store.set(key, value),
  delete: (key: string) => storage.memory!.store.delete(key),
  clear: () => storage.memory!.store.clear()
};

export default storage;
