/* IndexedDB queue for offline-first suivi rows.
   Each entry is a SuiviCreate payload keyed by local_uuid. */

import type { SuiviCreate } from './api'

const DB_NAME = 'qc-level1'
const STORE = 'pending_suivis'
const VERSION = 1

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'local_uuid' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function queueSuivi(payload: SuiviCreate): Promise<void> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(payload)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingSuivis(): Promise<SuiviCreate[]> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as SuiviCreate[])
    req.onerror = () => reject(req.error)
  })
}

export async function removeSuivi(local_uuid: string): Promise<void> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(local_uuid)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearSyncedSuivis(uuids: string[]): Promise<void> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    uuids.forEach((u) => store.delete(u))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
