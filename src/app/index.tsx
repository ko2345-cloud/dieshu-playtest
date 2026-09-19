import { LEVELS_PER_SIZE, SIZES } from "@/data/constants";
import { useProgress } from "@/data/progressStore";
import { candy, colors, fontFamily, softShadow } from "@/theme";
import { BannerAdBar } from "@/ui/BannerAdBar";
import { GridPaper } from "@/ui/GridPaper";
import { InkCircle, ScreenHeader } from "@/ui/ScreenHeader";
import { PressableScale } from "@/ui/PressableScale";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  const progress = useProgress();
  let colorIndex = 0;
  const nextColor = () => candy[colorIndex++ % candy.length];

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
        {!progress.tutorialDone ? (
          <Pill
            color={nextColor()}
            title="教學"
            cap="開始"
            onPress={() =>
              router.push({ pathname: "/play", params: { mode: "tutorial", id: "1" } })
            }
          />
        ) : null}

        <Pill
          color={nextColor()}
          title="每日挑戰"
          cap="今日"
          onPress={() => router.push("/daily")}
        />

        {SIZES.map((s) => {
          let done = 0;
          for (let i = 1; i <= LEVELS_PER_SIZE; i++) {
            if (progress.isComplete(s, i)) done += 1;
          }
          const pct = Math.round((done / LEVELS_PER_SIZE) * 100);
          return (
            <Pill
              key={s}
              color={nextColor()}
              title={`${s}×${s}`}
              cap={`${pct}%`}
              onPress={() =>
                router.push({ pathname: "/levels", params: { size: String(s) } })
              }
            />
          );
        })}
      </ScrollView>
      <BannerAdBar visible={!progress.adsRemoved} />
    </View>
  );
}

function Pill({
  color,
  title,
  cap,
  onPress,
}: {
  color: string;
  title: string;
  cap: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.pillWrap}>
      <PressableScale onPress={onPress} style={[styles.pill, { backgroundColor: color }]}>
        <Text style={styles.pillTitle}>{title}</Text>
        <View style={styles.cap}>
          <Text style={styles.capTxt}>{cap}</Text>
        </View>
      </PressableScale>
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
