"use client";

import { useSyncExternalStore } from "react";
import type { Bookmark, Note, Profile, Skill, Task, TroubleshootingRecord, WorkLog } from "./types";

/**
 * Browser storage for the whole app.
 *
 * Data lives in IndexedDB in this browser only. It never leaves the device unless you export it.
 * Each collection is kept in memory for instant reads and written back on every change.
 * Other open tabs are kept in sync with a BroadcastChannel.
 */

export interface Meta {
  lastExportAt: string | null;
  createdAt: string;
}

export interface DB {
  tasks: Task[];
  troubleshooting_records: TroubleshootingRecord[];
  notes: Note[];
  work_logs: WorkLog[];
  skills: Skill[];
  bookmarks: Bookmark[];
  profile: Profile;
  meta: Meta;
}

export type CollectionKey = "tasks" | "troubleshooting_records" | "notes" | "work_logs" | "skills" | "bookmarks";
export const COLLECTIONS: CollectionKey[] = ["tasks", "troubleshooting_records", "notes", "work_logs", "skills", "bookmarks"];
type Key = keyof DB;
const KEYS: Key[] = [...COLLECTIONS, "profile", "meta"];

const DB_NAME = "it-engineer-companion";
const STORE = "kv";

function detectTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function defaultProfile(): Profile {
  const now = new Date().toISOString();
  return {
    display_name: "",
    theme: "system",
    timezone: detectTimeZone(),
    date_format: "dd MMM yyyy",
    time_format: "24h",
    created_at: now,
    updated_at: now,
  };
}

export function emptyDB(): DB {
  return {
    tasks: [],
    troubleshooting_records: [],
    notes: [],
    work_logs: [],
    skills: [],
    bookmarks: [],
    profile: defaultProfile(),
    meta: { lastExportAt: null, createdAt: new Date().toISOString() },
  };
}

// ------------------------------------------------------------------ IndexedDB

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
  return dbPromise;
}

function idbGetAll(db: IDBDatabase): Promise<Partial<DB>> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const out: Partial<DB> = {};
    KEYS.forEach((k) => {
      const r = store.get(k);
      r.onsuccess = () => {
        if (r.result !== undefined) (out as Record<string, unknown>)[k] = r.result;
      };
    });
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
}

function idbPut(db: IDBDatabase, entries: [Key, unknown][]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    entries.forEach(([k, v]) => store.put(v, k));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ------------------------------------------------------------------ state

export type StoreStatus = "loading" | "ready" | "memory-only";

let state: DB | null = null;
let status: StoreStatus = "loading";
let snapshot: { db: DB | null; status: StoreStatus } = { db: null, status };
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let started = false;

function emit() {
  snapshot = { db: state, status };
  listeners.forEach((l) => l());
}

function merge(saved: Partial<DB>): DB {
  const base = emptyDB();
  return {
    ...base,
    ...saved,
    profile: { ...base.profile, ...(saved.profile ?? {}) },
    meta: { ...base.meta, ...(saved.meta ?? {}) },
  };
}

async function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    const db = await openDB();
    state = merge(await idbGetAll(db));
    status = "ready";
    // Ask the browser not to evict our data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
  } catch {
    state = emptyDB();
    status = "memory-only";
  }
  emit();
  try {
    channel = new BroadcastChannel(DB_NAME);
    channel.onmessage = async () => {
      try {
        state = merge(await idbGetAll(await openDB()));
        emit();
      } catch {}
    };
  } catch {}
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void start();
  return () => listeners.delete(listener);
}

const serverSnapshot = { db: null, status: "loading" as StoreStatus };

/** Current data and storage status. `db` is null until IndexedDB has loaded. */
export function useStore() {
  return useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);
}

/** Wait for the store to be loaded (used by actions). */
export async function ready(): Promise<DB> {
  await start();
  if (!state) throw new Error("Storage not ready");
  return state;
}

/** Apply a change, notify the UI immediately, then persist. */
export async function commit(changes: Partial<DB>): Promise<void> {
  const current = await ready();
  state = { ...current, ...changes };
  emit();
  if (status !== "ready") return;
  const db = await openDB();
  await idbPut(db, Object.entries(changes) as [Key, unknown][]);
  channel?.postMessage("changed");
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Rough size of stored data, for the settings page. */
export function approxBytes(db: DB): number {
  try {
    return new Blob([JSON.stringify(db)]).size;
  } catch {
    return 0;
  }
}
