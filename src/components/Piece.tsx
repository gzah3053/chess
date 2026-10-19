import { useId } from "react";
import type { Color, PieceSymbol } from "chess.js";
export const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: "Bauer",
  n: "Springer",
  b: "Läufer",
  r: "Turm",
  q: "Dame",
  k: "König",
};
export type PieceSet = "atelier" | "noir" | "modern";
export function Piece({
  type,
  color,
  set = "atelier",
}: {
  type: PieceSymbol;
  color: Color;
  set?: PieceSet;
}) {
  const id = useId().replaceAll(":", "");
  const white = color === "w";
  const modern = set === "modern";
  const stroke = white ? "#78664c" : "#171d19";
  const light = white ? "#fffdf5" : set === "noir" ? "#747c88" : "#687063";
  const mid = white ? "#ede4cd" : set === "noir" ? "#303643" : "#353d31";
  const dark = white ? "#bca987" : "#1c241e";
  const shapes: Record<PieceSymbol, React.ReactNode> = {
    p: (
      <>
        <circle cx="40" cy="21" r="9" />
        <path d="M35 30h10l-2 10 6 15H31l6-15z" />
        <path d="M29 54h22l3 7H26z" />
      </>
    ),
    r: (
      <>
        <path d="M23 14h9v8h5v-8h7v8h5v-8h9v17l-9 6 2 19H29l2-19-8-6z" />
        <path d="M30 34h20M29 49h22" />
        <path d="M26 55h28l2 7H24z" />
      </>
    ),
    b: (
      <>
        <path d="M40 9c-2 8-15 13-15 23 0 8 7 12 15 12s15-4 15-12C55 22 42 17 40 9z" />
        <path d="m44 21-9 12" fill="none" strokeWidth="3" />
        <path d="M35 43h10l5 13H30z" />
        <path d="M27 55h26l3 7H24z" />
      </>
    ),
    n: (
      <>
        <path d="M28 55c-2-11 1-22 12-28l-11 3-8 9-9-6 9-16 15-6 4-7 6 8c17 7 19 22 11 43z" />
        <path d="m23 21 10-4M42 22c10 5 10 15 6 25M24 34l5 3" fill="none" />
        <circle cx="31" cy="22" r="2" fill={stroke} stroke="none" />
        <path d="M25 55h33l1 8H23z" />
      </>
    ),
    q: (
      <>
        <path d="m22 23 9 10 9-15 9 15 9-10-9 30H31z" />
        <circle cx="21" cy="20" r="4" />
        <circle cx="40" cy="14" r="4" />
        <circle cx="59" cy="20" r="4" />
        <path d="M29 44h22M31 50h18" />
        <path d="M28 54h24l4 9H24z" />
      </>
    ),
    k: (
      <>
        <path d="M37 7h6v7h7v6h-7v8h-6v-8h-7v-6h7z" />
        <path d="M40 30c-12-12-23-3-19 8l10 15h18l10-15c4-11-7-20-19-8z" />
        <path d="M29 45h22M31 50h18" />
        <path d="M28 54h24l4 9H24z" />
      </>
    ),
  };
  return (
    <svg
      className={`piece piece-${set}`}
      viewBox="0 0 80 80"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2=".35">
          <stop offset="0" stopColor={dark} />
          <stop offset=".28" stopColor={light} />
          <stop offset=".53" stopColor={mid} />
          <stop offset=".78" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <pattern
          id={`t${id}`}
          width="5"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M1 0Q4 4 1 8"
            fill="none"
            stroke={white ? "#8d6d40" : "#c0c5a2"}
            strokeOpacity=".08"
            strokeWidth=".6"
          />
        </pattern>
      </defs>
      <ellipse cx="40" cy="67" rx="24" ry="4" fill="#000" opacity=".16" />
      <g
        fill={modern ? (white ? "#fffcf0" : "#28392e") : `url(#g${id})`}
        stroke={stroke}
        strokeWidth={modern ? 2.5 : 1.35}
        strokeLinejoin="round"
      >
        {shapes[type]}
        <path d="M23 63h34l3 5H20z" />
      </g>
      {!modern && (
        <g fill={`url(#t${id})`} stroke="none" opacity=".65">
          {shapes[type]}
        </g>
      )}
      <path
        d="M25 65h30"
        stroke={white ? "#fffdf4" : "#a7af94"}
        strokeOpacity=".5"
        fill="none"
        strokeWidth="1"
      />
    </svg>
  );
}
