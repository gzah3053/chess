import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess, type Square } from "chess.js";
import {
  positionSquare,
  reconcilePieces,
  squarePosition,
} from "../src/scene/board";

test("3D picking covers all 64 square centres and rejects positions off the board", () => {
  for (const f of "abcdefgh")
    for (let r = 1; r <= 8; r++) {
      const square = `${f}${r}` as Square;
      const [x, z] = squarePosition(square);
      assert.equal(positionSquare(x, z), square);
      assert.equal(positionSquare(x + 0.49, z - 0.49), square);
    }
  for (const [x, z] of [
    [-4.01, 0],
    [4.01, 0],
    [0, -4.01],
    [0, 4.01],
  ])
    assert.equal(positionSquare(x, z), null);
});
test("3D sculptures keep their identity through capture, en passant, castling and undo", () => {
  const game = new Chess();
  let pieces = reconcilePieces([], game.fen());
  const king = pieces.find((p) => p.square === "e1")!.id;
  const rook = pieces.find((p) => p.square === "h1")!.id;
  const pawn = pieces.find((p) => p.square === "e2")!.id;
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
  ]) {
    game.move(move);
    pieces = reconcilePieces(pieces, game.fen());
    assert.equal(pieces.length, game.board().flat().filter(Boolean).length);
    assert.equal(new Set(pieces.map((p) => p.id)).size, pieces.length);
    if (move === "exd6" && game.turn() === "b") {
      assert.equal(pieces.find((p) => p.square === "d6")!.id, pawn);
      assert.equal(
        pieces.some((p) => p.square === "d5"),
        false,
      );
    }
  }
  assert.equal(pieces.find((p) => p.square === "g1")!.id, king);
  assert.equal(pieces.find((p) => p.square === "f1")!.id, rook);
  game.undo();
  pieces = reconcilePieces(pieces, game.fen());
  assert.equal(pieces.find((p) => p.square === "e1")!.id, king);
  assert.equal(pieces.find((p) => p.square === "h1")!.id, rook);
});
test("promotion changes the sculpture while keeping the moving pawn identity", () => {
  for (const promotion of ["q", "r", "n", "b"]) {
    const game = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
    const previous = reconcilePieces([], game.fen());
    game.move({ from: "a7", to: "a8", promotion });
    const next = reconcilePieces(previous, game.fen());
    assert.equal(
      next.find((p) => p.square === "a8")!.id,
      previous.find((p) => p.square === "a7")!.id,
    );
    assert.equal(next.find((p) => p.square === "a8")!.type, promotion);
  }
});
