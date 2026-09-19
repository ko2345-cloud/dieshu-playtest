import { StyleSheet, Text, View } from "react-native";

import { ads } from "@/ads/adService";
import { colors } from "@/theme";

export function BannerAdBar({ visible }: { visible: boolean }) {
  if (!visible || ads.adsRemoved) return null;
  return (
    <View style={styles.bar}>
      <Text style={styles.text}>廣告橫幅</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 50,
    backgroundColor: colors.bannerBar,
    borderTopWidth: 1,
    borderColor: colors.softLine,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { color: colors.muted, fontSize: 12, letterSpacing: 1 },
});
