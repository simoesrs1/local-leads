import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Data lives in server/data/ (git-ignored) unless LOCAL_LEADS_DATA_DIR points elsewhere. */
export const DATA_DIR =
  process.env['LOCAL_LEADS_DATA_DIR'] ?? join(dirname(fileURLToPath(import.meta.url)), 'data');

export interface Store<T> {
  read(): Promise<T>;
  write(value: T): Promise<void>;
}

/**
 * Tiny JSON-file store. `secret` files are written with 0600 permissions
 * (owner read/write only) because they hold the SMTP password.
 */
export function jsonStore<T>(fileName: string, defaults: () => T, secret = false): Store<T> {
  const path = join(DATA_DIR, fileName);
  return {
    async read() {
      try {
        return JSON.parse(await readFile(path, 'utf8')) as T;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return defaults();
        throw error;
      }
    },
    async write(value) {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(path, JSON.stringify(value, null, 2), { mode: secret ? 0o600 : 0o644 });
    },
  };
}

/** In-memory store, used by the tests. */
export function memoryStore<T>(initial: T): Store<T> {
  let value = structuredClone(initial);
  return {
    read: async () => structuredClone(value),
    write: async (next) => {
      value = structuredClone(next);
    },
  };
}
