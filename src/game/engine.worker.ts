import { findBestMove } from "./engine";
self.onmessage = (event: MessageEvent<{ fen: string; level: number }>) => {
  try {
    self.postMessage({ move: findBestMove(event.data.fen, event.data.level) });
  } catch {
    self.postMessage({ error: true });
  }
};
