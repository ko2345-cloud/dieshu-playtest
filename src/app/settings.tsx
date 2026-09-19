import { ads } from "@/ads/adService";
import { useProgress } from "@/data/progressStore";
import { colors, fontFamily, radii, softShadow } from "@/theme";
import { BannerAdBar } from "@/ui/BannerAdBar";
import { GridPaper } from "@/ui/GridPaper";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { PressableScale } from "@/ui/PressableScale";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function SettingsScreen() {
  const progress = useProgress();

  return (
    <View style={styles.root}>
      <GridPaper />
      <ScreenHeader title="設定" onBack={() => router.back()} />
      <View style={styles.card}>
        <Text style={styles.row}>提示 {progress.hints}</Text>
        <Text style={styles.row}>
          廣告 {progress.adsRemoved || ads.adsRemoved ? "已關閉橫幅／插頁" : "開啟"}
        </Text>
        <Text style={styles.note}>
          看影片換提示在移除廣告之後仍然可用。積木不能旋轉，拖出棋盤可收回。
        </Text>
        <PressableScale onPress={() => router.push("/shop")} style={styles.btn}>
          <Text style={styles.btnTxt}>商店</Text>
        </PressableScale>
      </View>
      <BannerAdBar visible={!progress.adsRemoved} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  card: {
    margin: 18,
    padding: 18,
    backgroundColor: colors.panel,
    borderRadius: radii.card,
    ...softShadow,
  },
  row: { fontSize: 16, color: colors.ink, marginBottom: 8, fontWeight: "600", fontFamily },
  note: { color: colors.muted, lineHeight: 20, marginVertical: 8, fontFamily },
  btn: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: colors.orange,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  btnTxt: { color: colors.onInk, fontWeight: "700", fontFamily },
});
