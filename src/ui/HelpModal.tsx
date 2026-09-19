import { StyleSheet, Text, View } from "react-native";

import { colors, fontFamily, radii, softShadow } from "@/theme";

import { PressableScale } from "./PressableScale";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function HelpModal({ visible, onClose }: Props) {
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>怎麼玩</Text>
        <Text style={styles.item}>1. 把積木拖到棋盤上，可以重疊。</Text>
        <Text style={styles.item}>2. 拖出棋盤外面可以收回積木。</Text>
        <Text style={styles.item}>
          3. 格子上的數字 = 那個圖樣連成一塊有幾格。
        </Text>
        <Text style={styles.note}>
          填滿棋盤還不夠——重疊位置不對，數字就對不上。積木不能旋轉。
        </Text>
        <PressableScale
          onPress={onClose}
          accessibilityLabel="開始玩"
          style={styles.btn}
        >
          <Text style={styles.btnText}>開始玩</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    padding: 22,
    zIndex: 50,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radii.card,
    padding: 22,
    ...softShadow,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 12,
    fontFamily,
  },
  item: { color: colors.ink, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  note: { color: colors.muted, fontSize: 14, lineHeight: 21, marginVertical: 10 },
  btn: {
    backgroundColor: colors.orange,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: colors.onInk, fontWeight: "700", fontSize: 16, fontFamily },
});
