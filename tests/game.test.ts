import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import {
  automaticResult,
  findBestMove,
  timeoutResult,
  evaluate,
} from "../src/game/engine";

test("all four computer levels return legal moves and leave the position intact", () => {
  const game = new Chess();
  game.move("e4");
  const fen = game.fen();
  for (let level = 0; level < 4; level++) {
    const best = findBestMove(fen, level, 250);
    assert.ok(best);
    const clone = new Chess(fen);
    assert.doesNotThrow(() => clone.move(best));
    assert.equal(game.fen(), fen);
  }
});
test("strong engine takes mate in one", () => {
  const game = new Chess();
  for (const move of ["f3", "e5", "g4"]) game.move(move);
  const best = findBestMove(game.fen(), 3, 500);
  assert.ok(best);
  game.move(best);
  assert.equal(game.isCheckmate(), true);
  assert.deepEqual(automaticResult(game), {
    winner: "b",
    reason: "Schachmatt",
  });
});
test("engine terminates for finished games", () => {
  const game = new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assert.equal(findBestMove(game.fen(), 3), null);
  assert.equal(automaticResult(game)?.reason, "Patt");
});
test("castling and en passant survive PGN persistence and undo", () => {
  const game = new Chess();
  for (const move of [
    "e4",
    "a6",
    "e5",
    "d5",
    "exd6",
    "exd6",
    "Nf3",
    "Nf6",
    "Be2",
    "Be7",
    "O-O",
  ])
    game.move(move);
  assert.equal(game.get("f1")?.type, "r");
  assert.equal(game.get("g1")?.type, "k");
  assert.equal(game.history({ verbose: true })[4].isEnPassant(), true);
  const restored = new Chess();
  restored.loadPgn(game.pgn());
  assert.equal(restored.fen(), game.fen());
  restored.undo();
  assert.equal(restored.get("e1")?.type, "k");
  assert.equal(restored.get("h1")?.type, "r");
});
test("all four promotion choices are supported", () => {
  for (const piece of ["q", "r", "b", "n"]) {
    const game = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
    game.move({ from: "a7", to: "a8", promotion: piece });
    assert.equal(game.get("a8")?.type, piece);
  }
});
test("repetition and insufficient material produce automatic draws", () => {
  const game = new Chess();
  for (const move of ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"])
    game.move(move);
  assert.equal(
    automaticResult(game)?.reason,
    "Dreifache Stellungswiederholung",
  );
  assert.equal(
    automaticResult(new Chess("7k/8/8/8/8/8/8/7K w - - 0 1"))?.reason,
    "Unzureichendes Material",
  );
});
test("clock expiration recognizes a lone king cannot win", () => {
  const game = new Chess("7k/8/8/8/8/8/P7/7K w - - 0 1");
  assert.equal(timeoutResult(game, "w").winner, null);
  assert.equal(timeoutResult(game, "b").winner, "w");
});
test("starting material evaluation is balanced", () => {
  assert.ok(Math.abs(evaluate(new Chess())) < 1);
});

test("50-move limit is automatically recognized", () => {
  const game = new Chess("r6k/8/8/8/8/8/8/R6K w - - 100 51");
  assert.equal(automaticResult(game)?.reason, "50-Züge-Regel");
});
