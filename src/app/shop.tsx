import { SIZES } from "@/data/constants";
import { useProgress } from "@/data/progressStore";
import { buyMock, catalog } from "@/iap/iapService";
import { colors, fontFamily, radii, softShadow } from "@/theme";
import { BannerAdBar } from "@/ui/BannerAdBar";
import { GridPaper } from "@/ui/GridPaper";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { PressableScale } from "@/ui/PressableScale";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function ShopScreen() {
  const progress = useProgress();

  return (
    <View style={styles.root}>
      <GridPaper />
      <ScreenHeader title="商店" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.hint}>提示剩餘 {progress.hints}</Text>
        {catalog.map((item) => {
          const owned =
            (item.kind === "removeAds" && progress.adsRemoved) ||
            (item.kind === "extra" &&
              item.extraSize != null &&
              progress.extraOwned(item.extraSize)) ||
            (item.kind === "bundle" &&
              progress.adsRemoved &&
              SIZES.every((s) => progress.extraOwned(s)));
          return (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.description}</Text>
              <PressableScale
                disabled={owned}
                onPress={() => buyMock(item, progress)}
                style={[styles.buy, owned && styles.owned]}
              >
                <Text style={[styles.buyTxt, owned && styles.ownedTxt]}>{owned ? "已擁有" : item.priceLabel}</Text>
              </PressableScale>
            </View>
          );
        })}
      </ScrollView>
      <BannerAdBar visible={!progress.adsRemoved} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  hint: { color: colors.muted, marginBottom: 4, fontFamily },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radii.card,
    padding: 16,
    ...softShadow,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.ink, fontFamily },
  cardBody: { color: colors.muted, marginTop: 4, marginBottom: 12, fontFamily },
  buy: {
    alignSelf: "flex-start",
    backgroundColor: colors.orange,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  owned: { backgroundColor: colors.creamDark },
  buyTxt: { color: colors.onInk, fontWeight: "700", fontFamily },
  ownedTxt: { color: colors.ink },
});
