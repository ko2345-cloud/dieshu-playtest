import { LEVELS_PER_SIZE } from "@/data/constants";
import { useProgress } from "@/data/progressStore";
import type { LevelCategory } from "@/game/types";
import { colors, fontFamily, softShadow } from "@/theme";
import { GridPaper } from "@/ui/GridPaper";
import { InkCircle, ScreenHeader } from "@/ui/ScreenHeader";
import { PressableScale } from "@/ui/PressableScale";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function LevelsScreen() {
  const progress = useProgress();
  const { size: sizeStr, extra: extraStr, cat: catStr } = useLocalSearchParams<{
    size?: string;
    extra?: string;
    cat?: string;
  }>();
  const size = Number(sizeStr ?? 4);
  const cat: LevelCategory = catStr === "tetro" ? "tetro" : "rect";
  const extra = extraStr === "1" && cat === "rect";
  const locked = extra && !progress.extraOwned(size);
  const data = Array.from({ length: LEVELS_PER_SIZE }, (_, i) => i + 1);
  const [gridW, setGridW] = useState(0);
  const gap = 12;
  const cols = 5;
  const cellSize =
    gridW > 0 ? Math.floor((gridW - 36 - gap * (cols - 1)) / cols) : 0;

  return (
    <View style={styles.root}>
      <GridPaper />
      <ScreenHeader
        title={`${size}×${size}`}
        badge={{
          kicker: extra ? "EXTRA" : cat === "tetro" ? "七型" : "方型",
          value: `${size}×${size}`,
        }}
        onBack={() => router.back()}
        right={
          <>
            <InkCircle label="⚙" onPress={() => router.push("/settings")} />
            <InkCircle label="店" onPress={() => router.push("/shop")} />
          </>
        }
      />
      {locked ? (
        <View style={styles.lock}>
          <Text style={styles.lockTxt}>
            購買 Extra Pack 後即可遊玩這 {LEVELS_PER_SIZE} 關。
          </Text>
          <PressableScale onPress={() => router.push("/shop")} style={styles.shop}>
            <Text style={styles.shopTxt}>前往商店</Text>
          </PressableScale>
        </View>
      ) : (
        <View
          style={styles.grid}
          onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
        >
          {data.map((item) => {
            const done = progress.isComplete(size, item, extra, cat);
            return (
              <PressableScale
                key={item}
                onPress={() =>
                  router.push({
                    pathname: "/play",
                    params: {
                      mode: extra ? "extra" : "pack",
                      size: String(size),
                      id: String(item),
                      cat,
                    },
                  })
                }
                style={[
                  styles.cell,
                  cellSize > 0 && {
                    width: cellSize,
                    height: cellSize,
                    borderRadius: Math.round(cellSize * 0.36),
                  },
                ]}
              >
                <Text style={[styles.cellTxt, done && styles.cellTxtDone]}>{item}</Text>
                {done ? <View style={styles.done} /> : null}
              </PressableScale>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  grid: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cell: {
    backgroundColor: colors.charcoal,
    alignItems: "center",
    justifyContent: "center",
    ...softShadow,
  },
  done: {
    position: "absolute",
    left: "22%",
    right: "22%",
    bottom: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.orange,
  },
  cellTxt: {
    fontWeight: "700",
    fontSize: 26,
    lineHeight: 30,
    color: colors.onInk,
    fontFamily,
  },
  cellTxtDone: { color: colors.orange },
  lock: {
    margin: 18,
    padding: 22,
    backgroundColor: colors.panel,
    borderRadius: 18,
    alignItems: "center",
    ...softShadow,
  },
  lockTxt: {
    color: colors.muted,
    textAlign: "center",
    marginBottom: 16,
    fontFamily,
    lineHeight: 22,
  },
  shop: {
    backgroundColor: colors.orange,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  shopTxt: { color: colors.onInk, fontWeight: "700", fontSize: 16, fontFamily },
});
