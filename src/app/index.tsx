import { CATEGORY_LABEL, LEVELS_PER_SIZE, SIZES } from "@/data/constants";
import { useProgress } from "@/data/progressStore";
import type { LevelCategory } from "@/game/types";
import { colors, fontFamily, softShadow } from "@/theme";
import { BannerAdBar } from "@/ui/BannerAdBar";
import { CategoryCard, RectPreview, TetroPreview } from "@/ui/CategoryCard";
import { GridPaper } from "@/ui/GridPaper";
import { InkCircle, ScreenHeader } from "@/ui/ScreenHeader";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const TOTAL = SIZES.length * LEVELS_PER_SIZE;

export default function HomeScreen() {
  const progress = useProgress();
  const done = (cat: LevelCategory) => {
    let n = 0;
    for (const size of SIZES) {
      for (let id = 1; id <= LEVELS_PER_SIZE; id++) {
        if (progress.isComplete(size, id, false, cat)) n += 1;
      }
    }
    return n;
  };

  return (
    <View style={styles.root}>
      <GridPaper />
      <ScreenHeader
        title="疊數"
        right={
          <>
            <InkCircle label="⚙" onPress={() => router.push("/settings")} />
            <InkCircle label="店" onPress={() => router.push("/shop")} />
          </>
        }
      />
      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.sideRow}>
          {!progress.tutorialDone ? (
            <MiniPill
              title="教學"
              onPress={() =>
                router.push({ pathname: "/play", params: { mode: "tutorial", id: "1" } })
              }
            />
          ) : null}
          <MiniPill title="每日挑戰" onPress={() => router.push("/daily")} />
        </View>

        <CategoryCard
          title={CATEGORY_LABEL.rect}
          color={colors.cardRect}
          done={done("rect")}
          total={TOTAL}
          preview={<RectPreview />}
          onPress={() =>
            router.push({ pathname: "/sizes", params: { cat: "rect" } })
          }
        />
        <CategoryCard
          title={CATEGORY_LABEL.tetro}
          color={colors.cardTetro}
          done={done("tetro")}
          total={TOTAL}
          preview={<TetroPreview />}
          onPress={() =>
            router.push({ pathname: "/sizes", params: { cat: "tetro" } })
          }
        />
      </ScrollView>
      <BannerAdBar visible={!progress.adsRemoved} />
    </View>
  );
}

function MiniPill({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.mini} accessibilityRole="button">
      <Text style={styles.miniTxt}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  list: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, gap: 14 },
  sideRow: { flexDirection: "row", gap: 10 },
  mini: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: colors.charcoal,
    alignItems: "center",
    justifyContent: "center",
    ...softShadow,
  },
  miniTxt: {
    color: colors.onInk,
    fontSize: 15,
    fontWeight: "700",
    fontFamily,
  },
});
