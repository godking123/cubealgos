// The C++ engine, built by `make wasm`, run off the main thread
//
// Table building and a Kociemba search can each take a few hundred milliseconds, long
// enough to stall the cube's animation if they ran on the page. Messages are handled
// one at a time in arrival order, so the session sees commands exactly as sent
import createEngine from './engine/engine.mjs';

type Call = (cmd: string, params: string) => string;

const ready: Promise<Call> = createEngine().then(m => {
  m._engine_init();
  return m.cwrap('engine_call', 'string', ['string', 'string']) as Call;
});

let chain = Promise.resolve();
self.onmessage = (e: MessageEvent<{ id: number; cmd: string; params: string }>) => {
  const { id, cmd, params } = e.data;
  chain = chain.then(async () => {
    let result: unknown;
    try {
      result = JSON.parse((await ready)(cmd, params));
    } catch (err) {
      result = { error: 'engine: ' + (err instanceof Error ? err.message : String(err)) };
    }
    self.postMessage({ id, result });
  });
};
