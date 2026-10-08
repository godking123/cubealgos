// Emscripten's ES module output from `make wasm`, the two calls Engine.cc exports
interface EngineModule {
  _engine_init(): void;
  cwrap(name: string, ret: string | null, args: string[]): (...a: unknown[]) => unknown;
}
declare const createEngine: () => Promise<EngineModule>;
export default createEngine;
