import type { ImageSourcePropType } from "react-native";

/** One face per file in `Art/cube`, in filename order. Metro needs static requires. The `_v2` set is the textured tiles; the original jpgs stay beside them. */
const CUBES: ImageSourcePropType[] = [
  require("../../Art/cube/cube_001_v2.png"),
  require("../../Art/cube/cube_002_v2.png"),
  require("../../Art/cube/cube_003_v2.png"),
  require("../../Art/cube/cube_004_v2.png"),
  require("../../Art/cube/cube_005_v2.png"),
  require("../../Art/cube/cube_006_v2.png"),
  require("../../Art/cube/cube_007_v2.png"),
  require("../../Art/cube/cube_008_v2.png"),
  require("../../Art/cube/cube_009_v2.png"),
  require("../../Art/cube/cube_010_v2.png"),
  require("../../Art/cube/cube_011_v2.png"),
  require("../../Art/cube/cube_012_v2.png"),
  require("../../Art/cube/cube_013_v2.png"),
  require("../../Art/cube/cube_014_v2.png"),
  require("../../Art/cube/cube_015_v2.png"),
  require("../../Art/cube/cube_016_v2.png"),
  require("../../Art/cube/cube_017_v2.png"),
  require("../../Art/cube/cube_018_v2.png"),
  require("../../Art/cube/cube_019_v2.png"),
  require("../../Art/cube/cube_020_v2.png"),
  require("../../Art/cube/cube_021_v2.png"),
  require("../../Art/cube/cube_022_v2.png"),
  require("../../Art/cube/cube_023_v2.png"),
  require("../../Art/cube/cube_024_v2.png"),
  require("../../Art/cube/cube_025_v2.png"),
  require("../../Art/cube/cube_026_v2.png"),
  require("../../Art/cube/cube_027_v2.png"),
  require("../../Art/cube/cube_028_v2.png"),
  require("../../Art/cube/cube_029_v2.png"),
  require("../../Art/cube/cube_030_v2.png"),
  require("../../Art/cube/cube_031_v2.png"),
  require("../../Art/cube/cube_032_v2.png"),
  require("../../Art/cube/cube_033_v2.png"),
  require("../../Art/cube/cube_034_v2.png"),
  require("../../Art/cube/cube_035_v2.png"),
  require("../../Art/cube/cube_036_v2.png"),
  require("../../Art/cube/cube_037_v2.png"),
  require("../../Art/cube/cube_038_v2.png"),
  require("../../Art/cube/cube_039_v2.png"),
  require("../../Art/cube/cube_040_v2.png"),
  require("../../Art/cube/cube_041_v2.png"),
  require("../../Art/cube/cube_042_v2.png"),
  require("../../Art/cube/cube_043_v2.png"),
  require("../../Art/cube/cube_044_v2.png"),
  require("../../Art/cube/cube_045_v2.png"),
  require("../../Art/cube/cube_046_v2.png"),
  require("../../Art/cube/cube_047_v2.png"),
  require("../../Art/cube/cube_048_v2.png"),
  require("../../Art/cube/cube_049_v2.png"),
  require("../../Art/cube/cube_050_v2.png"),
];

function cubeIndex(id: number): number {
  const n = CUBES.length;
  return ((id % n) + n) % n;
}

function hashIds(ids: number[]): number {
  let h = 2166136261;
  for (const id of ids) {
    h ^= id + 1;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function cubeForPiece(id: number): ImageSourcePropType {
  return CUBES[cubeIndex(id)];
}

function sigKey(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join(",");
}

/**
 * One face per distinct coverage on this board.
 * The same stack keeps one picture so a region can be counted.
 * A different stack must not reuse that picture.
 * Singletons take their own piece face first, so the tray matches.
 * If there are more stacks than pictures, later stacks repeat — add files to `CUBES`.
 */
export function facesForBoard(
  cover: number[][][],
): (ImageSourcePropType | null)[][] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of cover) {
    for (const ids of row) {
      if (!ids.length) continue;
      const key = sigKey(ids);
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  }
  keys.sort((a, b) => {
    const al = a.length === 0 ? 0 : a.split(",").length;
    const bl = b.length === 0 ? 0 : b.split(",").length;
    if (al !== bl) return al - bl;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const used = new Set<number>();
  const face = new Map<string, number>();
  const takeFree = (prefer: number) => {
    if (!used.has(prefer)) return prefer;
    for (let i = 0; i < CUBES.length; i++) {
      if (!used.has(i)) return i;
    }
    return prefer % CUBES.length;
  };

  for (const key of keys) {
    const ids = key.split(",").map(Number);
    const prefer = ids.length === 1 ? cubeIndex(ids[0]) : hashIds(ids) % CUBES.length;
    const idx = takeFree(prefer);
    used.add(idx);
    face.set(key, idx);
  }

  return cover.map((row) =>
    row.map((ids) => (ids.length ? CUBES[face.get(sigKey(ids))!] : null)),
  );
}
