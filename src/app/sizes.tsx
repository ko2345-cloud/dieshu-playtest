import { CATEGORY_LABEL, LEVELS_PER_SIZE, SIZES } from "@/data/constants";
import { useProgress } from "@/data/progressStore";
import type { LevelCategory } from "@/game/types";
import { candy, colors, fontFamily, softShadow } from "@/theme";
import { GridPaper } from "@/ui/GridPaper";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { PressableScale } from "@/ui/PressableScale";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function SizesScreen() {
  const progress = useProgress();
  const { cat: catStr } = useLocalSearchParams<{ cat?: string }>();
  const cat: LevelCategory = catStr === "tetro" ? "tetro" : "rect";

  return (
    <View style={styles.root}>
      <GridPaper />
      <ScreenHeader
        title={CATEGORY_LABEL[cat]}
        badge={{ kicker: "類別", value: cat === "tetro" ? "七型" : "方型" }}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.list}>
        {SIZES.map((s, index) => {
          let done = 0;
          for (let i = 1; i <= LEVELS_PER_SIZE; i++) {
            if (progress.isComplete(s, i, false, cat)) done += 1;
          }
          const pct = Math.round((done / LEVELS_PER_SIZE) * 100);
          return (
            <View key={s} style={styles.pillWrap}>
              <PressableScale
                onPress={() =>
                  router.push({
                    pathname: "/levels",
                    params: { size: String(s), cat },
                  })
                }
                style={[styles.pill, { backgroundColor: candy[index % candy.length] }]}
              >
                <Text style={styles.pillTitle}>
                  {s}×{s}
                </Text>
                <View style={styles.cap}>
                  <Text style={styles.capTxt}>{pct}%</Text>
                </View>
              </PressableScale>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  list: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20, gap: 12 },
  pillWrap: { borderRadius: 32, ...softShadow },
  pill: {
    minHeight: 64,
    borderRadius: 32,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 22,
  },
  pillTitle: {
    flex: 1,
    color: colors.onInk,
    fontSize: 18,
    fontWeight: "700",
    fontFamily,
  },
  cap: {
    width: 84,
    alignSelf: "stretch",
    backgroundColor: "rgba(0,0,0,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  capTxt: { color: colors.onInk, fontSize: 16, fontWeight: "700", fontFamily },
});
