import { Chess, type Color } from "chess.js";
export type Config = {
  mode: "computer" | "local";
  level: number;
  color: Color;
  minutes: number;
  increment: number;
};
export type Result = { winner: Color | null; reason: string };
export type RecordGame = {
  id: string;
  date: string;
  result: Result;
  config: Config;
  moves: number;
  pgn: string;
};
export type SavedGame = {
  id: string;
  pgn: string;
  config: Config;
  clocks: { w: number; b: number };
  clockHistory: { w: number; b: number }[];
  result: Result | null;
};
export const DEFAULT_CONFIG: Config = {
  mode: "computer",
  level: 1,
  color: "w",
  minutes: 0,
  increment: 0,
};
export function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStorage(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function restoreGame(): { chess: Chess; saved: SavedGame | null } {
  const saved = readStorage<SavedGame | null>("atelier-game", null);
  try {
    if (
      !saved ||
      !saved.config ||
      !["computer", "local"].includes(saved.config.mode) ||
      !["w", "b"].includes(saved.config.color) ||
      !Number.isInteger(saved.config.level) ||
      saved.config.level < 0 ||
      saved.config.level > 3 ||
      ![0, 3, 5, 10, 15, 30].includes(saved.config.minutes) ||
      ![0, 2, 3, 5, 10].includes(saved.config.increment) ||
      !Number.isFinite(saved.clocks.w) ||
      !Number.isFinite(saved.clocks.b) ||
      !Array.isArray(saved.clockHistory)
    )
      throw Error();
    const chess = new Chess();
    chess.loadPgn(saved.pgn);
    return { chess, saved };
  } catch {
    return { chess: new Chess(), saved: null };
  }
}
