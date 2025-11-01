import { get, set, del } from 'idb-keyval';
import {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client';

/**
 * Creates an IndexedDB persister for React Query
 * IndexedDB tiene límites MUCHO más grandes que localStorage (50MB-1GB)
 * y no requiere serialización JSON (más rápido)
 */
export function createIDBPersister(idbValidKey: IDBValidKey = 'reactQuery') {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(idbValidKey, client);
    },
    restoreClient: async () => {
      return await get<PersistedClient>(idbValidKey);
    },
    removeClient: async () => {
      await del(idbValidKey);
    },
  } satisfies Persister;
}
