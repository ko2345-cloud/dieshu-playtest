import { Image, View } from "react-native";

import { cubeForPiece } from "@/game/cubeArt";
import { bbox } from "@/game/geometry";
import type { Cell } from "@/game/types";
import { colors } from "@/theme";

type Props = {
  cells: Cell[];
  colorId: number;
  cell: number;
  /** Placed pieces stay in the tray as a flat silhouette. */
  spent?: boolean;
  /** Ignored — tiles sit flush so the cubes read as one piece. */
  gap?: number;
  /** Ignored — the cube art already has its own edge. */
  radius?: number;
};

export function PieceShape({ cells, colorId, cell, spent }: Props) {
  const { h, w } = bbox(cells);
  const set = new Set(cells.map(([r, c]) => `${r},${c}`));
  const source = cubeForPiece(colorId);
  return (
    <View
      style={{
        width: w * cell,
        height: h * cell,
        position: "relative",
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: h }, (_, r) => (
        <View key={r} style={{ flexDirection: "row", height: cell }}>
          {Array.from({ length: w }, (_, c) => {
            if (!set.has(`${r},${c}`)) {
              return <View key={c} style={{ width: cell, height: cell }} />;
            }
            if (spent) {
              return (
                <View
                  key={c}
                  style={{
                    width: cell,
                    height: cell,
                    backgroundColor: colors.spent,
                    borderRadius: Math.max(2, Math.round(cell * 0.18)),
                  }}
                />
              );
            }
            return (
              <Image
                key={c}
                source={source}
                resizeMode="cover"
                style={{ width: cell, height: cell }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
