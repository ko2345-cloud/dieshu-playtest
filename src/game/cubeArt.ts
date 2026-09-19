import type { ImageSourcePropType } from "react-native";

/** One face per file in `Art/cube`, in filename order. Metro needs static requires. */
const CUBES: ImageSourcePropType[] = [
  require("../../Art/cube/cube_001.jpg"),
  require("../../Art/cube/cube_002.jpg"),
  require("../../Art/cube/cube_003.jpg"),
  require("../../Art/cube/cube_004.jpg"),
  require("../../Art/cube/cube_005.jpg"),
  require("../../Art/cube/cube_006.jpg"),
  require("../../Art/cube/cube_007.jpg"),
  require("../../Art/cube/cube_008.jpg"),
  require("../../Art/cube/cube_009.jpg"),
  require("../../Art/cube/cube_010.jpg"),
  require("../../Art/cube/cube_011.jpg"),
  require("../../Art/cube/cube_012.jpg"),
  require("../../Art/cube/cube_013.jpg"),
  require("../../Art/cube/cube_014.jpg"),
  require("../../Art/cube/cube_015.jpg"),
  require("../../Art/cube/cube_016.jpg"),
  require("../../Art/cube/cube_017.jpg"),
  require("../../Art/cube/cube_018.jpg"),
  require("../../Art/cube/cube_019.jpg"),
  require("../../Art/cube/cube_020.jpg"),
  require("../../Art/cube/cube_021.jpg"),
  require("../../Art/cube/cube_022.jpg"),
  require("../../Art/cube/cube_023.jpg"),
  require("../../Art/cube/cube_024.jpg"),
  require("../../Art/cube/cube_025.jpg"),
  require("../../Art/cube/cube_026.jpg"),
  require("../../Art/cube/cube_027.jpg"),
  require("../../Art/cube/cube_028.jpg"),
  require("../../Art/cube/cube_029.jpg"),
  require("../../Art/cube/cube_030.jpg"),
  require("../../Art/cube/cube_031.jpg"),
  require("../../Art/cube/cube_032.jpg"),
  require("../../Art/cube/cube_033.jpg"),
  require("../../Art/cube/cube_034.jpg"),
  require("../../Art/cube/cube_035.jpg"),
  require("../../Art/cube/cube_036.jpg"),
  require("../../Art/cube/cube_037.jpg"),
  require("../../Art/cube/cube_038.jpg"),
  require("../../Art/cube/cube_039.jpg"),
  require("../../Art/cube/cube_040.jpg"),
  require("../../Art/cube/cube_041.jpg"),
  require("../../Art/cube/cube_042.jpg"),
  require("../../Art/cube/cube_043.jpg"),
  require("../../Art/cube/cube_044.jpg"),
  require("../../Art/cube/cube_045.jpg"),
  require("../../Art/cube/cube_046.jpg"),
  require("../../Art/cube/cube_047.jpg"),
  require("../../Art/cube/cube_048.jpg"),
  require("../../Art/cube/cube_049.jpg"),
  require("../../Art/cube/cube_050.jpg"),
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
