import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { IAP, SIZES, STARTER_HINTS } from "./constants";

const KEY = "dieshu-progress-v1";

type Snapshot = {
  hints: number;
  adsRemoved: boolean;
  levelsSinceInterstitial: number;
  completed: Record<string, boolean>;
  extraUnlocked: number[];
  tutorialDone: boolean;
  dailySalt: number;
  lastDailyKey?: string;
};

const empty: Snapshot = {
  hints: STARTER_HINTS,
  adsRemoved: false,
  levelsSinceInterstitial: 0,
  completed: {},
  extraUnlocked: [],
  tutorialDone: false,
  dailySalt: Math.floor(Math.random() * 1e9),
};

type Store = Snapshot & {
  ready: boolean;
  packKey: (size: number, id: number, extra?: boolean) => string;
  isComplete: (size: number, id: number, extra?: boolean) => boolean;
  markComplete: (size: number, id: number, extra?: boolean) => Promise<void>;
  consumeHint: () => Promise<boolean>;
  addHints: (n: number) => Promise<void>;
  bumpInterstitial: () => Promise<boolean>;
  resetInterstitial: () => Promise<void>;
  unlockExtra: (size: number) => Promise<void>;
  unlockRemoveAds: () => Promise<void>;
  unlockBundle: () => Promise<void>;
  setTutorialDone: () => Promise<void>;
  extraOwned: (size: number) => boolean;
};

const Ctx = createContext<Store | null>(null);

export function packKey(size: number, id: number, extra = false) {
  return `${extra ? "e" : "p"}:${size}:${id}`;
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(empty);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setSnap({ ...empty, ...JSON.parse(raw) });
      } catch {
        /* keep defaults */
      }
      setReady(true);
    })();
  }, []);

  const persist = useCallback(async (next: Snapshot) => {
    setSnap(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const value = useMemo<Store>(() => {
    return {
      ...snap,
      ready,
      packKey,
      isComplete: (size, id, extra) => !!snap.completed[packKey(size, id, extra)],
      markComplete: async (size, id, extra) => {
        const next = {
          ...snap,
          completed: { ...snap.completed, [packKey(size, id, extra)]: true },
        };
        await persist(next);
      },
      consumeHint: async () => {
        if (snap.hints <= 0) return false;
        await persist({ ...snap, hints: snap.hints - 1 });
        return true;
      },
      addHints: async (n) => persist({ ...snap, hints: snap.hints + n }),
      bumpInterstitial: async () => {
        if (snap.adsRemoved) return false;
        const n = snap.levelsSinceInterstitial + 1;
        const fire = n >= 3;
        await persist({
          ...snap,
          levelsSinceInterstitial: fire ? 0 : n,
        });
        return fire;
      },
      resetInterstitial: async () =>
        persist({ ...snap, levelsSinceInterstitial: 0 }),
      unlockExtra: async (size) => {
        if (snap.extraUnlocked.includes(size)) return;
        await persist({
          ...snap,
          extraUnlocked: [...snap.extraUnlocked, size],
        });
      },
      unlockRemoveAds: async () => persist({ ...snap, adsRemoved: true }),
      unlockBundle: async () => {
        await persist({
          ...snap,
          adsRemoved: true,
          hints: snap.hints + IAP.bundle.hints,
          extraUnlocked: [...SIZES],
        });
      },
      setTutorialDone: async () => persist({ ...snap, tutorialDone: true }),
      extraOwned: (size) =>
        snap.extraUnlocked.includes(size) ||
        snap.extraUnlocked.length >= SIZES.length,
    };
  }, [persist, ready, snap]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProgress() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("ProgressProvider missing");
  return ctx;
}
