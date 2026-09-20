import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

function createWorker(keys, deleteCache = async () => true) {
  const handlers = new Map();
  const deleted = [];
  const events = [];
  const context = vm.createContext({
    self: {
      addEventListener: (name, handler) => handlers.set(name, handler),
      clients: { claim: async () => events.push("claim") },
    },
    caches: {
      keys: async () => keys,
      delete: async (key) => {
        deleted.push(key);
        await deleteCache(key);
        events.push(`deleted:${key}`);
      },
    },
  });
  vm.runInContext(source, context, { filename: "sw.js" });
  return {
    currentCache: vm.runInContext("CACHE_NAME", context),
    deleted,
    events,
    activate() {
      let lifetime;
      handlers.get("activate")({ waitUntil: (promise) => { lifetime = promise; } });
      assert.ok(lifetime, "Activation must track asynchronous cleanup");
      return lifetime;
    },
  };
}

test("activation preserves caches owned by other applications", async () => {
  const worker = createWorker([
    "another-app-v1", "workbox-precache-v2", "eyes-forge-settings", "eyes-forge-video",
  ]);
  await worker.activate();
  assert.deepEqual(worker.deleted, []);
  assert.deepEqual(worker.events, ["claim"]);
});

test("activation removes obsolete EYES FORGE releases but keeps the current release", async () => {
  const keys = ["eyes-forge-v0.8.0", "eyes-forge-v0.9.0", "another-app-v2"];
  const worker = createWorker(keys);
  keys.push(worker.currentCache);
  await worker.activate();
  assert.deepEqual(worker.deleted.sort(), ["eyes-forge-v0.8.0", "eyes-forge-v0.9.0"]);
  assert.equal(worker.events.at(-1), "claim");
});

test("first installation can activate with no existing caches", async () => {
  const worker = createWorker([]);
  await worker.activate();
  assert.deepEqual(worker.deleted, []);
  assert.deepEqual(worker.events, ["claim"]);
});

test("clients are claimed only after all obsolete caches finish deleting", async () => {
  let finishDelete;
  const deletion = new Promise((resolve) => { finishDelete = resolve; });
  const worker = createWorker(["eyes-forge-v0.9.0"], () => deletion);
  const activation = worker.activate();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(worker.deleted, ["eyes-forge-v0.9.0"]);
  assert.deepEqual(worker.events, []);
  finishDelete();
  await activation;
  assert.deepEqual(worker.events, ["deleted:eyes-forge-v0.9.0", "claim"]);
});

test("cleanup failure rejects activation without claiming clients", async () => {
  const worker = createWorker(["eyes-forge-v0.9.0"], async () => {
    throw new Error("Cache storage unavailable");
  });
  await assert.rejects(worker.activate(), /Cache storage unavailable/);
  assert.deepEqual(worker.events, []);
});
