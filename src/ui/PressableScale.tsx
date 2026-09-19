import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

type Props = {
  onPress?: () => void;
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function PressableScale({
  onPress,
  children,
  style,
  disabled,
  accessibilityLabel,
}: Props) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={12}
      pressRetentionOffset={16}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[styles.box, pressed && !disabled && styles.pressed, style]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    transform: [{ scale: 1 }],
    // @ts-expect-error Reanimated CSS transition
    transitionProperty: "transform",
    transitionDuration: "120ms",
    transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
  },
  pressed: { transform: [{ scale: 0.97 }] },
});
