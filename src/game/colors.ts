/**
 * Old flat fills. The board and piece previews paint `Art/cube` instead
 * (`cubeArt.ts`). Kept so a later palette change has the previous hues.
 */
export const PALETTE = [
  "#FA413C",
  "#FB8C00",
  "#FDD835",
  "#4FC654",
  "#35D7EB",
  "#B00046",
  "#683C2E",
  "#FF9DFB",
  "#1B5E20",
  "#1E88E5",
  "#8E24AA",
  "#A78C08",
  "#F79393",
  "#001E72",
  "#000000",
] as const;

/**
 * Distinct “new” colors for overlap signatures — not blends.
 * Pink / purple / teal etc. so stacked regions stay easy to tell apart.
 */
const OVERLAP_PALETTE = [
  "#FF4FA3", // hot pink (reference look)
  "#7C4DFF", // purple
  "#00C853", // green
  "#FF6D00", // deep orange
  "#00BFA5", // teal
  "#D500F9", // magenta
  "#2979FF", // bright blue
  "#FFD600", // strong yellow
  "#FF1744", // crimson
  "#76FF03", // lime
  "#F50057", // rose
  "#651FFF", // indigo
  "#1DE9B6", // aqua
  "#FF9100", // amber
  "#C6FF00", // chartreuse
  "#EA80FC", // light violet
] as const;

export function pieceColor(id: number): string {
  return PALETTE[id % PALETTE.length];
}

function hashIds(ids: number[]): number {
  let h = 2166136261;
  for (const id of ids) {
    h ^= id + 1;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fill color for a coverage set: single piece = palette; overlap = a new distinct hue. */
export function mixFill(ids: number[]): string {
  const unique = [...new Set(ids)].sort((a, b) => a - b);
  if (!unique.length) return "#FFFFFF";
  if (unique.length === 1) return pieceColor(unique[0]);

  const used = new Set(unique.map((id) => pieceColor(id).toLowerCase()));
  let h = hashIds(unique);
  for (let i = 0; i < OVERLAP_PALETTE.length; i++) {
    const color = OVERLAP_PALETTE[(h + i) % OVERLAP_PALETTE.length];
    if (!used.has(color.toLowerCase())) return color;
  }
  return OVERLAP_PALETTE[h % OVERLAP_PALETTE.length];
}
