import { Platform, type ViewStyle } from "react-native";

/** Soft puzzle-menu palette. Game marks (ok / bad / gold) stay here too. */
export const colors = {
  cream: "#F6F1E6",
  creamDark: "#E7DDD0",
  paper: "#FFFFFF",
  ink: "#2F2C2A",
  muted: "#8A8178",
  line: "#2F2C2A",
  softLine: "#E6D9C8",
  river: "#B9D4E8",
  grid: "#E0D2BC",
  panel: "#FFFFFF",
  bannerBar: "#EFE6D5",
  onInk: "#FFFFFF",
  charcoal: "#3D3A38",
  onCharcoal: "#F6F1E6",
  orange: "#F08A2A",
  plum: "#6E4E6C",
  badge: "#E85A84",
  tray: "#D4D0CB",
  /** Empty board cells (play screen). */
  boardEmpty: "#4A4644",
  diamond: "#D4C4A8",
  stripe: "#E4D7C4",
  primary: "#F08A2A",
  secondary: "#1E88E5",
  coral: "#E85A84",
  gold: "#D9B300",
  /** Unused by screens. Kept so older notes still name the token. */
  progressYellow: "#FBD201",
  ok: "#2E7D32",
  bad: "#B00020",
  /** Tray silhouette after that piece is on the board. */
  spent: "#5C564F",
  overlay: "rgba(47,44,42,0.45)",
} as const;

/** Home capsules, top to bottom. */
export const candy = [
  "#8BC34A",
  "#26C6DA",
  "#EC407A",
  "#FF9800",
  "#9575CD",
  "#42A5F5",
  "#D07A5A",
  "#26A69A",
  "#7E57C2",
] as const;

export const radii = {
  cell: 8,
  tile: 22,
  card: 18,
  pill: 999,
  btn: 16,
} as const;

export const stroke = 1.5;

export const softShadow: ViewStyle = {
  boxShadow: "0 4px 8px rgba(58, 54, 51, 0.16)",
};

export const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

/** Rounded system face. Nunito is not bundled; CJK falls back inside these families. */
export const fontFamily =
  Platform.OS === "ios"
    ? "Avenir Next"
    : Platform.OS === "android"
      ? "sans-serif-medium"
      : "Segoe UI";
