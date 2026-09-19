import type { LevelData } from "@/game/types";

import { DAILY_FALLBACK, LEVELS_PER_SIZE, SIZES } from "./constants";

const packLoaders: Record<number, () => LevelData[]> = {
  4: () => require("../../assets/levels/4.json"),
  5: () => require("../../assets/levels/5.json"),
  6: () => require("../../assets/levels/6.json"),
  7: () => require("../../assets/levels/7.json"),
  8: () => require("../../assets/levels/8.json"),
  9: () => require("../../assets/levels/9.json"),
  10: () => require("../../assets/levels/10.json"),
};

const extraLoaders: Record<number, () => LevelData[]> = {
  4: () => require("../../assets/levels/extra/4.json"),
  5: () => require("../../assets/levels/extra/5.json"),
  6: () => require("../../assets/levels/extra/6.json"),
  7: () => require("../../assets/levels/extra/7.json"),
  8: () => require("../../assets/levels/extra/8.json"),
  9: () => require("../../assets/levels/extra/9.json"),
  10: () => require("../../assets/levels/extra/10.json"),
};

const dailyLoaders: Record<number, () => LevelData[]> = {
  4: () => require("../../assets/levels/daily_fallback/4.json"),
  5: () => require("../../assets/levels/daily_fallback/5.json"),
  6: () => require("../../assets/levels/daily_fallback/6.json"),
  7: () => require("../../assets/levels/daily_fallback/7.json"),
  8: () => require("../../assets/levels/daily_fallback/8.json"),
  9: () => require("../../assets/levels/daily_fallback/9.json"),
  10: () => require("../../assets/levels/daily_fallback/10.json"),
};

function safeLoad(loader: () => LevelData[]): LevelData[] {
  try {
    const data = loader();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function loadTutorial(): LevelData[] {
  try {
    return require("../../assets/levels/tutorial.json") as LevelData[];
  } catch {
    return [];
  }
}

export function loadPack(size: number, extra = false): LevelData[] {
  const loaders = extra ? extraLoaders : packLoaders;
  return safeLoad(loaders[size] ?? (() => []));
}

export function loadLevel(
  size: number,
  id: number,
  extra = false,
): LevelData | null {
  const pack = loadPack(size, extra);
  return pack.find((l) => l.id === id) ?? pack[id - 1] ?? null;
}

export function dateKey(day = new Date()) {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

export function dailySizeFor(day = new Date()) {
  const start = new Date(day.getFullYear(), 0, 0);
  const dayNum = Math.floor((day.getTime() - start.getTime()) / 86400000);
  return SIZES[dayNum % SIZES.length];
}

export function loadDaily(day = new Date(), salt = 0): LevelData {
  const size = dailySizeFor(day);
  const pool = safeLoad(dailyLoaders[size] ?? (() => []));
  const key = `${dateKey(day)}:${salt}:${size}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) >>> 0;
  if (!pool.length) {
    const tut = loadTutorial();
    return tut[0];
  }
  const idx = h % Math.min(DAILY_FALLBACK, pool.length);
  return { ...pool[idx], id: 1, name: "今日挑戰" };
}

export function packCount() {
  return LEVELS_PER_SIZE;
}
