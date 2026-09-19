import { ads } from "@/ads/adService";
import { LEVELS_PER_SIZE } from "@/data/constants";
import { loadDaily, loadLevel, loadTutorial } from "@/data/levelRepository";
import { useProgress } from "@/data/progressStore";
import { bbox, fits, pieceAbs } from "@/game/geometry";
import { coverage, evaluate } from "@/game/rules";
import type { LevelData, PieceRuntime } from "@/game/types";
import { colors, fontFamily, softShadow } from "@/theme";
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
  ScrollView,
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

function loadFromParams(mode: string, size: number, id: number): LevelData | null {
  if (mode === "tutorial") return loadTutorial()[id - 1] ?? null;
  if (mode === "daily") return loadDaily();
  return loadLevel(size, id, mode === "extra");
}

function makePieces(level: LevelData): PieceRuntime[] {
  return level.pieces.map((cells, i) => ({
    id: i,
    cells: cells.map(([r, c]) => [r, c] as [number, number]),
    row: null,
    col: null,
  }));
}

export default function PlayScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const progress = useProgress();
  const params = useLocalSearchParams<{
    mode?: string;
    size?: string;
    id?: string;
  }>();
  const mode = params.mode ?? "tutorial";
  const size = Number(params.size ?? 4);
  const levelId = Number(params.id ?? 1);

  const level = useMemo(() => {
    if (mode === "daily") return loadDaily(new Date(), progress.dailySalt);
    return loadFromParams(mode, size, levelId);
  }, [levelId, mode, progress.dailySalt, size]);

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
  const maxBoardW = width - 24;
  const maxBoardH = Math.max(180, height - insets.top - insets.bottom - 340);
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
      await progress.markComplete(size, levelId, mode === "extra");
    }
    const fire = await progress.bumpInterstitial();
    if (fire) await ads.showInterstitial();
  }, [level, levelId, mode, progress, size, won]);

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
        params: { mode: "pack", size: "4", id: "1" },
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
      params: { mode, size: String(size), id: String(next) },
    });
  };

  if (!level || !ev) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.missing}>關卡還在生成中。</Text>
      </View>
    );
  }

  return (
    <View
      ref={rootRef}
      onLayout={measureRoot}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <GridPaper variant="stripe" />
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.back} accessibilityLabel="返回">
          <Text style={styles.backTxt}>‹</Text>
        </PressableScale>
        <LevelBadge text={mode === "daily" ? "日" : String(levelId)} />
      </View>

      <View style={styles.toolRow}>
        <ToolDot label="重來" mark="重" onPress={reset} />
        <ToolDot label="收回" mark="收" onPress={returnSelected} />
        <ToolDot
          label={`提示，剩餘 ${progress.hints}`}
          mark={String(progress.hints)}
          onPress={applyHint}
        />
        <View style={styles.toolMeta}>
          <Text style={styles.toolTitle}>疊數</Text>
          <Text style={styles.toolSub}>
            {pieces.length} 塊 ·{" "}
            {mode === "daily" ? "每日" : mode === "tutorial" ? "教學" : `${size}×${size}`}
          </Text>
        </View>
      </View>

      <View style={styles.boardWrap}>
        <View style={styles.boardFrame}>
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
                  setSelected(ids.includes(selected) ? selected : ids[ids.length - 1]);
                }
              }}
            />
          </View>
        </GestureDetector>
        </View>
      </View>

      <Text style={styles.status}>{status}</Text>

      <View style={[styles.trayBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tray}
        >
          {pieces.map((p) => {
            const spent = p.row != null && dragId !== p.id;
            const pan = makePan(p.id, p.cells[0] ?? [0, 0]).enabled(!spent);
            const tap = Gesture.Tap().onEnd(() => {
              scheduleOnRN(selectTray, p.id);
            });
            return (
              <GestureDetector key={p.id} gesture={Gesture.Exclusive(tap, pan)}>
                <Animated.View
                  accessibilityLabel={spent ? `空位 ${p.cells.length} 格` : `積木 ${p.cells.length} 格`}
                  accessibilityRole="button"
                  style={[styles.trayItem, selected === p.id && styles.trayItemOn]}
                >
                  <PieceShape
                    cells={p.cells}
                    colorId={p.id}
                    cell={16}
                    spent={spent}
                  />
                </Animated.View>
              </GestureDetector>
            );
          })}
        </ScrollView>
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
            params: { size: String(size), extra: mode === "extra" ? "1" : "0" },
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
    paddingLeft: 4,
    paddingRight: 16,
    paddingTop: 4,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backTxt: { fontSize: 34, lineHeight: 36, color: colors.ink, fontFamily },
  badge: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  badgeCore: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.badge,
  },
  badgeGem: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: colors.badge,
    transform: [{ rotate: "45deg" }],
  },
  badgeTxt: {
    color: colors.onInk,
    fontSize: 22,
    fontFamily,
    zIndex: 1,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  tool: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.plum,
    alignItems: "center",
    justifyContent: "center",
    ...softShadow,
  },
  toolMark: { color: colors.onInk, fontSize: 16, fontFamily },
  toolMeta: { flex: 1, paddingLeft: 4 },
  toolTitle: { fontSize: 18, color: colors.ink, fontFamily },
  toolSub: { marginTop: 1, fontSize: 13, color: colors.muted, fontFamily },
  boardWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6 },
  boardFrame: {
    backgroundColor: colors.paper,
    padding: 8,
    borderRadius: 16,
    ...softShadow,
  },
  status: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 13,
    minHeight: 20,
    marginBottom: 4,
    fontFamily,
  },
  trayBar: {
    backgroundColor: colors.tray,
    paddingTop: 10,
  },
  tray: {
    paddingHorizontal: 12,
    gap: 8,
    minHeight: 84,
    alignItems: "center",
    flexDirection: "row",
  },
  trayItem: {
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  trayItemOn: { backgroundColor: "#FFE566" },
  ghost: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 30,
    overflow: "hidden",
    backgroundColor: "rgba(246,241,230,0.02)",
  },
  missing: { textAlign: "center", marginTop: 40, color: colors.muted, fontFamily },
});

function LevelBadge({ text }: { text: string }) {
  return (
    <View style={styles.badge} accessibilityLabel={`第 ${text} 關`}>
      <View style={styles.badgeCore} />
      <View style={styles.badgeGem} />
      <Text style={styles.badgeTxt}>{text}</Text>
    </View>
  );
}

function ToolDot({
  label,
  mark,
  onPress,
}: {
  label: string;
  mark: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={styles.tool}>
      <Text style={[styles.toolMark, mark.length > 2 && { fontSize: 13 }]}>{mark}</Text>
    </PressableScale>
  );
}
