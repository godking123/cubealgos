// The page's line to the engine worker: one promise per command, resolved with the
// command's JSON, an {error} object if the engine could not load or run it
const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });

let nextId = 0;
const pending = new Map<number, (v: any) => void>();

worker.onmessage = (e: MessageEvent<{ id: number; result: unknown }>) => {
  pending.get(e.data.id)?.(e.data.result);
  pending.delete(e.data.id);
};
worker.onerror = e => {
  for (const res of pending.values()) res({ error: 'engine failed to load: ' + (e.message || 'unknown error') });
  pending.clear();
};

export function api<T = any>(cmd: string, params: Record<string, string | number> = {}): Promise<T> {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  return new Promise(res => {
    const id = nextId++;
    pending.set(id, res);
    worker.postMessage({ id, cmd, params: q.toString() });
  });
}
