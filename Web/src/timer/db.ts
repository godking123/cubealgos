import type { Snap } from '../cube';

export type Penalty = 'ok' | '+2' | 'dnf';

// The engine's look at a solve's scramble, stored with the solve once computed
export interface Analysis {
  crosses: { color: string; rotation: string; moves: string[] }[];
  cfop: { rotation: string; steps: { label: string; case: string; moves: string[] }[] };
  state: Snap;
}

export interface Solve {
  id: string;
  session: string;
  time: number;          // Raw ms, Penalty Not Included
  penalty: Penalty;
  scramble: string;
  date: number;
  splits?: number[];     // Cumulative ms at the End of Cross, F2L, OLL
  analysis?: Analysis;
}

export interface Session { id: string; name: string; created: number }

// Solves and sessions in IndexedDB, so a visitor's history stays in their browser
// across visits without an account or a server
//
// Every call resolves even when IndexedDB is missing or blocked (some private
// windows): the timer then keeps solves in memory and says they will not be saved
const DB = 'cubealgos', VERSION = 1;
let dbp: Promise<IDBDatabase | null> | null = null;

function open() {
  if (!dbp) dbp = new Promise(res => {
    try {
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        const solves = db.createObjectStore('solves', { keyPath: 'id' });
        solves.createIndex('session', 'session');
        db.createObjectStore('sessions', { keyPath: 'id' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
      req.onblocked = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}

function wrap<T>(req: IDBRequest<T>) {
  return new Promise<T>((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
}

// Stand-in Stores for a Browser Without IndexedDB
const memory = { solves: new Map<string, Solve>(), sessions: new Map<string, Session>() };

export async function persistent() { return (await open()) != null; }

export async function allSessions(): Promise<Session[]> {
  const db = await open();
  if (!db) return [...memory.sessions.values()];
  return wrap(db.transaction('sessions').objectStore('sessions').getAll());
}

export async function sessionSolves(session: string): Promise<Solve[]> {
  const db = await open();
  const all = db
    ? await wrap(db.transaction('solves').objectStore('solves').index('session').getAll(session)) as Solve[]
    : [...memory.solves.values()].filter(s => s.session === session);
  return all.sort((a, b) => a.date - b.date);
}

export async function allSolves(): Promise<Solve[]> {
  const db = await open();
  if (!db) return [...memory.solves.values()];
  return wrap(db.transaction('solves').objectStore('solves').getAll());
}

export async function put(store: 'solves' | 'sessions', ...rows: (Solve | Session)[]) {
  const db = await open();
  if (!rows.length) return;
  if (!db) { for (const r of rows) (memory[store] as Map<string, Solve | Session>).set(r.id, r); return; }
  const tx = db.transaction(store, 'readwrite');
  for (const r of rows) tx.objectStore(store).put(r);
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export async function remove(store: 'solves' | 'sessions', ...ids: string[]) {
  const db = await open();
  if (!ids.length) return;
  if (!db) { for (const id of ids) memory[store].delete(id); return; }
  const tx = db.transaction(store, 'readwrite');
  for (const id of ids) tx.objectStore(store).delete(id);
  await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
