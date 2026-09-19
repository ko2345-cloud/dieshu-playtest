import { dateKey, dailySizeFor, loadDaily } from "@/data/levelRepository";
import { useProgress } from "@/data/progressStore";
import { colors, fontFamily, radii, softShadow } from "@/theme";
import { GradientButton } from "@/ui/GradientButton";
import { GridPaper } from "@/ui/GridPaper";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function DailyScreen() {
  const progress = useProgress();
  const size = dailySizeFor();
  const level = loadDaily(new Date(), progress.dailySalt);

  return (
    <View style={styles.root}>
      <GridPaper />
      <ScreenHeader title="每日挑戰" onBack={() => router.back()} />
      <View style={styles.card}>
        <Text style={styles.kicker}>{dateKey()}</Text>
        <Text style={styles.big}>
          {size}×{size}
        </Text>
        <Text style={styles.body}>
          今天一題，免費。棋盤 {level.rows}×{level.cols}，{level.pieces.length}{" "}
          塊積木。明天會換新題。
        </Text>
        <GradientButton
          label="開始"
          onPress={() =>
            router.push({
              pathname: "/play",
              params: { mode: "daily", size: String(size), id: "1" },
            })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  card: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.panel,
    borderRadius: radii.card,
    ...softShadow,
  },
  kicker: { color: colors.muted, letterSpacing: 1, fontSize: 13, fontFamily },
  big: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    marginVertical: 6,
    fontFamily,
  },
  body: { color: colors.muted, lineHeight: 22, marginBottom: 16, fontFamily },
});
