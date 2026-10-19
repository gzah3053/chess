import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import {
  DEFAULT_CONFIG,
  readStorage,
  restoreGame,
  writeStorage,
} from "../src/game/storage";
const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  },
});

test("saved games restore position, legal history and clock snapshots", () => {
  const game = new Chess();
  for (const move of ["e4", "e5", "Nf3", "Nc6"]) game.move(move);
  const saved = {
    id: "restored-game",
    pgn: game.pgn(),
    config: { ...DEFAULT_CONFIG, minutes: 5, increment: 3 },
    clocks: { w: 299000, b: 298000 },
    clockHistory: [{ w: 300000, b: 300000 }],
    result: null,
  };
  assert.equal(writeStorage("atelier-game", saved), true);
  const restored = restoreGame();
  assert.equal(restored.chess.fen(), game.fen());
  assert.deepEqual(restored.chess.history(), game.history());
  assert.deepEqual(restored.saved?.clocks, saved.clocks);
  assert.deepEqual(restored.saved?.clockHistory, saved.clockHistory);
});
test("malformed saves safely fall back to a fresh game", () => {
  for (const value of [
    "{broken",
    "null",
    '{"config":{}}',
    JSON.stringify({
      config: DEFAULT_CONFIG,
      pgn: "not a game",
      clocks: { w: 0, b: 0 },
      clockHistory: [],
    }),
  ]) {
    memory.set("atelier-game", value);
    const restored = restoreGame();
    assert.equal(restored.saved, null);
    assert.equal(restored.chess.fen(), new Chess().fen());
  }
  memory.set("corrupt-value", "broken");
  assert.deepEqual(readStorage("corrupt-value", []), []);
});
