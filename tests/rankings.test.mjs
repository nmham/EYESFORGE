import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = readFileSync(new URL("../peripheral-vision-trainer.html", import.meta.url), "utf8");
const start = html.indexOf("    function eventName()");
const end = html.indexOf("    function setDuration(", start);
assert.ok(start >= 0 && end > start, "Ranking functions must be present in the actual HTML");
const source = html.slice(start, end);
const key = "single-static-30";
const otherKey = "grid-static-60";
const record = {
  score: 12, accuracy: 80, reaction: 450, duration: 30,
  date: "2026/9/10", difficulty: "standard", focusSpeed: "-",
};
const plain = (value) => JSON.parse(JSON.stringify(value));

function element() {
  return {
    children: [], textContent: "", title: "", className: "",
    set innerHTML(value) { this.markup = value; this.children = []; },
    appendChild(child) { this.children.push(child); },
  };
}

function app(raw) {
  const storage = { raw, blocked: false, writes: 0 };
  const context = vm.createContext({
    state: { rankingStore: {}, duration: 30, score: 20 },
    leaderboardKey: "rankings",
    localStorage: {
      getItem() {
        if (storage.blocked) throw new Error("Storage blocked");
        return storage.raw;
      },
      setItem(_key, value) {
        if (storage.blocked) throw new Error("Storage blocked");
        storage.writes++;
        storage.raw = value;
      },
    },
    difficultyText: { textContent: "standard" },
    focusSpeedText: { textContent: "standard" },
    rankingTitle: element(), rankingList: element(),
    document: { createElement: element },
  });
  vm.runInContext(source, context, { filename: "rankings-from-html.js" });
  return { context, storage, run: (code) => vm.runInContext(code, context) };
}

for (const raw of [null, "{bad json", "null", "42", '"text"', "true", "[]", "{}",
  JSON.stringify({ [key]: {} }), JSON.stringify({ [key]: "not an array" }),
  JSON.stringify({ [key]: [null, {}, [], { score: 1 }] })]) {
  test(`malformed storage recovers, renders, and saves: ${raw === null ? "(missing key)" : raw}`, () => {
    const game = app(raw);
    assert.doesNotThrow(() => game.run("renderRanking()"));
    assert.equal(game.context.rankingList.children[0].textContent, "No Records");
    assert.equal(game.storage.writes, 0, "Reading must not rewrite stored data");
    const saved = game.run("saveRanking(200, 100)");
    assert.equal(saved.length, 1);
    assert.equal(saved[0].score, 20);
    assert.doesNotThrow(() => game.run("renderRanking()"));
    assert.equal(JSON.parse(game.storage.raw)[key][0].score, 20);
  });
}

test("drops only invalid rows, retaining valid rows and other event records", () => {
  const invalid = [null, {}, [], { ...record, score: "12" }, { ...record, score: -1 },
    { ...record, score: null }, { ...record, score: Infinity },
    { ...record, accuracy: 101 }, { ...record, accuracy: -1 },
    { ...record, reaction: "450" }, { ...record, reaction: -1 },
    { ...record, duration: 0 }, { ...record, duration: "30" }];
  const other = { ...record, duration: 60 };
  const game = app(JSON.stringify({ [key]: [...invalid, record], [otherKey]: [other], broken: {} }));
  const data = plain(game.run("readRankings()"));
  assert.deepEqual(data[key], [record]);
  assert.deepEqual(data[otherKey], [other]);
  game.run("saveRanking(200, 100)");
  assert.deepEqual(JSON.parse(game.storage.raw)[otherKey], [other]);
  assert.equal(JSON.parse(game.storage.raw)[key].length, 2);
});

test("legacy records without optional metadata remain usable", () => {
  const game = app(JSON.stringify({ [key]: [{ score: 0, accuracy: 0, reaction: 0 }] }));
  const rows = game.run("readRankings()")[key];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].score, 0);
  assert.doesNotThrow(() => game.run("renderRanking()"));
  game.run("saveRanking(200, 100)");
  assert.equal(JSON.parse(game.storage.raw)[key].length, 2);
});

test("invalid display metadata cannot break rendering or discard a valid score", () => {
  const game = app(JSON.stringify({ [key]: [{ ...record,
    date: { toString: 1 }, difficulty: [], focusSpeed: null,
  }] }));
  assert.doesNotThrow(() => game.run("renderRanking()"));
  assert.equal(game.context.rankingList.children[0].title, "- / - / -");
  assert.equal(game.run("readRankings()")[key][0].score, record.score);
});

test("numeric overflow in JSON is excluded", () => {
  const game = app('{"single-static-30":[{"score":1e999,"accuracy":100,"reaction":200}]}');
  assert.equal(game.run("readRankings()")[key].length, 0);
  assert.doesNotThrow(() => game.run("renderRanking()"));
});

test("valid rankings retain their ordering rules and top-five limit", () => {
  const rows = [
    { ...record, score: 30 }, { ...record, score: 20, accuracy: 100, reaction: 100 },
    { ...record, score: 20, accuracy: 90 }, { ...record, score: 10 },
    { ...record, score: 5 },
  ];
  const game = app(JSON.stringify({ [key]: rows }));
  assert.deepEqual(plain(game.run("readRankings()")[key]), rows);
  assert.deepEqual(plain(game.run("saveRanking(200, 100)")).map((row) => [row.score, row.accuracy, row.reaction]),
    [[30, 80, 450], [20, 100, 100], [20, 100, 200], [20, 90, 450], [10, 80, 450]]);
});

test("storage denial and malformed JSON retain the in-memory records", () => {
  const game = app(JSON.stringify({ [key]: [record] }));
  game.run("readRankings()");
  game.storage.blocked = true;
  game.run("saveRanking(200, 100)");
  assert.equal(game.run("readRankings()")[key].length, 2);
  game.storage.blocked = false;
  game.storage.raw = "{bad json";
  assert.equal(game.run("readRankings()")[key].length, 2);
  assert.doesNotThrow(() => game.run("renderRanking()"));
});

test("special object keys do not change the store prototype", () => {
  const game = app('{"__proto__":[],"constructor":[]}');
  game.run("readRankings()");
  assert.equal(game.run("Object.getPrototypeOf(state.rankingStore)"), null);
  assert.doesNotThrow(() => game.run("saveRanking(200, 100)"));
});
