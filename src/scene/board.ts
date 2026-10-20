import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

export type BoardPiece = {
  id: string;
  square: Square;
  type: PieceSymbol;
  color: Color;
};
export const squarePosition = (square: Square): [number, number] => [
  square.charCodeAt(0) - 97 - 3.5,
  4.5 - Number(square[1]),
];
export function positionSquare(x: number, z: number): Square | null {
  const file = Math.floor(x + 4),
    rank = 8 - Math.floor(z + 4);
  return file >= 0 && file < 8 && rank >= 1 && rank <= 8
    ? (`${"abcdefgh"[file]}${rank}` as Square)
    : null;
}

// Preserve object identities across moves so the same sculpture travels across the board.
// Matching stationary pieces first handles captures, en passant and both castling pieces.
export function reconcilePieces(
  previous: BoardPiece[],
  fen: string,
): BoardPiece[] {
  const next = new Chess(fen)
    .board()
    .flat()
    .filter((p) => p !== null);
  const used = new Set<string>();
  const result: BoardPiece[] = [];
  const pending = next.filter((p) => {
    const found = previous.find(
      (old) =>
        old.square === p.square && old.type === p.type && old.color === p.color,
    );
    if (!found) return true;
    used.add(found.id);
    result.push({ ...p, id: found.id });
    return false;
  });
  for (const p of pending) {
    const [x, z] = squarePosition(p.square);
    const candidates = previous.filter(
      (old) =>
        !used.has(old.id) &&
        old.color === p.color &&
        (old.type === p.type ||
          (old.type === "p" && (p.square[1] === "1" || p.square[1] === "8"))),
    );
    candidates.sort((a, b) => {
      const [ax, az] = squarePosition(a.square),
        [bx, bz] = squarePosition(b.square);
      return Math.hypot(x - ax, z - az) - Math.hypot(x - bx, z - bz);
    });
    const id = candidates[0]?.id ?? `${p.color}-${p.type}-${p.square}`;
    used.add(id);
    result.push({ ...p, id });
  }
  return result;
}
export const MOVE_SECONDS: Record<PieceSymbol, number> = {
  p: 0.38,
  n: 0.6,
  b: 0.48,
  r: 0.64,
  q: 0.55,
  k: 0.6,
};
