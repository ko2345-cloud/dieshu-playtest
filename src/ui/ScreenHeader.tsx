import { colors, fontFamily } from "@/theme";
import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableScale } from "./PressableScale";

type Props = {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  /** Hanging tab under the bar. Replaces the centered title. */
  badge?: { kicker: string; value: string };
};

export function ScreenHeader({ title, onBack, right, badge }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {onBack ? (
          <PressableScale onPress={onBack} style={styles.back} accessibilityLabel="返回">
            <Text style={styles.backTxt}>‹</Text>
          </PressableScale>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <View style={styles.flex} />
        <View style={styles.right}>{right}</View>
        {badge ? null : (
          <View pointerEvents="none" style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </View>
        )}
      </View>
      {badge ? (
        <View style={styles.shieldWrap}>
          <View style={styles.shield}>
            <Text style={styles.kicker}>{badge.kicker}</Text>
            <Text style={styles.shieldValue}>{badge.value}</Text>
          </View>
          <View style={styles.point} />
        </View>
      ) : null}
    </View>
  );
}

export function InkCircle({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={styles.circle} accessibilityLabel={label}>
      <Text style={styles.circleTxt}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.charcoal,
    paddingBottom: 6,
  },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  flex: { flex: 1 },
  back: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  backSpacer: { width: 12 },
  backTxt: {
    fontSize: 34,
    lineHeight: 36,
    color: colors.onCharcoal,
    fontFamily,
  },
  titleWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.onCharcoal,
    fontFamily,
  },
  right: { flexDirection: "row", alignItems: "center", paddingRight: 6 },
  circle: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  circleTxt: { color: colors.onCharcoal, fontSize: 18, fontFamily },
  shieldWrap: { alignItems: "center", marginTop: -8 },
  shield: {
    backgroundColor: colors.charcoal,
    minWidth: 84,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 4,
    alignItems: "center",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  kicker: {
    color: "#C8C2B8",
    fontSize: 11,
    letterSpacing: 1.2,
    fontFamily,
  },
  shieldValue: {
    color: colors.orange,
    fontSize: 22,
    lineHeight: 26,
    fontFamily,
    marginTop: -1,
  },
  point: {
    width: 12,
    height: 12,
    backgroundColor: colors.charcoal,
    transform: [{ rotate: "45deg" }],
    marginTop: -7,
    marginBottom: -4,
  },
});
