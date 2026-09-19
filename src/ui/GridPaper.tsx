import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "@/theme";

const DIAMOND = 14;
const DIAMOND_STEP = 32;
const STRIPE_STEP = 11;

type Props = {
  /** Menus use diamonds. Play uses faint vertical stripes. */
  variant?: "diamond" | "stripe";
};

/** Cream texture behind every screen. */
export function GridPaper({ variant = "diamond" }: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const cols =
    variant === "stripe"
      ? Math.ceil(box.w / STRIPE_STEP)
      : Math.ceil(box.w / DIAMOND_STEP) + 1;
  const rows =
    variant === "stripe" ? 0 : Math.ceil(box.h / DIAMOND_STEP) + 1;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
      }}
    >
      {variant === "stripe"
        ? Array.from({ length: cols }, (_, i) => (
            <View key={`s${i}`} style={[styles.stripe, { left: i * STRIPE_STEP }]} />
          ))
        : Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => (
              <View
                key={`${r}-${c}`}
                style={[
                  styles.diamond,
                  {
                    left: c * DIAMOND_STEP - DIAMOND / 2,
                    top: r * DIAMOND_STEP - DIAMOND / 2,
                  },
                ]}
              />
            )),
          )}
    </View>
  );
}

const styles = StyleSheet.create({
  diamond: {
    position: "absolute",
    width: DIAMOND,
    height: DIAMOND,
    backgroundColor: colors.diamond,
    transform: [{ rotate: "45deg" }],
  },
  stripe: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.stripe,
  },
});
