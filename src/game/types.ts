export type Cell = [number, number];

export type Clue = { r: number; c: number; n: number };

export type PieceRuntime = {
  id: number;
  cells: Cell[];
  row: number | null;
  col: number | null;
};

export type LevelData = {
  id: number;
  name?: string;
  rows: number;
  cols: number;
  clues: Clue[];
  pieces: Cell[][];
  solution: { row: number; col: number }[];
  tutorial?: boolean;
};

export type ClueState = Clue & { state: "empty" | "ok" | "bad"; size: number };

export type EvalResult = {
  cover: number[][][];
  filled: boolean;
  allPlaced: boolean;
  clueState: ClueState[];
  win: boolean;
};

export type PlayParams = {
  mode: "tutorial" | "pack" | "extra" | "daily";
  size?: number;
  levelId?: number;
};
