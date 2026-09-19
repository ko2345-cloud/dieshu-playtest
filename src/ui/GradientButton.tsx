import { StyleSheet, Text } from "react-native";

import { colors, fontFamily, radii, softShadow } from "@/theme";

import { PressableScale } from "./PressableScale";

export function GradientButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={styles.btn}>
      <Text style={styles.label}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radii.pill,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: colors.orange,
    ...softShadow,
  },
  label: {
    color: colors.onInk,
    fontSize: 18,
    fontWeight: "700",
    fontFamily,
  },
});
