import type { Cell } from "./types";

export function normalize(cells: Cell[]): Cell[] {
  const mr = Math.min(...cells.map((c) => c[0]));
  const mc = Math.min(...cells.map((c) => c[1]));
  return cells
    .map(([r, c]) => [r - mr, c - mc] as Cell)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export function rotateCells(cells: Cell[]): Cell[] {
  return normalize(cells.map(([r, c]) => [c, -r]));
}

export function bbox(cells: Cell[]): { h: number; w: number } {
  return {
    h: Math.max(...cells.map((c) => c[0])) + 1,
    w: Math.max(...cells.map((c) => c[1])) + 1,
  };
}

export function pieceAbs(
  cells: Cell[],
  row: number | null,
  col: number | null,
): Cell[] {
  if (row == null || col == null) return [];
  return cells.map(([r, c]) => [row + r, col + c]);
}

export function fits(
  cells: Cell[],
  row: number,
  col: number,
  rows: number,
  cols: number,
): boolean {
  return cells.every(([r, c]) => {
    const rr = row + r;
    const cc = col + c;
    return rr >= 0 && cc >= 0 && rr < rows && cc < cols;
  });
}
