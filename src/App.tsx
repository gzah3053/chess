import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import {
  AudioLines,
  Box,
  Grid2X2,
  Music2,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  Clock3,
  Flag,
  FlipVertical2,
  Handshake,
  Lightbulb,
  Monitor,
  Palette,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Swords,
  Trophy,
  Upload,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Piece, PIECE_NAMES, type PieceSet } from "./components/Piece";
import {
  automaticResult,
  evaluate,
  LEVELS,
  timeoutResult,
} from "./game/engine";
import {
  DEFAULT_CONFIG,
  readStorage,
  restoreGame,
  writeStorage,
  type Config,
  type RecordGame,
  type Result,
} from "./game/storage";

import {
  ChessAudio,
  DEFAULT_AUDIO,
  type AudioSettings,
} from "./audio/ChessAudio";
const ChessBoard3D = lazy(() => import("./scene/ChessBoard3D"));

type Theme = { name: string; light: string; dark: string; accent: string };
const THEMES: Theme[] = [
  { name: "Salbei", light: "#e9e9d5", dark: "#7d9776", accent: "#58734f" },
  { name: "Walnuss", light: "#eedfc5", dark: "#a57a57", accent: "#8c6243" },
  { name: "Schiefer", light: "#e2e7e9", dark: "#778d9c", accent: "#516e83" },
  { name: "Rosé", light: "#f0e1d9", dark: "#b98c85", accent: "#9e6b67" },
];
const FILES = "abcdefgh";
const labelColor = (color: Color) => (color === "w" ? "Weiß" : "Schwarz");
const clockText = (ms: number) =>
  `${Math.floor(Math.max(0, ms) / 60000)
    .toString()
    .padStart(2, "0")}:${Math.floor((Math.max(0, ms) / 1000) % 60)
    .toString()
    .padStart(2, "0")}`;
const resultText = (result: Result) =>
  result.winner ? `${labelColor(result.winner)} gewinnt` : "Remis";
function annotatedPgn(chess: Chess, config: Config, result: Result | null) {
  const copy = new Chess();
  copy.loadPgn(chess.pgn());
  copy.header(
    "Event",
    "Atelier Schach",
    "White",
    config.mode === "computer" && config.color === "b"
      ? "Atelier Computer"
      : "Spieler Weiß",
    "Black",
    config.mode === "computer" && config.color === "w"
      ? "Atelier Computer"
      : "Spieler Schwarz",
    "Result",
    result
      ? result.winner === "w"
        ? "1-0"
        : result.winner === "b"
          ? "0-1"
          : "1/2-1/2"
      : "*",
  );
  return copy.pgn();
}
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = ref.current!;
    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, textarea, [tabindex="0"]',
        ),
      );
    focusables()[0]?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const items = focusables();
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = bodyOverflow;
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Schließen"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [initial] = useState(restoreGame);
  const chess = useRef(initial.chess).current;
  const [config, setConfig] = useState<Config>(
    initial.saved?.config ?? DEFAULT_CONFIG,
  );
  const [draft, setDraft] = useState<Config>(config);
  const [gameId, setGameId] = useState(
    initial.saved?.id ?? crypto.randomUUID(),
  );
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(
    initial.saved?.result ?? automaticResult(chess),
  );
  const [clocks, setClocks] = useState(initial.saved?.clocks ?? { w: 0, b: 0 });
  const clocksRef = useRef(clocks);
  const clockAnchor = useRef(performance.now());
  const clockHistory = useRef(initial.saved?.clockHistory ?? []);
  const [paused, setPaused] = useState(
    Boolean(initial.saved && chess.history().length && !initial.saved.result),
  );
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [flipped, setFlipped] = useState(config.color === "b");
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<{ from: string; to: string } | null>(null);
  const [hintThinking, setHintThinking] = useState(false);
  const [review, setReview] = useState<number | null>(null);
  const [tab, setTab] = useState<"moves" | "info">("moves");
  const [modal, setModal] = useState<
    | "new"
    | "design"
    | "stats"
    | "help"
    | "resign"
    | "draw"
    | "import"
    | "audio"
    | null
  >(null);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [toast, setToast] = useState("");
  const [archive, setArchive] = useState<RecordGame[]>(() =>
    readStorage("atelier-archive", []),
  );
  const [theme, setTheme] = useState<Theme>(() =>
    readStorage("atelier-theme", THEMES[0]),
  );
  const [pieceSet, setPieceSet] = useState<PieceSet>(() =>
    readStorage("atelier-pieces", "atelier"),
  );
  const [showLegal, setShowLegal] = useState(() =>
    readStorage("atelier-legal", true),
  );
  const [sound, setSound] = useState(() => readStorage("atelier-sound", true));
  const [view3d, setView3d] = useState(() => readStorage("atelier-3d", true));
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() =>
    readStorage("atelier-audio", DEFAULT_AUDIO),
  );
  const audio = useRef<ChessAudio | null>(null);
  useEffect(() => {
    const engine = new ChessAudio();
    audio.current = engine;
    engine.configure(audioSettings, sound);
    const unlock = () => {
      void engine.unlock();
    };
    const visibility = () => engine.visibility();
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      document.removeEventListener("visibilitychange", visibility);
      engine.dispose();
      if (audio.current === engine) audio.current = null;
    };
  }, []);
  useEffect(() => {
    audio.current?.configure(audioSettings, sound);
    writeStorage("atelier-audio", audioSettings);
    writeStorage("atelier-3d", view3d);
  }, [audioSettings, sound, view3d]);
  const hintWorker = useRef<Worker | null>(null);
  const moveListRef = useRef<HTMLDivElement>(null);
  const fen = chess.fen();
  const history = chess.history({ verbose: true });
  const savedPgn = useMemo(
    () => annotatedPgn(chess, config, result),
    [revision, config, result, chess],
  );
  const active = history.length > 0 && !result;
  const canPlay =
    !paused &&
    !result &&
    review === null &&
    (config.mode === "local" || chess.turn() === config.color);
  const viewing =
    review === null
      ? chess
      : (() => {
          const game = new Chess();
          game.loadPgn(chess.pgn());
          while (game.history().length > review) game.undo();
          return game;
        })();
  const lastMove = review === null ? history.at(-1) : history[review - 1];
  const legal =
    selected && canPlay ? chess.moves({ square: selected, verbose: true }) : [];
  const evaluation = Math.max(-12, Math.min(12, evaluate(viewing) / 100));
  const topColor: Color = flipped ? "w" : "b";
  const bottomColor: Color = flipped ? "b" : "w";
  const [storageWarned, setStorageWarned] = useState(false);

  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  function updateClocks(next: { w: number; b: number }) {
    clocksRef.current = next;
    clockAnchor.current = performance.now();
    setClocks(next);
  }
  function currentClocks() {
    const next = { ...clocksRef.current };
    if (config.minutes && active && !paused)
      next[chess.turn()] = Math.max(
        0,
        next[chess.turn()] - (performance.now() - clockAnchor.current),
      );
    return next;
  }
  useEffect(() => {
    clockAnchor.current = performance.now();
    if (!config.minutes || !active || paused) return;
    const interval = setInterval(() => {
      const next = { ...clocksRef.current };
      const turn = chess.turn();
      const now = performance.now();
      next[turn] = Math.max(0, next[turn] - (now - clockAnchor.current));
      clocksRef.current = next;
      clockAnchor.current = now;
      setClocks(next);
      if (next[turn] <= 0) {
        setResult(timeoutResult(chess, turn));
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [fen, config.minutes, active, paused, chess]);
  useEffect(() => {
    const ok = writeStorage("atelier-game", {
      id: gameId,
      pgn: savedPgn,
      config,
      clocks,
      clockHistory: clockHistory.current,
      result,
    });
    if (!ok && !storageWarned) {
      setStorageWarned(true);
      notify(
        "Browserspeicher nicht verfügbar. Bitte die Partie als PGN sichern.",
      );
    }
  }, [
    revision,
    gameId,
    config,
    result,
    clocks,
    chess,
    storageWarned,
    notify,
    savedPgn,
  ]);
  useEffect(() => {
    writeStorage("atelier-theme", theme);
    writeStorage("atelier-pieces", pieceSet);
    writeStorage("atelier-legal", showLegal);
    writeStorage("atelier-sound", sound);
  }, [theme, pieceSet, showLegal, sound]);
  useEffect(() => {
    if (!result || history.length === 0) return;
    const record: RecordGame = {
      id: gameId,
      date: new Date().toISOString(),
      result,
      config,
      moves: history.length,
      pgn: savedPgn,
    };
    setArchive((prev) => {
      if (prev.some((g) => g.id === gameId)) return prev;
      const next = [record, ...prev].slice(0, 200);
      writeStorage("atelier-archive", next);
      return next;
    });
  }, [result, gameId, config, history.length, chess, savedPgn]);
  useEffect(() => {
    if (review === null)
      moveListRef.current?.scrollTo({
        top: moveListRef.current.scrollHeight,
        behavior: "smooth",
      });
  }, [history.length, review]);
  useEffect(() => {
    hintWorker.current?.terminate();
    setHintThinking(false);
    setHint(null);
    return () => hintWorker.current?.terminate();
  }, [fen, paused, result]);

  function commitMove(from: string, to: string, promote: string = "q") {
    if (result || paused) return;
    const before = currentClocks();
    if (config.minutes && active && before[chess.turn()] <= 0) {
      updateClocks(before);
      setResult(timeoutResult(chess, chess.turn()));
      return;
    }
    try {
      const move = chess.move({ from, to, promotion: promote });
      clockHistory.current.push({ ...before });
      if (config.minutes) before[move.color] += config.increment * 1000;
      updateClocks(before);
      setSelected(null);
      setPromotion(null);
      setHint(null);
      setReview(null);
      setResult(automaticResult(chess));
      setRevision((v) => v + 1);
      audio.current?.move(
        move.piece,
        Boolean(move.captured),
        flipped ? 7 - (move.to.charCodeAt(0) - 97) : move.to.charCodeAt(0) - 97,
        view3d,
        pieceSet === "noir"
          ? "metal"
          : pieceSet === "modern"
            ? "stone"
            : "wood",
      );
    } catch {
      notify("Dieser Zug ist nicht möglich. Wähle ein markiertes Feld.");
    }
  }
  const commitRef = useRef(commitMove);
  commitRef.current = commitMove;
  useEffect(() => {
    if (
      config.mode !== "computer" ||
      chess.turn() === config.color ||
      result ||
      paused ||
      review !== null
    ) {
      setThinking(false);
      return;
    }
    const worker = new Worker(
      new URL("./game/engine.worker.ts", import.meta.url),
      { type: "module" },
    );
    setThinking(true);
    const started = performance.now();
    let timer: ReturnType<typeof setTimeout>;
    worker.onmessage = (e) => {
      timer = setTimeout(
        () => {
          setThinking(false);
          if (e.data.move)
            commitRef.current(
              e.data.move.from,
              e.data.move.to,
              e.data.move.promotion,
            );
          else {
            setPaused(true);
            notify(
              "Die Engine wurde angehalten. Mit Fortsetzen erneut versuchen.",
            );
          }
        },
        Math.max(0, 400 - (performance.now() - started)),
      );
    };
    worker.onerror = () => {
      setThinking(false);
      setPaused(true);
      notify("Die Engine konnte nicht starten. Bitte die Partie fortsetzen.");
    };
    worker.postMessage({ fen, level: config.level });
    return () => {
      worker.terminate();
      clearTimeout(timer);
    };
  }, [
    fen,
    config.mode,
    config.color,
    config.level,
    result,
    paused,
    review,
    chess,
    notify,
  ]);

  function chooseSquare(square: Square) {
    if (!canPlay) return;
    if (selected === square) {
      setSelected(null);
      return;
    }
    if (selected && legal.some((m) => m.to === square)) {
      if (legal.some((m) => m.to === square && m.promotion))
        setPromotion({ from: selected, to: square });
      else commitMove(selected, square);
      return;
    }
    const piece = chess.get(square);
    setSelected(piece?.color === chess.turn() ? square : null);
  }
  function dropMove(from: Square, to: Square) {
    if (!canPlay) return;
    const moves = chess
      .moves({ square: from, verbose: true })
      .filter((m) => m.to === to);
    if (!moves.length) return;
    if (moves.some((m) => m.promotion)) setPromotion({ from, to });
    else commitMove(from, to);
  }
  function undo() {
    if (!history.length) return;
    let count =
      config.mode === "computer" &&
      chess.turn() === config.color &&
      history.length > 1
        ? 2
        : 1;
    let previous = clocksRef.current;
    while (count-- > 0 && chess.history().length) {
      chess.undo();
      previous = clockHistory.current.pop() ?? previous;
    }
    updateClocks(previous);
    setResult(automaticResult(chess));
    setSelected(null);
    setReview(null);
    setHint(null);
    setPromotion(null);
    setArchive((prev) => {
      const next = prev.filter((g) => g.id !== gameId);
      writeStorage("atelier-archive", next);
      return next;
    });
    setRevision((v) => v + 1);
  }
  function startGame(nextConfig: Config) {
    chess.reset();
    setConfig(nextConfig);
    setDraft(nextConfig);
    setGameId(crypto.randomUUID());
    setResult(null);
    setPaused(false);
    setSelected(null);
    setPromotion(null);
    setHint(null);
    setReview(null);
    clockHistory.current = [];
    updateClocks({
      w: nextConfig.minutes * 60000,
      b: nextConfig.minutes * 60000,
    });
    setFlipped(nextConfig.color === "b");
    setModal(null);
    setRevision((v) => v + 1);
  }
  function requestHint() {
    if (!canPlay || hintThinking) return;
    const worker = new Worker(
      new URL("./game/engine.worker.ts", import.meta.url),
      { type: "module" },
    );
    hintWorker.current = worker;
    setHintThinking(true);
    worker.onmessage = (e) => {
      setHintThinking(false);
      if (e.data.move) {
        setHint(e.data.move);
        setSelected(e.data.move.from);
        notify(`Tipp: ${e.data.move.from} → ${e.data.move.to}`);
      } else notify("Kein Tipp verfügbar.");
      worker.terminate();
    };
    worker.onerror = () => {
      setHintThinking(false);
      notify("Der Tipp konnte nicht berechnet werden.");
      worker.terminate();
    };
    worker.postMessage({ fen, level: 2 });
  }
  function exportPgn() {
    download(
      annotatedPgn(chess, config, result),
      `atelier-${new Date().toISOString().slice(0, 10)}.pgn`,
    );
    notify("Partie als PGN exportiert.");
  }
  function importPgn() {
    try {
      const next = new Chess();
      next.loadPgn(importText.trim());
      if (!importText.trim()) throw Error();
      chess.loadPgn(next.pgn());
      const nextConfig: Config = {
        ...config,
        mode: "local",
        minutes: 0,
        increment: 0,
      };
      setConfig(nextConfig);
      setDraft(nextConfig);
      setGameId(crypto.randomUUID());
      const importedResult = next.getHeaders().Result;
      setResult(
        automaticResult(chess) ??
          (importedResult === "1-0"
            ? { winner: "w", reason: "Ergebnis aus PGN" }
            : importedResult === "0-1"
              ? { winner: "b", reason: "Ergebnis aus PGN" }
              : importedResult === "1/2-1/2"
                ? { winner: null, reason: "Ergebnis aus PGN" }
                : null),
      );
      setPaused(false);
      setReview(null);
      setSelected(null);
      clockHistory.current = [];
      updateClocks({ w: 0, b: 0 });
      setModal(null);
      setRevision((v) => v + 1);
      notify("Partie importiert. Du kannst zu zweit weiterspielen.");
    } catch {
      setImportError(
        "Die PGN-Datei ist ungültig. Bitte prüfe die Schachnotation.",
      );
    }
  }
  function togglePause() {
    updateClocks(currentClocks());
    setPaused((v) => !v);
    setSelected(null);
  }
  const playerName = (color: Color) =>
    config.mode === "computer"
      ? color === config.color
        ? "Du"
        : "Atelier Computer"
      : `Spieler ${labelColor(color)}`;
  const playerDetail = (color: Color) =>
    config.mode === "computer" && color !== config.color
      ? LEVELS[config.level].name
      : config.mode === "local"
        ? "Lokales Spiel"
        : "Dein nächster guter Zug.";
  function captured(color: Color) {
    return history
      .slice(0, review ?? history.length)
      .filter((move) => move.color === color && move.captured)
      .map((move) => move.captured!)
      .sort((a, b) => "qrbnp".indexOf(a) - "qrbnp".indexOf(b));
  }
  function playerBar(color: Color) {
    const isTurn = chess.turn() === color && !result;
    return (
      <div className={`player-row ${isTurn ? "is-turn" : ""}`}>
        <div
          className={`avatar ${color === "w" ? "white-avatar" : "black-avatar"}`}
        >
          {config.mode === "computer" && color !== config.color ? (
            <Monitor size={22} />
          ) : (
            <Piece type="k" color={color} set={pieceSet} />
          )}
        </div>
        <div className="player-copy">
          <div className="player-name">
            {playerName(color)}{" "}
            <span className={`color-tag ${color}`}>{labelColor(color)}</span>
            {isTurn && <i className="turn-dot" />}
          </div>
          <div className="player-detail">
            {thinking && isTurn ? (
              <span className="thinking-text">
                Denkt nach<span className="dots">…</span>
              </span>
            ) : (
              playerDetail(color)
            )}
          </div>
          <div className="captured">
            {captured(color).map((p, i) => (
              <Piece
                key={i}
                type={p}
                color={color === "w" ? "b" : "w"}
                set={pieceSet}
              />
            ))}
          </div>
        </div>
        <div
          className={`clock ${isTurn && active && !paused ? "running" : ""} ${config.minutes && clocks[color] < 30000 ? "low-time" : ""}`}
        >
          <Clock3 size={15} />
          {config.minutes ? (
            clockText(clocks[color])
          ) : (
            <span className="infinity">∞</span>
          )}
        </div>
      </div>
    );
  }
  const gamesAgainstComputer = archive.filter(
    (g) => g.config.mode === "computer",
  );
  const wins = gamesAgainstComputer.filter(
    (g) => g.result.winner === g.config.color,
  ).length;
  const draws = gamesAgainstComputer.filter((g) => !g.result.winner).length;
  const boardStatus = result
    ? resultText(result)
    : paused
      ? "Partie pausiert"
      : review !== null
        ? `Stellung nach Halbzug ${review}`
        : chess.isCheck()
          ? `${labelColor(chess.turn())} steht im Schach`
          : thinking
            ? "Der Computer denkt nach"
            : `${labelColor(chess.turn())} ist am Zug`;

  return (
    <div
      className="app"
      style={
        {
          "--board-light": theme.light,
          "--board-dark": theme.dark,
          "--accent": theme.accent,
        } as CSSProperties
      }
    >
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Atelier Schach Startseite">
          <span className="brand-mark">
            a<span>♟</span>
          </span>
          <span>
            atelier<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="sidebar-label">DEIN SCHACHRAUM</div>
        <nav>
          <button className="nav-item active" onClick={() => setModal(null)}>
            <Swords size={19} /> Spielen <span className="nav-indicator" />
          </button>
          <button
            className={`nav-item ${modal === "design" ? "selected" : ""}`}
            onClick={() => setModal("design")}
          >
            <Palette size={19} /> Brett & Figuren
          </button>
          <button
            className={`nav-item ${modal === "stats" ? "selected" : ""}`}
            onClick={() => setModal("stats")}
          >
            <BarChart3 size={19} /> Deine Statistik
          </button>
        </nav>
        <div className="sidebar-note">
          <div className="note-line" />
          <span className="note-symbol">♘</span>
          <p>
            Ein Brett.
            <br />
            Unendliche Möglichkeiten.
          </p>
          <span>Mach deinen nächsten Zug.</span>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setModal("help")}>
            <CircleHelp size={18} /> So funktioniert’s
          </button>
          <div className="local-status">
            <span /> Lokal. Privat. Dein Spiel.
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Dein Schachraum <ChevronRight size={14} />
            <span>Spielen</span>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <span /> Lokal bereit
            </span>
            <button
              className="icon-button"
              aria-label={sound ? "Ton ausschalten" : "Ton einschalten"}
              title={sound ? "Ton ausschalten" : "Ton einschalten"}
              onClick={() => setSound((v) => !v)}
            >
              {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label="Klang und Musik einstellen"
              title="Klang und Musik"
              onClick={() => setModal("audio")}
            >
              <AudioLines size={18} />
            </button>
            <div className="user-monogram">DU</div>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> ZEIT FÜR EINEN GUTEN ZUG
              </div>
              <h1>
                Dein Platz am Brett<span>.</span>
              </h1>
              <p>Einfach spielen. Neues entdecken. Besser werden.</p>
            </div>
            <button
              className="primary-button new-game-top"
              onClick={() => {
                setDraft(config);
                setModal("new");
              }}
            >
              <Plus size={18} /> Neue Partie
            </button>
          </div>
          <div className={`game-layout ${view3d ? "immersive-layout" : ""}`}>
            <section className="board-section" aria-label="Schachtisch">
              <div className="table-heading">
                <span>
                  <span className="live-dot" />{" "}
                  {config.mode === "computer"
                    ? "Gegen den Computer"
                    : "Zu zweit am Brett"}
                </span>
                <div className="view-switch" aria-label="Brettansicht">
                  <button
                    className={view3d ? "active" : ""}
                    aria-pressed={view3d}
                    onClick={() => setView3d(true)}
                  >
                    <Box size={13} /> 3D
                  </button>
                  <button
                    className={!view3d ? "active" : ""}
                    aria-pressed={!view3d}
                    onClick={() => setView3d(false)}
                  >
                    <Grid2X2 size={13} /> 2D
                  </button>
                </div>
                <span className="time-summary">
                  {config.minutes
                    ? `${config.minutes} + ${config.increment}`
                    : "Ohne Zeitdruck"}{" "}
                  <ChevronDown size={13} />
                </span>
              </div>
              {playerBar(topColor)}
              {view3d ? (
                <div className="three-board-wrap">
                  <Suspense
                    fallback={
                      <div className="scene-loading">
                        <Box size={26} />
                        <span>Dein Schachtisch wird aufgebaut …</span>
                      </div>
                    }
                  >
                    <ChessBoard3D
                      key={gameId}
                      fen={viewing.fen()}
                      selected={review === null ? selected : null}
                      legal={legal.map((m) => m.to)}
                      showLegal={showLegal}
                      lastMove={lastMove}
                      hint={hint}
                      flipped={flipped}
                      set={pieceSet}
                      light={theme.light}
                      dark={theme.dark}
                      canPlay={canPlay}
                      onSquare={chooseSquare}
                      onDrop={dropMove}
                      onInteract={() => {
                        void audio.current?.unlock();
                      }}
                      onFallback={() => {
                        setView3d(false);
                        notify(
                          "Die 2D-Ansicht ist bereit. Dein Spiel geht weiter.",
                        );
                      }}
                    />
                  </Suspense>
                  {paused && !result && (
                    <div className="board-pause studio-pause">
                      <button onClick={togglePause}>
                        <Play size={27} />
                        <strong>Dein Brett wartet.</strong>
                        <span>Partie fortsetzen</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="board-and-evaluation">
                  <div
                    className="eval-track"
                    aria-label={`Materialbewertung: ${evaluation.toFixed(1)} für Weiß`}
                    title="Orientierung anhand von Material und Figurenstellung"
                  >
                    <div style={{ height: `${50 + evaluation * 3.5}%` }} />
                    <span>{Math.abs(evaluation).toFixed(1)}</span>
                  </div>
                  <div className="board-frame">
                    <div className="ranks">
                      {Array.from({ length: 8 }, (_, i) => (
                        <span key={i}>{flipped ? i + 1 : 8 - i}</span>
                      ))}
                    </div>
                    <div
                      className="chessboard"
                      role="group"
                      aria-label="Schachbrett"
                    >
                      <div className="board-grid">
                        {Array.from({ length: 64 }, (_, i) => {
                          const col = flipped ? 7 - (i % 8) : i % 8,
                            row = flipped
                              ? Math.floor(i / 8)
                              : 7 - Math.floor(i / 8);
                          const square = `${FILES[col]}${row + 1}` as Square,
                            piece = viewing.get(square);
                          const isLegal = legal.some((m) => m.to === square);
                          const isCheck =
                            piece?.type === "k" &&
                            piece.color === viewing.turn() &&
                            viewing.isCheck();
                          return (
                            <button
                              key={square}
                              data-square={square}
                              className={`square ${(col + row) % 2 === 0 ? "dark" : "light"} ${lastMove && (lastMove.from === square || lastMove.to === square) ? "last-move" : ""} ${selected === square && review === null ? "selected-square" : ""} ${hint && (hint.from === square || hint.to === square) ? "hint-square" : ""} ${isCheck ? "check-square" : ""}`}
                              aria-label={`${square}${piece ? `, ${labelColor(piece.color)} ${PIECE_NAMES[piece.type]}` : ", leer"}${isLegal ? ", möglicher Zug" : ""}`}
                              aria-pressed={selected === square}
                              onClick={() => chooseSquare(square)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const from =
                                  e.dataTransfer.getData("text/plain");
                                if (/^[a-h][1-8]$/.test(from))
                                  dropMove(from as Square, square);
                              }}
                            >
                              <span
                                className="square-inner"
                                draggable={Boolean(
                                  piece &&
                                  canPlay &&
                                  piece.color === chess.turn(),
                                )}
                                onDragStart={(e) => {
                                  if (
                                    !piece ||
                                    !canPlay ||
                                    piece.color !== chess.turn()
                                  ) {
                                    e.preventDefault();
                                    return;
                                  }
                                  setSelected(square);
                                  e.dataTransfer.setData("text/plain", square);
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                              >
                                {piece && (
                                  <Piece
                                    type={piece.type}
                                    color={piece.color}
                                    set={pieceSet}
                                  />
                                )}
                              </span>
                              {isLegal && showLegal && (
                                <span
                                  className={`legal-marker ${piece ? "capture-marker" : ""}`}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {paused && !result && (
                        <div className="board-pause">
                          <button onClick={togglePause}>
                            <Play size={27} />
                            <strong>Dein Brett wartet.</strong>
                            <span>Partie fortsetzen</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="files">
                      {Array.from(flipped ? "hgfedcba" : FILES).map((f) => (
                        <span key={f}>{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {playerBar(bottomColor)}
              <div className="board-toolbar">
                <div className="board-status" aria-live="polite">
                  <span className={result ? "finished-dot" : "live-dot"} />
                  {boardStatus}
                </div>
                <div className="board-tools">
                  <button
                    className="icon-button"
                    title="Brett drehen"
                    aria-label="Brett drehen"
                    onClick={() => setFlipped((v) => !v)}
                  >
                    <FlipVertical2 size={18} />
                  </button>
                  <button
                    className="icon-button"
                    title="Zug zurücknehmen"
                    aria-label="Zug zurücknehmen"
                    disabled={!history.length}
                    onClick={undo}
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button
                    className={`icon-button ${hint ? "tool-active" : ""}`}
                    title="Zugtipp anzeigen"
                    aria-label="Zugtipp anzeigen"
                    onClick={requestHint}
                    disabled={!canPlay || hintThinking}
                  >
                    <Lightbulb size={18} />
                  </button>
                  <span className="tool-divider" />
                  <button
                    className="icon-button"
                    title="Design anpassen"
                    aria-label="Design anpassen"
                    onClick={() => setModal("design")}
                  >
                    <Settings2 size={18} />
                  </button>
                </div>
              </div>
              <div className="board-caption">
                <span>
                  {view3d
                    ? "Figur klicken oder ziehen · Hintergrund ziehen: Kamera · Scrollen: Zoom"
                    : "Klicken oder ziehen – du entscheidest."}
                </span>
                <button
                  className="sound-caption"
                  onClick={() => setModal("audio")}
                >
                  <AudioLines size={13} /> Klang & Musik
                </button>
              </div>
            </section>
            <aside className="game-panel">
              <div className="opponent-panel">
                <div className="section-eyebrow">DEIN SPIEL</div>
                <div className="opponent-heading">
                  <div className="opponent-icon">
                    {config.mode === "computer" ? (
                      <Monitor size={24} />
                    ) : (
                      <Users size={24} />
                    )}
                  </div>
                  <div>
                    <h2>
                      {config.mode === "computer"
                        ? "Ein guter Gegenspieler."
                        : "Geteiltes Brett. Doppelter Spaß."}
                    </h2>
                    <p>
                      {config.mode === "computer"
                        ? "Eine neue Herausforderung. In deinem Tempo."
                        : "Zwei Menschen. Ein gemeinsames Spiel."}
                    </p>
                  </div>
                </div>
                <label className="field-label" htmlFor="difficulty">
                  {config.mode === "computer"
                    ? "Schwierigkeitsgrad"
                    : "Spielmodus"}
                </label>
                {config.mode === "computer" ? (
                  <div className="select-wrap">
                    <select
                      id="difficulty"
                      value={config.level}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          level: Number(e.target.value),
                        }))
                      }
                    >
                      {LEVELS.map((l, i) => (
                        <option key={l.name} value={i}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                    <div className="difficulty-bars">
                      {[0, 1, 2, 3].map((i) => (
                        <i
                          key={i}
                          className={i <= config.level ? "filled" : ""}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    id="difficulty"
                    className="mode-summary"
                    onClick={() => {
                      setDraft(config);
                      setModal("new");
                    }}
                  >
                    <Users size={16} /> Zu zweit an diesem Gerät{" "}
                    <ChevronDown size={15} />
                  </button>
                )}
                <div className="opponent-meta">
                  <span>
                    <span className="live-dot" />
                    {config.mode === "computer"
                      ? "Bereit, wenn du es bist"
                      : "Gemeinsam am selben Gerät"}
                  </span>
                  <span>
                    {config.minutes ? (
                      <>
                        <Clock3 size={13} /> {config.minutes} +{" "}
                        {config.increment}
                      </>
                    ) : (
                      "∞ Zeit"
                    )}
                  </span>
                </div>
              </div>
              <div className="notation-panel">
                <div className="panel-tabs">
                  <button
                    className={tab === "moves" ? "active" : ""}
                    onClick={() => setTab("moves")}
                  >
                    Zugverlauf <span>{history.length}</span>
                  </button>
                  <button
                    className={tab === "info" ? "active" : ""}
                    onClick={() => setTab("info")}
                  >
                    Partie-Info
                  </button>
                  <button
                    className="icon-button"
                    title="PGN exportieren"
                    aria-label="PGN exportieren"
                    onClick={exportPgn}
                  >
                    <ArrowDownToLine size={16} />
                  </button>
                </div>
                {tab === "moves" ? (
                  <>
                    <div className="move-column-head">
                      <span>#</span>
                      <span>Weiß</span>
                      <span>Schwarz</span>
                    </div>
                    <div className="move-list" ref={moveListRef}>
                      {!history.length ? (
                        <div className="empty-moves">
                          <div className="empty-board-icon">
                            <Swords size={29} />
                          </div>
                          <strong>
                            Jede Partie beginnt
                            <br />
                            mit einer Möglichkeit.
                          </strong>
                          <p>
                            {config.mode === "computer" && config.color === "b"
                              ? "Der Computer eröffnet die Partie."
                              : "Mach deinen ersten Zug."}
                          </p>
                          <span>Wie wäre es mit e2 → e4?</span>
                        </div>
                      ) : (
                        Array.from(
                          { length: Math.ceil(history.length / 2) },
                          (_, index) => (
                            <div className="move-row" key={index}>
                              <span>{index + 1}.</span>
                              {[index * 2, index * 2 + 1].map((ply) => (
                                <button
                                  key={ply}
                                  disabled={!history[ply]}
                                  className={
                                    (
                                      review === null
                                        ? ply === history.length - 1
                                        : ply + 1 === review
                                    )
                                      ? "current-move"
                                      : ""
                                  }
                                  onClick={() => {
                                    setReview(
                                      ply + 1 === history.length
                                        ? null
                                        : ply + 1,
                                    );
                                    setSelected(null);
                                  }}
                                >
                                  {history[ply] && (
                                    <>
                                      <Piece
                                        type={history[ply].piece}
                                        color={history[ply].color}
                                        set="modern"
                                      />
                                      <span>{history[ply].san}</span>
                                    </>
                                  )}
                                </button>
                              ))}
                            </div>
                          ),
                        )
                      )}
                    </div>
                    <div className="history-controls">
                      <button
                        className="icon-button"
                        aria-label="Zur Anfangsstellung"
                        disabled={!history.length}
                        onClick={() => {
                          setReview(0);
                          setSelected(null);
                        }}
                      >
                        <ChevronsLeft size={19} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Vorheriger Zug"
                        disabled={!history.length || review === 0}
                        onClick={() => {
                          setReview(
                            Math.max(0, (review ?? history.length) - 1),
                          );
                          setSelected(null);
                        }}
                      >
                        <ChevronLeft size={19} />
                      </button>
                      <span>
                        {review !== null ? (
                          <button
                            className="back-live"
                            onClick={() => setReview(null)}
                          >
                            Zur Live-Partie
                          </button>
                        ) : (
                          "Zug für Zug"
                        )}
                      </span>
                      <button
                        className="icon-button"
                        aria-label="Nächster Zug"
                        disabled={review === null}
                        onClick={() =>
                          setReview(
                            review !== null && review + 1 < history.length
                              ? review + 1
                              : null,
                          )
                        }
                      >
                        <ChevronRight size={19} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Aktuelle Stellung"
                        disabled={review === null}
                        onClick={() => setReview(null)}
                      >
                        <ChevronsRight size={19} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="game-info">
                    <h3>Alles zu deiner Partie</h3>
                    <dl>
                      <div>
                        <dt>Modus</dt>
                        <dd>
                          {config.mode === "computer"
                            ? "Computer"
                            : "Zwei Spieler"}
                        </dd>
                      </div>
                      <div>
                        <dt>Zeitkontrolle</dt>
                        <dd>
                          {config.minutes
                            ? `${config.minutes} Min. + ${config.increment} Sek.`
                            : "Unbegrenzt"}
                        </dd>
                      </div>
                      <div>
                        <dt>Gespielte Halbzüge</dt>
                        <dd>{history.length}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>
                          {result
                            ? resultText(result)
                            : paused
                              ? "Pausiert"
                              : "Laufend"}
                        </dd>
                      </div>
                      <div>
                        <dt>Regeln</dt>
                        <dd>Klassisches Schach</dd>
                      </div>
                    </dl>
                    <p>
                      Deine Partie wird automatisch in diesem Browser
                      gespeichert.
                    </p>
                    <button
                      className="secondary-button full"
                      onClick={() => {
                        setImportText("");
                        setImportError("");
                        setModal("import");
                      }}
                    >
                      <Upload size={16} /> PGN importieren
                    </button>
                  </div>
                )}
              </div>
              {result ? (
                <div className="result-panel" role="status">
                  <Trophy size={25} />
                  <h3>{resultText(result)}</h3>
                  <p>{result.reason}</p>
                  <button
                    className="primary-button full"
                    onClick={() => {
                      setDraft(config);
                      setModal("new");
                    }}
                  >
                    Noch eine Partie <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="game-actions">
                  <button disabled={!active} onClick={togglePause}>
                    {paused ? <Play size={16} /> : <Pause size={16} />}{" "}
                    {paused ? "Fortsetzen" : "Pause"}
                  </button>
                  <button
                    disabled={!active || thinking || review !== null}
                    onClick={() => setModal("draw")}
                  >
                    <Handshake size={17} /> Remis
                  </button>
                  <button
                    disabled={!active || thinking || review !== null}
                    onClick={() => setModal("resign")}
                  >
                    <Flag size={16} /> Aufgeben
                  </button>
                </div>
              )}
              <button
                className="design-teaser"
                onClick={() => setModal("design")}
              >
                <span className="mini-board">
                  {Array.from({ length: 9 }, (_, i) => (
                    <i
                      key={i}
                      style={{ background: i % 2 ? theme.dark : theme.light }}
                    />
                  ))}
                </span>
                <span>
                  <strong>Dein Brett. Dein Stil.</strong>
                  <small>Farben & Figuren entdecken</small>
                </span>
                <ArrowUpRight size={18} />
              </button>
            </aside>
          </div>
          <footer className="page-footer">
            <span>
              <span className="small-brand">atelier.</span> Raum für deinen
              nächsten Zug.
            </span>
            <span>
              Für die Freude am Spiel. <span className="footer-spark">✳</span>
            </span>
          </footer>
        </main>
      </div>

      {modal === "new" && (
        <Modal title="Eine neue Partie." close={() => setModal(null)}>
          <p className="modal-intro">Dein Gegner. Dein Tempo. Dein Spiel.</p>
          {active && (
            <div className="inline-notice">
              Die laufende Partie wird ersetzt. Du kannst sie vorher über die
              Zugliste als PGN exportieren.
            </div>
          )}
          <div className="segmented">
            <button
              className={draft.mode === "computer" ? "active" : ""}
              onClick={() => setDraft((d) => ({ ...d, mode: "computer" }))}
            >
              <Monitor size={18} /> Gegen Computer
            </button>
            <button
              className={draft.mode === "local" ? "active" : ""}
              onClick={() => setDraft((d) => ({ ...d, mode: "local" }))}
            >
              <Users size={18} /> Zu zweit
            </button>
          </div>
          {draft.mode === "computer" && (
            <>
              <label className="field-label">Deine Farbe</label>
              <div className="color-options">
                {(["w", "b"] as Color[]).map((color) => (
                  <button
                    key={color}
                    className={draft.color === color ? "chosen" : ""}
                    onClick={() => setDraft((d) => ({ ...d, color }))}
                  >
                    <Piece type="k" color={color} set={pieceSet} />
                    {labelColor(color)}
                    {draft.color === color && <Check size={16} />}
                  </button>
                ))}
              </div>
              <label className="field-label" htmlFor="new-level">
                Schwierigkeitsgrad
              </label>
              <select
                id="new-level"
                value={draft.level}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, level: Number(e.target.value) }))
                }
              >
                {LEVELS.map((l, i) => (
                  <option value={i} key={i}>
                    {l.name}
                  </option>
                ))}
              </select>
              <p className="field-help">{LEVELS[draft.level].description}</p>
            </>
          )}
          <label className="field-label" htmlFor="time-control">
            Bedenkzeit pro Person
          </label>
          <select
            id="time-control"
            value={draft.minutes}
            onChange={(e) =>
              setDraft((d) => ({ ...d, minutes: Number(e.target.value) }))
            }
          >
            {[0, 3, 5, 10, 15, 30].map((time) => (
              <option key={time} value={time}>
                {time ? `${time} Minuten` : "Ohne Zeitdruck"}
              </option>
            ))}
          </select>
          {draft.minutes > 0 && (
            <>
              <label className="field-label" htmlFor="increment">
                Zeitbonus pro Zug
              </label>
              <select
                id="increment"
                value={draft.increment}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, increment: Number(e.target.value) }))
                }
              >
                {[0, 2, 3, 5, 10].map((inc) => (
                  <option key={inc} value={inc}>
                    {inc} Sekunden
                  </option>
                ))}
              </select>
            </>
          )}
          <button
            className="primary-button full modal-primary"
            onClick={() => startGame(draft)}
          >
            <Play size={17} /> Partie starten
          </button>
        </Modal>
      )}
      {modal === "design" && (
        <Modal title="Dein Brett. Dein Stil." close={() => setModal(null)} wide>
          <p className="modal-intro">
            Ein kleiner Atelierbesuch für deinen Schachtisch.
          </p>
          <div className="design-editor">
            <div className="design-preview">
              <div className="preview-board">
                {Array.from({ length: 16 }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      background:
                        (Math.floor(i / 4) + (i % 4)) % 2
                          ? theme.dark
                          : theme.light,
                    }}
                  >
                    {[0, 1, 2, 3, 12, 13, 14, 15].includes(i) && (
                      <Piece
                        type={(["r", "n", "b", "k"] as PieceSymbol[])[i % 4]}
                        color={i < 4 ? "b" : "w"}
                        set={pieceSet}
                      />
                    )}
                  </div>
                ))}
              </div>
              <span>Deine persönliche Kombination</span>
            </div>
            <div>
              <h3>Brettfarben</h3>
              <div className="theme-options">
                {THEMES.map((t) => (
                  <button
                    key={t.name}
                    className={theme.name === t.name ? "chosen" : ""}
                    onClick={() => setTheme(t)}
                  >
                    <span
                      className="theme-swatch"
                      style={{
                        background: `linear-gradient(135deg, ${t.light} 50%, ${t.dark} 50%)`,
                      }}
                    />
                    {t.name}
                    {theme.name === t.name && <Check size={14} />}
                  </button>
                ))}
              </div>
              <div className="custom-colors">
                <label>
                  Helle Felder
                  <input
                    type="color"
                    value={theme.light}
                    onChange={(e) =>
                      setTheme((t) => ({
                        ...t,
                        name: "Individuell",
                        light: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Dunkle Felder
                  <input
                    type="color"
                    value={theme.dark}
                    onChange={(e) =>
                      setTheme((t) => ({
                        ...t,
                        name: "Individuell",
                        dark: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <h3>Figurenset</h3>
              <div className="piece-options">
                {(["atelier", "noir", "modern"] as PieceSet[]).map((set) => (
                  <button
                    className={pieceSet === set ? "chosen" : ""}
                    onClick={() => setPieceSet(set)}
                    key={set}
                  >
                    <span>
                      <Piece type="n" color="b" set={set} />
                      <Piece type="k" color="w" set={set} />
                    </span>
                    <strong>
                      {set === "atelier"
                        ? "Atelier"
                        : set === "noir"
                          ? "Noir"
                          : "Modern"}
                    </strong>
                    <small>
                      {set === "atelier"
                        ? "Warm & strukturiert"
                        : set === "noir"
                          ? "Kühl & elegant"
                          : "Klar & reduziert"}
                    </small>
                  </button>
                ))}
              </div>
              <label className="toggle-row">
                <span>Mögliche Züge anzeigen</span>
                <input
                  type="checkbox"
                  checked={showLegal}
                  onChange={(e) => setShowLegal(e.target.checked)}
                />
              </label>
              <label className="toggle-row">
                <span>Ton aktiv</span>
                <input
                  type="checkbox"
                  checked={sound}
                  onChange={(e) => setSound(e.target.checked)}
                />
              </label>
              <button
                className="text-button"
                onClick={() => {
                  setTheme(THEMES[0]);
                  setPieceSet("atelier");
                  setShowLegal(true);
                  setSound(true);
                }}
              >
                Design zurücksetzen
              </button>
            </div>
          </div>
          <button
            className="primary-button modal-primary"
            onClick={() => setModal(null)}
          >
            <Check size={17} /> Genau mein Stil
          </button>
        </Modal>
      )}
      {modal === "audio" && (
        <Modal title="Der Klang deines Spiels." close={() => setModal(null)}>
          <p className="modal-intro">
            Gewicht, Holz und ein wenig Ruhe im Hintergrund.
          </p>
          <div className="audio-settings">
            <label className="toggle-row">
              <span>
                <Volume2 size={17} /> Ton aktiv
              </span>
              <input
                type="checkbox"
                checked={sound}
                onChange={(e) => setSound(e.target.checked)}
              />
            </label>
            {(
              [
                ["master", "Gesamtlautstärke"],
                ["effects", "Figuren & Spielgeräusche"],
                ["music", "Musiklautstärke"],
              ] as const
            ).map(([key, label]) => (
              <label className="audio-slider" key={key}>
                <span>
                  {label}
                  <output>{Math.round(audioSettings[key] * 100)} %</output>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  aria-label={label}
                  value={Math.round(audioSettings[key] * 100)}
                  onChange={(e) =>
                    setAudioSettings((a) => ({
                      ...a,
                      [key]: Number(e.target.value) / 100,
                    }))
                  }
                />
              </label>
            ))}
            <label className="toggle-row">
              <span>
                <Music2 size={17} /> Hintergrundmusik
              </span>
              <input
                type="checkbox"
                checked={audioSettings.musicOn}
                onChange={(e) =>
                  setAudioSettings((a) => ({ ...a, musicOn: e.target.checked }))
                }
              />
            </label>
            <p className="audio-note">
              Eine ruhige, eigens erzeugte Klavierfolge. Ohne Downloads. Musik
              und Effekte werden mit deinen Einstellungen gespeichert.
            </p>
            <button
              className="secondary-button"
              disabled={
                !sound || !audioSettings.master || !audioSettings.effects
              }
              onClick={() =>
                audio.current?.preview(
                  pieceSet === "noir"
                    ? "metal"
                    : pieceSet === "modern"
                      ? "stone"
                      : "wood",
                )
              }
            >
              <Play size={15} /> Schweren Turm probehören
            </button>
          </div>
          <button
            className="primary-button modal-primary"
            onClick={() => setModal(null)}
          >
            <Check size={17} /> So klingt’s gut
          </button>
        </Modal>
      )}
      {modal === "stats" && (
        <Modal title="Dein Spiel in Zahlen." close={() => setModal(null)} wide>
          <p className="modal-intro">
            Deine letzten 200 abgeschlossenen Partien, lokal in diesem Browser.
          </p>
          <div className="stats-grid">
            <div>
              <span>Partien gesamt</span>
              <strong>{archive.length}</strong>
            </div>
            <div>
              <span>Siege gegen Computer</span>
              <strong>{wins}</strong>
            </div>
            <div>
              <span>Remis gegen Computer</span>
              <strong>{draws}</strong>
            </div>
            <div>
              <span>Siegquote gegen Computer</span>
              <strong>
                {gamesAgainstComputer.length
                  ? Math.round((wins / gamesAgainstComputer.length) * 100)
                  : 0}
                <small>%</small>
              </strong>
            </div>
          </div>
          <h3>Deine letzten Partien</h3>
          {!archive.length ? (
            <div className="empty-stats">
              <Trophy size={32} />
              <p>
                Deine Geschichte am Brett beginnt gerade.
                <br />
                Abgeschlossene Partien erscheinen hier.
              </p>
            </div>
          ) : (
            <div className="archive-list">
              {archive.map((g) => (
                <div key={g.id}>
                  <span className="archive-icon">
                    {g.config.mode === "computer" ? (
                      <Monitor size={18} />
                    ) : (
                      <Users size={18} />
                    )}
                  </span>
                  <div>
                    <strong>{resultText(g.result)}</strong>
                    <small>
                      {new Date(g.date).toLocaleDateString("de-DE")} ·{" "}
                      {g.config.mode === "computer"
                        ? LEVELS[g.config.level].name
                        : "Zu zweit"}{" "}
                      · {g.moves} Halbzüge
                    </small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Archivierte Partie exportieren"
                    onClick={() =>
                      download(g.pgn, `atelier-${g.id.slice(0, 8)}.pgn`)
                    }
                  >
                    <ArrowDownToLine size={17} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="Einfach ans Brett." close={() => setModal(null)}>
          <div className="help-content">
            <h3>Figuren bewegen</h3>
            <p>
              Klicke eine Figur und danach ihr Zielfeld an. Am Computer kannst
              du Figuren auch ziehen. Markierte Punkte zeigen legale Züge; ein
              Ring kennzeichnet einen möglichen Schlagzug.
            </p>
            <h3>Alle klassischen Regeln</h3>
            <p>
              Rochade, en passant und Bauernumwandlung sind dabei. Schachmatt,
              Patt, dreifache Stellungswiederholung, die 50-Züge-Regel und
              unzureichendes Material beenden die Partie automatisch.
            </p>
            <h3>Dein Spiel, dein Tempo</h3>
            <p>
              Wechsle die Computerstärke jederzeit. Die Glühbirne gibt einen
              Zugtipp. Mit dem Rückwärtspfeil nimmst du im Computerspiel deinen
              Zug und die Antwort zurück.
            </p>
            <h3>Partie anschauen & sichern</h3>
            <p>
              Die Zugliste lässt dich jede Stellung ansehen. Eine laufende Uhr
              läuft dabei weiter; nutze bei Bedarf Pause. PGN-Dateien kannst du
              exportieren und unter Partie-Info wieder importieren.
            </p>
            <h3>Gut zu wissen</h3>
            <p>
              „Zu zweit“ bedeutet gemeinsames Spielen an diesem Gerät. Partien
              und Designs werden im Browser gespeichert. Nach dem Neuladen setzt
              du eine gespeicherte Partie über „Fortsetzen“ fort. Der Computer
              ist eine lokale Suchengine mit vier Stufen, ohne feste
              Elo-Einstufung.
            </p>
          </div>
        </Modal>
      )}
      {(modal === "resign" || modal === "draw") && (
        <Modal
          title={
            modal === "resign" ? "Diese Partie aufgeben?" : "Auf Remis einigen?"
          }
          close={() => setModal(null)}
        >
          <p className="modal-intro">
            {modal === "resign"
              ? `${labelColor(config.mode === "computer" ? config.color : chess.turn())} gibt die Partie auf. Sie wird in deiner Statistik gespeichert.`
              : config.mode === "local"
                ? "Bestätigt nur, wenn beide Spieler mit dem Unentschieden einverstanden sind."
                : "Im Übungsmodus akzeptiert der Computer dein Remisangebot."}
          </p>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setModal(null)}>
              Weiterspielen
            </button>
            <button
              className="primary-button"
              onClick={() => {
                updateClocks(currentClocks());
                setResult(
                  modal === "draw"
                    ? { winner: null, reason: "Remis vereinbart" }
                    : {
                        winner:
                          (config.mode === "computer"
                            ? config.color
                            : chess.turn()) === "w"
                            ? "b"
                            : "w",
                        reason: "Aufgabe",
                      },
                );
                setModal(null);
              }}
            >
              {modal === "resign" ? "Aufgeben" : "Remis bestätigen"}
            </button>
          </div>
        </Modal>
      )}
      {modal === "import" && (
        <Modal title="Eine Partie mitbringen." close={() => setModal(null)}>
          <p className="modal-intro">
            Füge eine PGN ein oder öffne eine PGN-Datei. Sie ersetzt die
            aktuelle Partie und lässt sich im lokalen Modus fortsetzen.
          </p>
          <label className="file-upload">
            <Upload size={17} /> PGN-Datei auswählen
            <input
              type="file"
              accept=".pgn,.txt"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setImportText(await file.text());
                  setImportError("");
                }
              }}
            />
          </label>
          <label className="field-label" htmlFor="pgn-text">
            Schachnotation (PGN)
          </label>
          <textarea
            id="pgn-text"
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setImportError("");
            }}
            rows={7}
            placeholder="1. e4 e5 2. Nf3 Nc6 …"
          />
          {importError && (
            <p className="form-error" role="alert">
              {importError}
            </p>
          )}
          <button
            className="primary-button full modal-primary"
            disabled={!importText.trim()}
            onClick={importPgn}
          >
            Partie importieren <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {promotion && (
        <Modal
          title="Dein Bauer wird groß."
          close={() => {
            setPromotion(null);
            setSelected(null);
          }}
        >
          <p className="modal-intro">
            In welche Figur soll er sich verwandeln?
          </p>
          <div className="promotion-options">
            {(["q", "r", "b", "n"] as PieceSymbol[]).map((type) => (
              <button
                key={type}
                onClick={() => commitMove(promotion.from, promotion.to, type)}
              >
                <Piece type={type} color={chess.turn()} set={pieceSet} />
                <span>{PIECE_NAMES[type]}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            className="icon-button"
            aria-label="Hinweis schließen"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
