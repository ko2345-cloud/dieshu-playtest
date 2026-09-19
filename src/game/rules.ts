import { pieceAbs } from "./geometry";
import type { Clue, ClueState, EvalResult, PieceRuntime } from "./types";

function sigKey(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join(",");
}

export function coverage(
  pieces: PieceRuntime[],
  rows: number,
  cols: number,
  preview?: { id: number; row: number; col: number } | null,
): number[][][] {
  const cover: number[][][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => [] as number[]),
  );
  for (const p of pieces) {
    let row = p.row;
    let col = p.col;
    if (preview && preview.id === p.id) {
      row = preview.row;
      col = preview.col;
    }
    if (row == null || col == null) continue;
    for (const [r, c] of pieceAbs(p.cells, row, col)) {
      if (r >= 0 && c >= 0 && r < rows && c < cols) cover[r][c].push(p.id);
    }
  }
  return cover;
}

export function regionSize(
  cover: number[][][],
  sr: number,
  sc: number,
  rows: number,
  cols: number,
): number {
  const key = sigKey(cover[sr][sc]);
  const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
  const q: [number, number][] = [[sr, sc]];
  seen[sr][sc] = true;
  let n = 0;
  while (q.length) {
    const [r, c] = q.pop()!;
    n += 1;
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || seen[nr][nc]) continue;
      if (sigKey(cover[nr][nc]) !== key) continue;
      seen[nr][nc] = true;
      q.push([nr, nc]);
    }
  }
  return n;
}

export function evaluate(
  pieces: PieceRuntime[],
  rows: number,
  cols: number,
  clues: Clue[],
  preview?: { id: number; row: number; col: number } | null,
): EvalResult {
  const cover = coverage(pieces, rows, cols, preview);
  const filled = cover.every((row) => row.every((ids) => ids.length > 0));
  const allPlaced = pieces.every((p) => {
    if (preview && preview.id === p.id) return true;
    return p.row != null;
  });
  const clueState: ClueState[] = clues.map((clue) => {
    const ids = cover[clue.r]?.[clue.c] ?? [];
    if (!ids.length) return { ...clue, state: "empty", size: 0 };
    const size = regionSize(cover, clue.r, clue.c, rows, cols);
    return { ...clue, state: size === clue.n ? "ok" : "bad", size };
  });
  const cluesOk = clueState.every((c) => c.state === "ok");
  return {
    cover,
    filled,
    allPlaced,
    clueState,
    win: filled && allPlaced && cluesOk,
  };
}
