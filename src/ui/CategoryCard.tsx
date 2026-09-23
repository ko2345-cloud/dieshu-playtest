import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fontFamily, softShadow } from "@/theme";

import { PressableScale } from "./PressableScale";

type Cell = [number, number];

const TETRO_INK = {
  I: "#E23B32",
  J: "#F6D435",
  L: "#5CB83A",
  O: "#1F7A32",
  S: "#3EC6F0",
  T: "#24306A",
  Z: "#E23B8A",
} as const;

const TETRO_SHAPES: { name: keyof typeof TETRO_INK; cells: Cell[] }[] = [
  { name: "I", cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { name: "J", cells: [[0, 1], [1, 1], [2, 0], [2, 1]] },
  { name: "L", cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { name: "O", cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { name: "S", cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  { name: "T", cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { name: "Z", cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
];

function MiniCells({
  cells,
  color,
  cell,
}: {
  cells: Cell[];
  color: string;
  cell: number;
}) {
  const h = Math.max(...cells.map((c) => c[0])) + 1;
  const w = Math.max(...cells.map((c) => c[1])) + 1;
  const set = new Set(cells.map(([r, c]) => `${r},${c}`));
  return (
    <View style={{ width: w * cell, height: h * cell }}>
      {Array.from({ length: h }, (_, r) => (
        <View key={r} style={{ flexDirection: "row", height: cell }}>
          {Array.from({ length: w }, (_, c) => (
            <View
              key={c}
              style={{
                width: cell,
                height: cell,
                backgroundColor: set.has(`${r},${c}`) ? color : "transparent",
                borderRadius: set.has(`${r},${c}`) ? 2 : 0,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function RectPreview() {
  return (
    <View style={styles.rectStage}>
      <View style={[styles.block, styles.blockA]} />
      <View style={[styles.block, styles.blockB]} />
      <View style={[styles.block, styles.blockC]} />
      <View style={[styles.block, styles.blockD]} />
    </View>
  );
}

export function TetroPreview() {
  const cell = 11;
  const top = TETRO_SHAPES.slice(0, 4);
  const bottom = TETRO_SHAPES.slice(4);
  return (
    <View style={styles.tetroStage}>
      <View style={styles.tetroRow}>
        {top.map((shape) => (
          <MiniCells
            key={shape.name}
            cells={shape.cells}
            color={TETRO_INK[shape.name]}
            cell={cell}
          />
        ))}
      </View>
      <View style={styles.tetroRow}>
        {bottom.map((shape) => (
          <MiniCells
            key={shape.name}
            cells={shape.cells}
            color={TETRO_INK[shape.name]}
            cell={cell}
          />
        ))}
      </View>
    </View>
  );
}

export function CategoryCard({
  title,
  color,
  done,
  total,
  preview,
  onPress,
}: {
  title: string;
  color: string;
  done: number;
  total: number;
  preview: ReactNode;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${title}，完成 ${done}/${total}`}
      style={styles.card}
    >
      <View style={styles.clip}>
        <View style={[styles.bar, { backgroundColor: color }]}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.well}>{preview}</View>
        <View style={[styles.bar, styles.foot, { backgroundColor: color }]}>
          <Text style={styles.footLabel}>完成</Text>
          <Text style={styles.footCount}>
            {done}/{total}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    ...softShadow,
  },
  clip: {
    borderRadius: 22,
    overflow: "hidden",
  },
  bar: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  title: {
    color: colors.onInk,
    fontSize: 22,
    fontWeight: "800",
    fontFamily,
  },
  well: {
    backgroundColor: colors.cardWell,
    minHeight: 132,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  foot: {
    minHeight: 40,
    flexDirection: "row",
    gap: 8,
  },
  footLabel: {
    color: colors.onInk,
    fontSize: 14,
    fontFamily,
    opacity: 0.9,
  },
  footCount: {
    color: colors.onInk,
    fontSize: 16,
    fontWeight: "800",
    fontFamily,
  },
  rectStage: {
    width: 168,
    height: 104,
  },
  block: {
    position: "absolute",
    borderRadius: 6,
  },
  blockA: {
    left: 18,
    top: 8,
    width: 78,
    height: 52,
    backgroundColor: "#5B8DEF",
  },
  blockB: {
    left: 62,
    top: 28,
    width: 52,
    height: 64,
    backgroundColor: "#F0B429",
  },
  blockC: {
    left: 8,
    top: 48,
    width: 64,
    height: 36,
    backgroundColor: "#E25B78",
  },
  blockD: {
    left: 96,
    top: 12,
    width: 36,
    height: 36,
    backgroundColor: "#3CB87A",
  },
  tetroStage: { gap: 10, alignItems: "center" },
  tetroRow: { flexDirection: "row", alignItems: "flex-end", gap: 14 },
});
