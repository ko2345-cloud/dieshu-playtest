import { ads } from "@/ads/adService";
import { LEVELS_PER_SIZE } from "@/data/constants";
import { loadDaily, loadLevel, loadTutorial } from "@/data/levelRepository";
import { useProgress } from "@/data/progressStore";
import { bbox, fits, pieceAbs } from "@/game/geometry";
import { coverage, evaluate } from "@/game/rules";
import type { LevelCategory, LevelData, PieceRuntime } from "@/game/types";
import { colors, fontFamily } from "@/theme";
import { BannerAdBar } from "@/ui/BannerAdBar";
import { Board } from "@/ui/Board";
import { GridPaper } from "@/ui/GridPaper";
import { HelpModal } from "@/ui/HelpModal";
import { PieceShape } from "@/ui/PieceShape";
import { PressableScale } from "@/ui/PressableScale";
import { WinModal } from "@/ui/WinModal";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

const STATUS_DRAG = "把積木拖到棋盤。拖出外面可收回。";

const IMG_UNDO = require("../../Art/undo.png");
const IMG_RESET = require("../../Art/reset.png");
const IMG_HINT = require("../../Art/hint.png");
const IMG_ADS = require("../../Art/Ads.png");
const IMG_REMOVE_ADS = require("../../Art/remove_ads_r.png");
const IMG_SETTING = require("../../Art/setting.png");

const TRAY_MAX_COLS = 5;
const TOOL_SIZE = 52;
const HINT_W = 132;
const HINT_H = 52;

function loadFromParams(
  mode: string,
  size: number,
  id: number,
  category: LevelCategory,
): LevelData | null {
  if (mode === "tutorial") return loadTutorial()[id - 1] ?? null;
  if (mode === "daily") return loadDaily();
  return loadLevel(size, id, mode === "extra", category);
}

function makePieces(level: LevelData): PieceRuntime[] {
  return level.pieces.map((cells, i) => ({
    id: i,
    cells: cells.map(([r, c]) => [r, c] as [number, number]),
    row: null,
    col: null,
  }));
}

function levelTitle(
  mode: string,
  size: number,
  levelId: number,
  category: LevelCategory,
): string {
  if (mode === "daily") return "Daily";
  if (mode === "tutorial") return `Tutorial ${levelId}`;
  if (mode === "extra") return `${size}×${size} Extra ${levelId}`;
  const kind = category === "tetro" ? "七型" : "方型";
  return `${size}×${size} ${kind} ${levelId}`;
}

export default function PlayScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowW, height } = useWindowDimensions();
  /** Layout width of this screen. On web the window is wider than the 480 frame. */
  const [frameW, setFrameW] = useState(
    Platform.OS === "web" ? Math.min(windowW, 480) : windowW,
  );
  const progress = useProgress();
  const params = useLocalSearchParams<{
    mode?: string;
    size?: string;
    id?: string;
    cat?: string;
  }>();
  const mode = params.mode ?? "tutorial";
  const size = Number(params.size ?? 4);
  const levelId = Number(params.id ?? 1);
  const category: LevelCategory = params.cat === "tetro" ? "tetro" : "rect";

  const level = useMemo(() => {
    if (mode === "daily") return loadDaily(new Date(), progress.dailySalt);
    return loadFromParams(mode, size, levelId, category);
  }, [category, levelId, mode, progress.dailySalt, size]);

  const [pieces, setPieces] = useState<PieceRuntime[]>([]);
  const [selected, setSelected] = useState(0);
  const [won, setWon] = useState(false);
  const [help, setHelp] = useState(mode === "tutorial" && levelId === 1);
  const [status, setStatus] = useState(STATUS_DRAG);
  const [dragId, setDragId] = useState<number | null>(null);
  const boardRef = useRef<View>(null);
  /** Pixel origin of the Board view itself (not the full-width wrap). */
  const boardOrigin = useRef({ x: 0, y: 0, ready: false });
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const dragIdRef = useRef<number | null>(null);
  const grabRel = useRef<[number, number]>([0, 0]);
  const cellLayout = useRef({ cell: 36, gap: 5, pad: 10 });

  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const gVisible = useSharedValue(0);
  const ghostOffX = useSharedValue(0);
  const ghostOffY = useSharedValue(0);
  /** Play-root origin in window coords. Ghost is positioned inside this view, not the window. */
  const rootX = useSharedValue(0);
  const rootY = useSharedValue(0);
  const rootRef = useRef<View>(null);

  const measureRoot = () => {
    rootRef.current?.measureInWindow((x, y) => {
      rootX.set(x);
      rootY.set(y);
    });
  };

  const onRootLayout = (w: number) => {
    if (w > 0 && Math.abs(w - frameW) > 0.5) setFrameW(w);
    measureRoot();
  };

  useEffect(() => {
    dragIdRef.current = dragId;
  }, [dragId]);

  useEffect(() => {
    if (!level) return;
    setPieces(makePieces(level));
    setSelected(0);
    setWon(false);
    setStatus(STATUS_DRAG);
  }, [level]);

  const gap = 0;
  const pad = 8;
  const bannerH = progress.adsRemoved ? 0 : 50;
  const headerH = 52;
  const toolH = TOOL_SIZE + 20;
  const statusH = 22;
  const trayBudget = Math.max(
    130,
    Math.min(260, Math.floor(height * 0.28)),
  );
  const maxBoardW = frameW - 24;
  const maxBoardH = Math.max(
    160,
    height -
      insets.top -
      insets.bottom -
      bannerH -
      headerH -
      toolH -
      statusH -
      trayBudget -
      24,
  );
  const cell = level
    ? Math.max(
        18,
        Math.min(
          56,
          Math.floor(
            Math.min(
              (maxBoardW - pad * 2) / level.cols,
              (maxBoardH - pad * 2) / level.rows,
            ),
          ),
        ),
      )
    : 36;

  cellLayout.current = { cell, gap, pad };

  const trayLayout = useMemo(() => {
    const n = Math.max(1, pieces.length);
    const cols = Math.min(TRAY_MAX_COLS, n);
    const rows = Math.ceil(n / cols);
    const hPad = 12;
    const vPad = 8;
    const gapX = 8;
    const gapY = 6;
    const cardPad = 6;
    const labelH = 20;
    const innerW = Math.max(0, frameW - hPad * 2);
    const slotW = Math.max(32, (innerW - gapX * (cols - 1)) / cols);
    const rowH = Math.max(
      40,
      (trayBudget - vPad * 2 - gapY * (rows - 1)) / rows,
    );
    const slotBodyH = Math.max(24, rowH - labelH);

    const boxes = pieces.map((p) => {
      const b = bbox(p.cells);
      return { id: p.id, w: Math.max(1, b.w), h: Math.max(1, b.h) };
    });

    const maxW = Math.max(1, ...boxes.map((b) => b.w));
    const maxH = Math.max(1, ...boxes.map((b) => b.h));
    const fitW = Math.max(8, slotW - cardPad * 2);
    const fitH = Math.max(8, slotBodyH - cardPad * 2);
    const trayCell = Math.max(1, Math.min(16, fitW / maxW, fitH / maxH));

    return {
      cols,
      rows,
      hPad,
      vPad,
      gapX,
      gapY,
      cardPad,
      labelH,
      slotW,
      trayCell,
    };
  }, [frameW, pieces, trayBudget]);

  const ev = level
    ? evaluate(pieces, level.rows, level.cols, level.clues)
    : null;

  const selectedCells = useMemo(() => {
    const p = pieces[selected];
    if (!p || p.row == null) return [];
    return pieceAbs(p.cells, p.row, p.col);
  }, [pieces, selected]);

  const measureBoard = (cb?: () => void) => {
    boardRef.current?.measureInWindow((x, y) => {
      boardOrigin.current = { x, y, ready: true };
      cb?.();
    });
  };

  const cellFromPoint = (absX: number, absY: number) => {
    if (!level || !boardOrigin.current.ready) return null;
    const { x, y } = boardOrigin.current;
    const { cell: cs, gap: g, pad: p } = cellLayout.current;
    const localX = absX - x - p;
    const localY = absY - y - p;
    if (localX < 0 || localY < 0) return null;
    const stride = cs + g;
    const c = Math.floor(localX / stride);
    const r = Math.floor(localY / stride);
    // Ignore the gap strip past the last cell edge.
    if (r < 0 || c < 0 || r >= level.rows || c >= level.cols) return null;
    const inCellX = localX - c * stride;
    const inCellY = localY - r * stride;
    if (inCellX > cs || inCellY > cs) return null;
    return { r, c };
  };

  const tryPlace = (id: number, row: number, col: number) => {
    if (!level || won) return false;
    const p = piecesRef.current.find((x) => x.id === id);
    if (!p) return false;
    if (!fits(p.cells, row, col, level.rows, level.cols)) {
      setStatus("超出棋盤了，換個位置（可以重疊）。");
      return false;
    }
    setPieces((prev) =>
      prev.map((piece) => (piece.id === id ? { ...piece, row, col } : piece)),
    );
    setStatus(STATUS_DRAG);
    return true;
  };

  const returnSelected = () => {
    if (won) return;
    setPieces((prev) =>
      prev.map((p) => (p.id === selected ? { ...p, row: null, col: null } : p)),
    );
    setStatus("積木已收回。");
  };

  const reset = () => {
    if (!level) return;
    setPieces(makePieces(level));
    setWon(false);
    setSelected(0);
    setStatus(STATUS_DRAG);
  };

  const applyHint = async () => {
    if (!level || won) return;
    let ok = await progress.consumeHint();
    if (!ok) {
      ok = await ads.showRewarded();
      if (!ok) return;
    }
    setPieces((prev) => {
      const next = prev.map((p) => ({
        ...p,
        cells: p.cells.map((c) => [...c] as [number, number]),
      }));
      const idx = next.findIndex((p, i) => {
        const sol = level.solution[i];
        return p.row !== sol.row || p.col !== sol.col;
      });
      if (idx < 0) return prev;
      next[idx] = {
        ...next[idx],
        cells: level.pieces[idx].map(([r, c]) => [r, c] as [number, number]),
        row: level.solution[idx].row,
        col: level.solution[idx].col,
      };
      setSelected(idx);
      return next;
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const finishWin = useCallback(async () => {
    if (!level || won) return;
    setWon(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (mode === "tutorial") {
      if (levelId >= loadTutorial().length) await progress.setTutorialDone();
    } else if (mode === "pack" || mode === "extra") {
      await progress.markComplete(size, levelId, mode === "extra", category);
    }
    const fire = await progress.bumpInterstitial();
    if (fire) await ads.showInterstitial();
  }, [category, level, levelId, mode, progress, size, won]);

  useEffect(() => {
    if (ev?.win && !won && dragId == null) finishWin();
    else if (ev && !won && ev.allPlaced && ev.filled && !ev.win) {
      setStatus("棋盤滿了，但數字還沒對上。試試改重疊。");
    }
  }, [dragId, ev, finishWin, won]);

  const beginDrag = (
    id: number,
    absX: number,
    absY: number,
    rel: [number, number],
  ) => {
    measureBoard();
    setSelected(id);
    setDragId(id);
    dragIdRef.current = id;
    grabRel.current = rel;
    const { cell: cs, gap: g } = cellLayout.current;
    ghostOffX.set(rel[1] * (cs + g) + cs / 2);
    ghostOffY.set(rel[0] * (cs + g) + cs / 2);
    setPieces((prev) =>
      prev.map((p) => (p.id === id ? { ...p, row: null, col: null } : p)),
    );
    gx.set(absX);
    gy.set(absY);
    gVisible.set(1);
    void Haptics.selectionAsync();
  };

  const finishDrop = (id: number, absX: number, absY: number) => {
    gVisible.set(0);
    setDragId(null);
    dragIdRef.current = null;
    const [gr, gc] = grabRel.current;
    // Finger is on grabRel cell of the ghost → piece anchor = finger cell − grabRel.
    const at = cellFromPoint(absX, absY);
    if (at && level) {
      const placed = tryPlace(id, at.r - gr, at.c - gc);
      if (!placed) setStatus("超出棋盤了，積木已收回托盤。（可以重疊）");
    } else {
      setStatus("積木已收回。");
    }
  };

  const endDrag = (id: number, absX: number, absY: number) => {
    // Remeasure then drop — measureInWindow is async.
    measureBoard(() => finishDrop(id, absX, absY));
  };

  const endDragFromBoard = (absX: number, absY: number) => {
    const id = dragIdRef.current;
    if (id == null) return;
    endDrag(id, absX, absY);
  };

  const pickBoardPiece = (absX: number, absY: number) => {
    if (!level || won) return;
    const run = () => {
      const at = cellFromPoint(absX, absY);
      if (!at) return;
      const ids = coverage(piecesRef.current, level.rows, level.cols)[at.r][at.c];
      if (!ids.length) return;
      const id = ids.includes(selected) ? selected : ids[ids.length - 1];
      const p = piecesRef.current.find((x) => x.id === id);
      if (!p || p.row == null || p.col == null) return;
      const rel: [number, number] = [at.r - p.row, at.c - p.col];
      beginDrag(id, absX, absY, rel);
    };
    if (boardOrigin.current.ready) run();
    else measureBoard(run);
  };

  const ghostStyle = useAnimatedStyle(() => ({
    opacity: gVisible.get(),
    transform: [
      { translateX: gx.get() - rootX.get() - ghostOffX.get() },
      { translateY: gy.get() - rootY.get() - ghostOffY.get() },
    ],
  }));

  const makePan = (id: number, rel: [number, number] = [0, 0]) =>
    Gesture.Pan()
      .activeOffsetX([-8, 8])
      .activeOffsetY([-8, 8])
      .onStart((e) => {
        scheduleOnRN(beginDrag, id, e.absoluteX, e.absoluteY, rel);
      })
      .onUpdate((e) => {
        gx.set(e.absoluteX);
        gy.set(e.absoluteY);
      })
      .onEnd((e) => {
        // Hide on the UI thread before JS measures the drop. Springing the
        // ghost back to the origin left orange streaks beside the board.
        gVisible.set(0);
        scheduleOnRN(endDrag, id, e.absoluteX, e.absoluteY);
      });

  const boardGesture = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .activeOffsetY([-6, 6])
    .onStart((e) => {
      scheduleOnRN(pickBoardPiece, e.absoluteX, e.absoluteY);
    })
    .onUpdate((e) => {
      gx.set(e.absoluteX);
      gy.set(e.absoluteY);
    })
    .onEnd((e) => {
      gVisible.set(0);
      scheduleOnRN(endDragFromBoard, e.absoluteX, e.absoluteY);
    });

  const selectTray = (id: number) => setSelected(id);

  const goNext = () => {
    setWon(false);
    if (mode === "tutorial") {
      const tut = loadTutorial();
      if (levelId < tut.length) {
        router.replace({
          pathname: "/play",
          params: { mode: "tutorial", id: String(levelId + 1) },
        });
        return;
      }
      router.replace({
        pathname: "/play",
        params: { mode: "pack", size: "4", id: "1", cat: "rect" },
      });
      return;
    }
    if (mode === "daily") {
      router.back();
      return;
    }
    const next = levelId + 1;
    if (next > LEVELS_PER_SIZE) {
      router.back();
      return;
    }
    router.replace({
      pathname: "/play",
      params: { mode, size: String(size), id: String(next), cat: category },
    });
  };

  if (!level || !ev) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.missing}>關卡還在生成中。</Text>
      </View>
    );
  }

  const title = levelTitle(mode, size, levelId, category);

  return (
    <View
      ref={rootRef}
      onLayout={(e) => onRootLayout(e.nativeEvent.layout.width)}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <GridPaper variant="stripe" />

      <View style={styles.header}>
        <Text
          style={styles.title}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {title}
        </Text>
        <View style={styles.headerRight}>
          {!progress.adsRemoved ? (
            <PressableScale
              onPress={() => router.push("/shop")}
              accessibilityLabel="移除廣告"
              style={styles.headerBtn}
            >
              <Image
                source={IMG_REMOVE_ADS}
                style={styles.headerIcon}
                resizeMode="contain"
              />
            </PressableScale>
          ) : null}
          <PressableScale
            onPress={() => router.back()}
            accessibilityLabel="選單"
            style={styles.headerBtn}
          >
            <Image
              source={IMG_SETTING}
              style={styles.headerIcon}
              resizeMode="contain"
            />
          </PressableScale>
        </View>
      </View>

      <View style={styles.boardWrap}>
        <GestureDetector gesture={boardGesture}>
          <View
            ref={boardRef}
            onLayout={() => measureBoard()}
            collapsable={false}
          >
            <Board
              rows={level.rows}
              cols={level.cols}
              cell={cell}
              gap={gap}
              cover={ev.cover}
              clueState={ev.clueState}
              selectedCells={selectedCells}
              invalidCells={[]}
              onCellPress={(r, c) => {
                if (won) return;
                const ids = coverage(pieces, level.rows, level.cols)[r][c];
                if (ids.length) {
                  setSelected(
                    ids.includes(selected) ? selected : ids[ids.length - 1],
                  );
                }
              }}
            />
          </View>
        </GestureDetector>
      </View>

      <Text style={styles.status} numberOfLines={1}>
        {status}
      </Text>

      <View style={styles.toolRow}>
        <PressableScale
          onPress={returnSelected}
          accessibilityLabel="收回"
          style={styles.toolBtn}
        >
          <Image source={IMG_UNDO} style={styles.toolIcon} resizeMode="contain" />
        </PressableScale>
        <PressableScale
          onPress={reset}
          accessibilityLabel="重來"
          style={styles.toolBtn}
        >
          <Image source={IMG_RESET} style={styles.toolIcon} resizeMode="contain" />
        </PressableScale>
        <PressableScale
          onPress={applyHint}
          accessibilityLabel={
            progress.hints > 0
              ? `提示，剩餘 ${progress.hints}`
              : "提示，看廣告取得"
          }
          style={styles.hintBtn}
        >
          <Image source={IMG_HINT} style={styles.hintBg} resizeMode="stretch" />
          <View style={styles.hintSlot} pointerEvents="none">
            {progress.hints > 0 ? (
              <Text style={styles.hintCount}>{progress.hints}</Text>
            ) : (
              <Image
                source={IMG_ADS}
                style={styles.hintAds}
                resizeMode="contain"
              />
            )}
          </View>
        </PressableScale>
      </View>

      <View
        style={[
          styles.trayBar,
          {
            paddingHorizontal: trayLayout.hPad,
            paddingTop: trayLayout.vPad,
            paddingBottom: Math.max(insets.bottom, trayLayout.vPad),
          },
        ]}
      >
        <View style={[styles.trayGrid, { gap: trayLayout.gapY }]}>
          {Array.from({ length: trayLayout.rows }, (_, row) => (
            <View
              key={`tray-row-${row}`}
              style={[styles.trayRow, { gap: trayLayout.gapX }]}
            >
              {pieces
                .slice(
                  row * trayLayout.cols,
                  row * trayLayout.cols + trayLayout.cols,
                )
                .map((p) => {
                  const spent = p.row != null && dragId !== p.id;
                  const pan = makePan(p.id, p.cells[0] ?? [0, 0]).enabled(
                    !spent,
                  );
                  const tap = Gesture.Tap().onEnd(() => {
                    scheduleOnRN(selectTray, p.id);
                  });
                  return (
                    <GestureDetector
                      key={p.id}
                      gesture={Gesture.Exclusive(tap, pan)}
                    >
                      <Animated.View
                        accessibilityLabel={
                          spent
                            ? `空位 ${p.cells.length} 格`
                            : `積木 ${p.cells.length} 格`
                        }
                        accessibilityRole="button"
                        style={[styles.traySlot, { width: trayLayout.slotW }]}
                      >
                        <View
                          style={[
                            styles.trayCard,
                            { padding: trayLayout.cardPad },
                            selected === p.id && styles.trayCardOn,
                          ]}
                        >
                          <PieceShape
                            cells={p.cells}
                            colorId={p.id}
                            cell={trayLayout.trayCell}
                            spent={spent}
                          />
                        </View>
                        <Text style={styles.trayCount}>{p.cells.length}</Text>
                      </Animated.View>
                    </GestureDetector>
                  );
                })}
            </View>
          ))}
        </View>
      </View>

      <Animated.View
        collapsable={false}
        pointerEvents="none"
        style={[
          styles.ghost,
          dragId != null && {
            width: bbox(pieces[dragId]?.cells ?? []).w * cell,
            height: bbox(pieces[dragId]?.cells ?? []).h * cell,
          },
          ghostStyle,
        ]}
      >
        {dragId != null ? (
          <PieceShape
            cells={pieces[dragId]?.cells ?? []}
            colorId={dragId}
            cell={cell}
          />
        ) : null}
      </Animated.View>

      <HelpModal visible={help} onClose={() => setHelp(false)} />
      <WinModal
        visible={won}
        title="解開了"
        body={
          mode === "daily"
            ? "今天的挑戰完成了。明天再來一題。"
            : "重疊位置對了，數字也對上了。"
        }
        primary={mode === "daily" ? "回到主頁" : "下一關"}
        onPrimary={goNext}
        secondary="選關"
        onSecondary={() => {
          setWon(false);
          router.push({
            pathname: "/levels",
            params: {
              size: String(size),
              extra: mode === "extra" ? "1" : "0",
              cat: category,
            },
          });
        }}
      />
      <BannerAdBar visible={!progress.adsRemoved} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 10,
    paddingTop: 6,
    paddingBottom: 4,
    minHeight: 48,
  },
  title: {
    flex: 1,
    flexShrink: 1,
    fontSize: 18,
    color: colors.ink,
    fontFamily,
    fontWeight: "700",
    paddingRight: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: { width: 36, height: 36 },
  boardWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  status: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 12,
    minHeight: 18,
    marginBottom: 2,
    paddingHorizontal: 12,
    fontFamily,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 14,
  },
  toolBtn: {
    width: TOOL_SIZE,
    height: TOOL_SIZE,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  toolIcon: { width: TOOL_SIZE, height: TOOL_SIZE },
  hintBtn: {
    width: HINT_W,
    height: HINT_H,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  hintBg: {
    width: HINT_W,
    height: HINT_H,
  },
  /** Right half of the hint pill. Parent is position relative, so this stays inside. */
  hintSlot: {
    position: "absolute",
    left: HINT_W * 0.48,
    right: 8,
    top: 6,
    bottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  hintCount: {
    color: colors.ink,
    fontSize: 22,
    fontFamily,
    fontWeight: "800",
  },
  hintAds: {
    width: 28,
    height: 22,
  },
  trayBar: {
    width: "100%",
    backgroundColor: colors.tray,
  },
  trayGrid: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  trayRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    width: "100%",
  },
  traySlot: {
    alignItems: "center",
    flexGrow: 0,
    flexShrink: 0,
  },
  trayCard: {
    backgroundColor: colors.paper,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  trayCardOn: {
    backgroundColor: "#FFE566",
  },
  trayCount: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    color: colors.ink,
    fontFamily,
    fontWeight: "700",
    textAlign: "center",
  },
  ghost: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 30,
    overflow: "hidden",
    backgroundColor: "rgba(246,241,230,0.02)",
  },
  missing: {
    textAlign: "center",
    marginTop: 40,
    color: colors.muted,
    fontFamily,
  },
});
