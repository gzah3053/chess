import { Chess, type Move, type PieceSymbol, type Color } from "chess.js";
export const VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 0,
};
export const LEVELS = [
  {
    name: "Einsteiger",
    description: "Entspannt die Grundlagen entdecken",
    depth: 1,
    time: 120,
    noise: 260,
  },
  {
    name: "Gelegenheitsspieler",
    description: "Ein aufmerksamer Spielpartner",
    depth: 2,
    time: 350,
    noise: 80,
  },
  {
    name: "Fortgeschritten",
    description: "Denkt voraus und nutzt Chancen",
    depth: 3,
    time: 850,
    noise: 10,
  },
  {
    name: "Herausforderer",
    description: "Unser stärkster Computergegner",
    depth: 4,
    time: 1700,
    noise: 0,
  },
];
export function evaluate(chess: Chess): number {
  let score = 0;
  for (const row of chess.board())
    for (const piece of row) {
      if (!piece) continue;
      const x = piece.square.charCodeAt(0) - 97;
      const y = Number(piece.square[1]) - 1;
      const advance = piece.color === "w" ? y : 7 - y;
      const center = 7 - (Math.abs(x - 3.5) + Math.abs(y - 3.5));
      const positional =
        piece.type === "p"
          ? advance * 9 + center * 3
          : piece.type === "k"
            ? -center * 6
            : center * 10;
      score +=
        (piece.color === "w" ? 1 : -1) * (VALUES[piece.type] + positional);
    }
  return score;
}
const ordered = (moves: Move[]) =>
  moves.sort(
    (a, b) =>
      (b.captured ? VALUES[b.captured] * 10 - VALUES[b.piece] : 0) +
      (b.promotion ? 800 : 0) -
      ((a.captured ? VALUES[a.captured] * 10 - VALUES[a.piece] : 0) +
        (a.promotion ? 800 : 0)),
  );
export function findBestMove(
  fen: string,
  level: number,
  budget?: number,
): { from: string; to: string; promotion?: string } | null {
  const chess = new Chess(fen);
  if (chess.isGameOver()) return null;
  const config = LEVELS[Math.max(0, Math.min(3, level))];
  const deadline = performance.now() + (budget ?? config.time);
  const timeout = Symbol("timeout");
  let nodes = 0;
  function search(
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
  ): number {
    if ((++nodes & 31) === 0 && performance.now() > deadline) throw timeout;
    if (chess.isCheckmate()) return -100000 + ply;
    if (chess.isDraw()) return 0;
    if (depth === 0) return evaluate(chess) * (chess.turn() === "w" ? 1 : -1);
    let best = -Infinity;
    for (const move of ordered(chess.moves({ verbose: true }))) {
      chess.move(move);
      let value: number;
      try {
        value = -search(depth - 1, -beta, -alpha, ply + 1);
      } finally {
        chess.undo();
      }
      best = Math.max(best, value);
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return best;
  }
  const moves = ordered(chess.moves({ verbose: true }));
  let bestMove = moves[0];
  for (let depth = 1; depth <= config.depth; depth++) {
    let iterationBest = moves[0],
      best = -Infinity;
    try {
      for (const move of moves) {
        if (performance.now() > deadline) throw timeout;
        chess.move(move);
        let score: number;
        try {
          score = -search(depth - 1, -Infinity, Infinity, 1);
        } finally {
          chess.undo();
        }
        score += (Math.random() - 0.5) * config.noise;
        if (score > best) {
          best = score;
          iterationBest = move;
        }
      }
      bestMove = iterationBest;
    } catch (error) {
      if (error !== timeout) throw error;
      break;
    }
  }
  return {
    from: bestMove.from,
    to: bestMove.to,
    ...(bestMove.promotion ? { promotion: bestMove.promotion } : {}),
  };
}
export function automaticResult(
  chess: Chess,
): { winner: Color | null; reason: string } | null {
  if (chess.isCheckmate())
    return { winner: chess.turn() === "w" ? "b" : "w", reason: "Schachmatt" };
  if (chess.isStalemate()) return { winner: null, reason: "Patt" };
  if (chess.isInsufficientMaterial())
    return { winner: null, reason: "Unzureichendes Material" };
  if (chess.isThreefoldRepetition())
    return { winner: null, reason: "Dreifache Stellungswiederholung" };
  if (chess.isDrawByFiftyMoves())
    return { winner: null, reason: "50-Züge-Regel" };
  return null;
}
export function timeoutResult(chess: Chess, loser: Color) {
  const winner = loser === "w" ? "b" : "w";
  const pieces = chess
    .board()
    .flat()
    .filter((p) => p?.color === winner);
  // A lone king can never deliver mate. Other material is conservatively decisive.
  if (pieces.every((p) => p?.type === "k"))
    return {
      winner: null,
      reason: "Zeit abgelaufen · Gegner hat nur den König",
    };
  return { winner: winner as Color, reason: "Zeit abgelaufen" };
}
