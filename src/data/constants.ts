import type { LevelCategory } from "@/game/types";

export const SIZES = [4, 5, 6, 7, 8] as const;
export type BoardSize = (typeof SIZES)[number];

export type { LevelCategory };

export const CATEGORY_LABEL: Record<LevelCategory, string> = {
  rect: "方型積木",
  tetro: "七型方塊",
};

/** Playtest pack size — regenerate more later once feel is locked. */
export const LEVELS_PER_SIZE = 5;
export const EXTRA_PER_SIZE = 5;
export const DAILY_FALLBACK = 5;
export const STARTER_HINTS = 5;
export const INTERSTITIAL_EVERY = 3;

/** How many pieces per size. Rectangles only, ≤ 20 cells. */
export const PIECE_RANGE: Record<number, [number, number]> = {
  4: [2, 5],
  5: [3, 6],
  6: [4, 7],
  7: [4, 8],
  8: [5, 9],
};

/** Tetrominoes are 4 cells. 8×8 starts at 18 so a piece can still slide into a decoy. */
export const TETRO_RANGE: Record<number, [number, number]> = {
  4: [5, 6],
  5: [7, 8],
  6: [10, 11],
  7: [13, 14],
  8: [18, 19],
};

/** Upper bound is 6 on every size. */
export const CLUE_RANGE: Record<number, [number, number]> = {
  4: [2, 5],
  5: [2, 6],
  6: [3, 6],
  7: [3, 6],
  8: [4, 6],
};

export const IAP = {
  hints5: { id: "hints_5", title: "5 個提示", amount: 5, price: "$0.99" },
  hints20: { id: "hints_20", title: "20 個提示", amount: 20, price: "$2.99" },
  hints100: { id: "hints_100", title: "100 個提示", amount: 100, price: "$9.99" },
  removeAds: { id: "remove_ads", title: "移除廣告", price: "$2.99" },
  extra: (size: number) => ({
    id: `extra_pack_${size}`,
    title: `Extra ${size}×${size}`,
    size,
    price: "$0.99",
  }),
  bundle: {
    id: "premium_bundle",
    title: "Remove Ads Pack",
    hints: 100,
    price: "$4.99",
  },
} as const;
