import { Image, StyleSheet, Text, View } from "react-native";

import { facesForBoard } from "@/game/cubeArt";
import type { ClueState } from "@/game/types";
import { colors, fontFamily, stroke } from "@/theme";

/** Overlap so subpixel gaps don't show the board between cubes. */
const OVERLAP = 1;
/** Fraction of the cube jpg to crop. The rim is a lighter bevel that reads as a grid line. */
const RIM = 0.06;

type Props = {
  rows: number;
  cols: number;
  cell: number;
  /** Kept for layout math; board itself is flush (no visual gaps). */
  gap?: number;
  cover: number[][][];
  clueState: ClueState[];
  selectedCells: [number, number][];
  invalidCells: [number, number][];
  onCellPress?: (r: number, c: number) => void;
};

export function Board({
  rows,
  cols,
  cell,
  cover,
  clueState,
  selectedCells,
  invalidCells,
  onCellPress,
}: Props) {
  const selected = new Set(selectedCells.map(([r, c]) => `${r},${c}`));
  const invalid = new Set(invalidCells.map(([r, c]) => `${r},${c}`));
  const clueAt = (r: number, c: number) =>
    clueState.find((x) => x.r === r && x.c === c);
  const faces = facesForBoard(cover);

  return (
    <View
      style={[
        styles.board,
        {
          padding: 8,
          borderRadius: 8,
          width: 8 * 2 + cols * cell,
          height: 8 * 2 + rows * cell,
        },
      ]}
    >
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const ids = cover[r]?.[c] ?? [];
          const clue = clueAt(r, c);
          const filled = ids.length > 0;
          const face = faces[r]?.[c] ?? null;
          const isSel = selected.has(`${r},${c}`);
          const bleed = filled ? OVERLAP : 0;
          const rim = Math.max(1, Math.round(cell * RIM));
          const neighborSel = (rr: number, cc: number) =>
            selected.has(`${rr},${cc}`);
          return (
            <View
              key={`${r}-${c}`}
              onStartShouldSetResponder={() => !!onCellPress}
              onResponderRelease={() => onCellPress?.(r, c)}
              style={[
                styles.cell,
                {
                  width: cell + bleed,
                  height: cell + bleed,
                  left: 8 + c * cell,
                  top: 8 + r * cell,
                  zIndex: isSel ? 1000 : filled ? 10 + r * cols + c : 0,
                  backgroundColor: filled ? "transparent" : colors.boardEmpty,
                  overflow: "hidden",
                  borderTopWidth: isSel
                    ? neighborSel(r - 1, c)
                      ? 0
                      : 2
                    : filled
                      ? 0
                      : StyleSheet.hairlineWidth * 2,
                  borderBottomWidth: isSel
                    ? neighborSel(r + 1, c)
                      ? 0
                      : 2
                    : filled
                      ? 0
                      : StyleSheet.hairlineWidth * 2,
                  borderLeftWidth: isSel
                    ? neighborSel(r, c - 1)
                      ? 0
                      : 2
                    : filled
                      ? 0
                      : StyleSheet.hairlineWidth * 2,
                  borderRightWidth: isSel
                    ? neighborSel(r, c + 1)
                      ? 0
                      : 2
                    : filled
                      ? 0
                      : StyleSheet.hairlineWidth * 2,
                  borderColor: isSel ? colors.gold : "#3C3937",
                  opacity: invalid.has(`${r},${c}`) ? 0.55 : 1,
                },
              ]}
            >
              {face ? (
                <Image
                  source={face}
                  resizeMode="cover"
                  style={{
                    position: "absolute",
                    left: -rim,
                    top: -rim,
                    width: cell + bleed + rim * 2,
                    height: cell + bleed + rim * 2,
                  }}
                />
              ) : null}
              {clue ? (
                <ClueMark n={clue.n} state={clue.state} filled={filled} cell={cell} />
              ) : null}
            </View>
          );
        }),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.boardEmpty,
    alignSelf: "center",
    position: "relative",
    overflow: "hidden",
  },
  cell: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  clue: {
    zIndex: 2,
    fontFamily,
    fontWeight: "700",
    color: colors.ink,
  },
});

function ClueMark({
  n,
  state,
  filled,
  cell,
}: {
  n: number;
  state: ClueState["state"];
  filled: boolean;
  cell: number;
}) {
  const digits = String(n).length;
  const fontSize = Math.max(11, Math.round(cell * (digits > 1 ? 0.3 : 0.38)));
  if (!filled) {
    return (
      <Text style={[styles.clue, { fontSize, color: colors.onInk }]}>{n}</Text>
    );
  }
  const d = Math.round(
    Math.min(cell * 0.78, Math.max(fontSize * 1.75, cell * 0.56)),
  );
  return (
    <View
      style={{
        width: d,
        height: d,
        borderRadius: d / 2,
        backgroundColor: colors.paper,
        borderWidth: stroke,
        borderColor: colors.ink,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2,
      }}
    >
      <Text
        style={[
          styles.clue,
          {
            fontSize,
            lineHeight: fontSize,
            color: state === "ok" ? colors.ok : colors.bad,
            textAlign: "center",
            includeFontPadding: false,
          },
        ]}
      >
        {n}
      </Text>
    </View>
  );
}
