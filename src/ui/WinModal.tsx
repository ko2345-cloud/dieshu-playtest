import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { colors, fontFamily, radii, softShadow } from "@/theme";

import { PressableScale } from "./PressableScale";

type Props = {
  visible: boolean;
  title: string;
  body: string;
  primary: string;
  onPrimary: () => void;
  secondary?: string;
  onSecondary?: () => void;
};

export function WinModal({
  visible,
  title,
  body,
  primary,
  onPrimary,
  secondary,
  onSecondary,
}: Props) {
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <Animated.View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <PressableScale
          onPress={onPrimary}
          accessibilityLabel={primary}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>{primary}</Text>
        </PressableScale>
        {secondary && onSecondary ? (
          <PressableScale onPress={onSecondary} accessibilityLabel={secondary} style={styles.ghost}>
            <Text style={styles.ghostText}>{secondary}</Text>
          </PressableScale>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    zIndex: 50,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.panel,
    borderRadius: radii.card,
    padding: 22,
    ...softShadow,
    transform: [{ scale: 1 }],
    // @ts-expect-error Reanimated CSS
    transitionProperty: "transform, opacity",
    transitionDuration: "200ms",
    transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 8,
    fontFamily,
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  primary: {
    backgroundColor: colors.orange,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: colors.onInk, fontWeight: "700", fontSize: 16, fontFamily },
  ghost: { paddingVertical: 12, alignItems: "center", marginTop: 6 },
  ghostText: { color: colors.muted, fontWeight: "600" },
});
