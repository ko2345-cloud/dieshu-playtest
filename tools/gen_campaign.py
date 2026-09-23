"""Overlap-number level generator. Fixed orientation (no rotate). Sparse clues.

Two packs: rectangles (方型積木) and the seven tetrominoes (七型方塊).
A tetromino may be stored already rotated; the player still cannot turn it.
"""
from __future__ import annotations

import json
import random
import sys
import time
from collections import defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "levels"

SIZES = [4, 5, 6, 7, 8]
# Rectangles only (squares included). Each piece has at most MAX_PIECE_CELLS.
MAX_PIECE_CELLS = 20
MAX_CLUES = 6
PIECE_RANGE = {
    4: (2, 5),
    5: (3, 6),
    6: (4, 7),
    7: (4, 8),
    8: (5, 9),
}
# Every tetromino is 4 cells, so the low end is the smallest count that can
# cover the board and still overlap. High end stays close so the tray stays playable.
TETRO_RANGE = {
    4: (5, 6),
    5: (7, 8),
    6: (10, 11),
    7: (13, 14),
    8: (18, 19),
}
CLUE_RANGE = {
    4: (2, 5),
    5: (2, 6),
    6: (3, 6),
    7: (3, 6),
    8: (4, 6),
}
FREE_PER_SIZE = 5
EXTRA_PER_SIZE = 5
FALLBACK_PER_SIZE = 5
NEIGH = ((1, 0), (-1, 0), (0, 1), (0, -1))


def normalize(cells):
    cells = list(cells)
    mr = min(r for r, _ in cells)
    mc = min(c for _, c in cells)
    return tuple(sorted((r - mr, c - mc) for r, c in cells))


def in_bounds(r, c, size):
    return 0 <= r < size and 0 <= c < size


def connected(cells):
    cells = set(cells)
    if not cells:
        return False
    start = next(iter(cells))
    seen = {start}
    q = deque([start])
    while q:
        r, c = q.popleft()
        for dr, dc in NEIGH:
            n = (r + dr, c + dc)
            if n in cells and n not in seen:
                seen.add(n)
                q.append(n)
    return len(seen) == len(cells)


def cover_map(placed):
    cover = defaultdict(set)
    for i, cells in enumerate(placed):
        for cell in cells:
            cover[cell].add(i)
    return {k: frozenset(v) for k, v in cover.items()}


def regions_from_cover(cover, rows, cols):
    visited = set()
    regs = []
    for r in range(rows):
        for c in range(cols):
            if (r, c) in visited:
                continue
            sig = cover.get((r, c), frozenset())
            q = deque([(r, c)])
            visited.add((r, c))
            cells = []
            while q:
                x, y = q.popleft()
                cells.append((x, y))
                for dx, dy in NEIGH:
                    nx, ny = x + dx, y + dy
                    if (
                        0 <= nx < rows
                        and 0 <= ny < cols
                        and (nx, ny) not in visited
                        and cover.get((nx, ny), frozenset()) == sig
                    ):
                        visited.add((nx, ny))
                        q.append((nx, ny))
            regs.append({"sig": sig, "cells": cells})
    return regs


def clues_from_regions(regs):
    clues = []
    for reg in regs:
        if not reg["sig"]:
            return None
        cell = min(reg["cells"], key=lambda x: (x[0], x[1]))
        clues.append({"r": int(cell[0]), "c": int(cell[1]), "n": len(reg["cells"])})
    return clues


def region_sizes(cover, rows, cols):
    sizes = {}
    for reg in regions_from_cover(cover, rows, cols):
        n = len(reg["cells"]) if reg["sig"] else 0
        for cell in reg["cells"]:
            sizes[cell] = n
    return sizes


def satisfies(placed, rows, cols, clues):
    cover = cover_map(placed)
    if any((r, c) not in cover for r in range(rows) for c in range(cols)):
        return False
    sizes = region_sizes(cover, rows, cols)
    return all(sizes.get((cl["r"], cl["c"]), 0) == cl["n"] for cl in clues)


def exclusives_and_overlap(placed, size):
    cover = cover_map(placed)
    excl = [0] * len(placed)
    overlap = 0
    empty = 0
    for r in range(size):
        for c in range(size):
            sig = cover.get((r, c), frozenset())
            if not sig:
                empty += 1
            elif len(sig) == 1:
                excl[next(iter(sig))] += 1
            else:
                overlap += 1
    return excl, overlap, empty


def is_rect(cells):
    """Solid rectangle, including 1×n bars and squares. Area ≤ MAX_PIECE_CELLS."""
    cells = {(int(r), int(c)) for r, c in cells}
    if len(cells) < 2 or len(cells) > MAX_PIECE_CELLS:
        return False
    mr = min(r for r, _ in cells)
    mc = min(c for _, c in cells)
    h = max(r for r, _ in cells) - mr + 1
    w = max(c for _, c in cells) - mc + 1
    return h * w == len(cells)


def rect_cells(h, w, row, col):
    return tuple(sorted((row + dr, col + dc) for dr in range(h) for dc in range(w)))


def guillotine(h, w, n, rng, r0, c0, depth=0, unique=True, used=None):
    """Split an h×w block into n rectangles, each with area ≤ MAX_PIECE_CELLS.

    unique=True refuses a height×width already used in this split. 1×4 and 4×1
    still count as different, because pieces cannot rotate.
    """
    used = set() if used is None else used
    if n == 1:
        if not (2 <= h * w <= MAX_PIECE_CELLS):
            return None
        if unique and (h, w) in used:
            return None
        return [(h, w, r0, c0)]
    if depth > 24:
        return None
    orients = []
    if w >= 2:
        orients.append("v")
    if h >= 2:
        orients.append("h")
    rng.shuffle(orients)
    for orient in orients:
        span = w if orient == "v" else h
        cuts = list(range(1, span))
        rng.shuffle(cuts)
        for cut in cuts[:8]:
            if orient == "v":
                left_area = h * cut
                right_area = h * (w - cut)
                k_lo = max(1, (left_area + MAX_PIECE_CELLS - 1) // MAX_PIECE_CELLS)
                k_hi = n - max(1, (right_area + MAX_PIECE_CELLS - 1) // MAX_PIECE_CELLS)
                if k_lo > k_hi:
                    continue
                k = rng.randint(k_lo, k_hi)
                left = guillotine(h, cut, k, rng, r0, c0, depth + 1, unique, used)
                if left is None:
                    continue
                right = guillotine(
                    h,
                    w - cut,
                    n - k,
                    rng,
                    r0,
                    c0 + cut,
                    depth + 1,
                    unique,
                    used | {(hh, ww) for hh, ww, _, _ in left},
                )
                if right is not None:
                    return left + right
            else:
                top_area = cut * w
                bot_area = (h - cut) * w
                k_lo = max(1, (top_area + MAX_PIECE_CELLS - 1) // MAX_PIECE_CELLS)
                k_hi = n - max(1, (bot_area + MAX_PIECE_CELLS - 1) // MAX_PIECE_CELLS)
                if k_lo > k_hi:
                    continue
                k = rng.randint(k_lo, k_hi)
                top = guillotine(cut, w, k, rng, r0, c0, depth + 1, unique, used)
                if top is None:
                    continue
                bot = guillotine(
                    h - cut,
                    w,
                    n - k,
                    rng,
                    r0 + cut,
                    c0,
                    depth + 1,
                    unique,
                    used | {(hh, ww) for hh, ww, _, _ in top},
                )
                if bot is not None:
                    return top + bot
    return None

def band_partition(size, n, rng):
    """Fallback: horizontal bands, one vertical split if there are more pieces than rows."""
    max_h = max(1, MAX_PIECE_CELLS // size)
    bands = min(n, size)
    if bands * max_h < size:
        return None
    heights = [1] * bands
    extra = size - bands
    order = list(range(bands))
    rng.shuffle(order)
    for i in order:
        while extra > 0 and heights[i] < max_h:
            heights[i] += 1
            extra -= 1
    if extra:
        return None
    rects = []
    row = 0
    splits = n - bands
    for h in heights:
        if splits > 0 and size >= 2:
            cut = rng.randint(1, size - 1)
            rects.append((h, cut, row, 0))
            rects.append((h, size - cut, row, cut))
            splits -= 1
        else:
            rects.append((h, size, row, 0))
        row += h
    if splits or row != size:
        return None
    if any(h * w < 2 or h * w > MAX_PIECE_CELLS for h, w, _, _ in rects):
        return None
    return rects


def expand_rects(rects, size, rng, unique=False):
    """Grow rectangle edges so pieces overlap, without swallowing anyone's private cell.

    unique=True will not grow a piece into a height×width another piece already has.
    """
    rects = [list(item) for item in rects]
    protected = [(r + h // 2, c + w // 2) for h, w, r, c in rects]
    grew = 0
    order = list(range(len(rects)))
    rng.shuffle(order)
    for _round in range(3):
        for i in order:
            h, w, r, c = rects[i]
            others = {(rects[j][0], rects[j][1]) for j in range(len(rects)) if j != i}
            moves = []
            if r > 0:
                moves.append((-1, 0, 1, 0))
            if r + h < size:
                moves.append((0, 0, 1, 0))
            if c > 0:
                moves.append((0, -1, 0, 1))
            if c + w < size:
                moves.append((0, 0, 0, 1))
            rng.shuffle(moves)
            legal = []
            for dr, dc, dh, dw in moves:
                nh, nw, nr, nc = h + dh, w + dw, r + dr, c + dc
                if nh * nw > MAX_PIECE_CELLS or nh > size or nw > size:
                    continue
                new_cells = set(rect_cells(nh, nw, nr, nc))
                if any(j != i and cell in new_cells for j, cell in enumerate(protected)):
                    continue
                legal.append(((nh, nw) in others, nh, nw, nr, nc))
            legal.sort(key=lambda item: item[0])
            for collides, nh, nw, nr, nc in legal:
                if unique and collides:
                    break
                rects[i] = [nh, nw, nr, nc]
                grew += 1
                break
    if grew == 0:
        return None
    dims = [(h, w) for h, w, _, _ in rects]
    pos = [(r, c) for _, _, r, c in rects]
    placed = [rect_cells(h, w, r, c) for h, w, r, c in rects]
    if not quality_ok(placed, size) or any(not is_rect(p) for p in placed):
        return None
    if unique and len(dims) != len(set(dims)):
        return None
    return placed, pos, dims


def nudge_decoy(size, dims, pos, rng):
    """Move one or two rectangles. Same shapes, different overlap."""
    found = sample_rect_decoys(size, dims, pos, rng, want=1)
    return found[0] if found else None


def sample_rect_decoys(size, dims, pos, rng, want=10):
    """Several full covers that are not the solution. Clues must reject all of them."""
    origin = [tuple(p) for p in pos]
    seen = {tuple(origin)}
    found = []
    n = len(dims)

    def placed_at(new_pos):
        return [rect_cells(h, w, r, c) for (h, w), (r, c) in zip(dims, new_pos)]

    for k, tries in ((1, 36), (2, 48)):
        if k > n or len(found) >= want:
            break
        for _ in range(tries):
            new_pos = list(origin)
            for i in rng.sample(range(n), k):
                h, w = dims[i]
                new_pos[i] = (rng.randint(0, size - h), rng.randint(0, size - w))
            key = tuple(new_pos)
            if key in seen:
                continue
            seen.add(key)
            placed = placed_at(new_pos)
            if quality_ok(placed, size):
                found.append(placed)
                if len(found) >= want:
                    break
    return found


def _level_from_pair(size, n_clues, rng, dims, placed_a, pos_a):
    cover = cover_map(placed_a)
    regs = regions_from_cover(cover, size, size)
    full = clues_from_regions(regs)
    if full is None or not enough_local_regions(regs, size):
        return None
    decoys = decoys_split_locally(full, sample_rect_decoys(size, dims, pos_a, rng, want=8), size)
    if not decoys:
        return None
    clues = reasoning_clues(full, size, n_clues, decoys, rng)
    if clues is None:
        return None
    pieces, solution = placed_to_pieces_and_solution(placed_a)
    if any(not is_rect(p) for p in pieces):
        return None
    return {
        "rows": size,
        "cols": size,
        "clues": clues,
        "pieces": pieces,
        "solution": solution,
    }


def generate_one(size, n_pieces, n_clues, rng):
    if n_pieces * MAX_PIECE_CELLS < size * size:
        return None
    # Prefer every piece a different height×width. Duplicates only if that fails.
    for unique in (True, False):
        rounds = 40 if unique else 20
        for _ in range(rounds):
            rects = guillotine(size, size, n_pieces, rng, 0, 0, unique=unique)
            if rects is None and not unique:
                rects = band_partition(size, n_pieces, rng)
            if not rects:
                continue
            rng.shuffle(rects)
            expanded = expand_rects(rects, size, rng, unique=unique)
            if not expanded:
                continue
            placed_a, pos_a, dims = expanded
            if unique and len(dims) != len(set(dims)):
                continue
            lvl = _level_from_pair(size, n_clues, rng, dims, placed_a, pos_a)
            if lvl:
                return lvl
    return None


def placed_to_pieces_and_solution(placed):
    pieces = []
    solution = []
    for cells in placed:
        mr = min(r for r, _ in cells)
        mc = min(c for _, c in cells)
        pieces.append([[int(r), int(c)] for r, c in normalize(cells)])
        solution.append({"row": int(mr), "col": int(mc)})
    return pieces, solution


def quality_ok(placed, size):
    excl, overlap, empty = exclusives_and_overlap(placed, size)
    if empty or overlap == 0:
        return False
    if any(v == 0 for v in excl):
        return False
    return all(connected(p) for p in placed)


def signature(placed):
    return tuple(tuple(p) for p in placed)


def decoys_split_locally(full, decoys, size):
    """Wrong layouts a 2–4 can catch, versus ones that only change a big blob."""
    local = []
    for placed in decoys:
        smap = _placement_sizes(placed, size)
        if any(cl["n"] <= 4 and smap.get((cl["r"], cl["c"]), 0) != cl["n"] for cl in full):
            local.append(placed)
    return local


def enough_local_regions(regs, size):
    """Large boards need several small regions, or there is nowhere to start deducing."""
    if size < 6:
        return True
    small = sum(1 for reg in regs if reg["sig"] and len(reg["cells"]) <= 4)
    return small >= 4


def _placement_sizes(placed, size):
    return region_sizes(cover_map(placed), size, size)


def _kills_all(chosen, decoy_maps):
    for smap in decoy_maps:
        if all(smap.get((c["r"], c["c"]), 0) == c["n"] for c in chosen):
            return False
    return True


def _local_bonus(n):
    # 2–4 is a step you can finish and then use. A lone 1 only says "not the neighbor."
    if 2 <= n <= 4:
        return 8
    if n == 1:
        return 2
    if n <= 6:
        return 1
    return -6


def _spread(cl, chosen):
    if not chosen:
        return 0
    return min(abs(cl["r"] - c["r"]) + abs(cl["c"] - c["c"]) for c in chosen)


def reasoning_clues(full_clues, size, n_target, decoys, rng):
    """Pick at most 6 numbers that are small, spread out, and reject every decoy.

    A big region only tells you the blob is large after almost everything is down.
    A 2 or a 3 goes green or red as soon as that spot is wrong, so the player can
    take the next step. This still does not prove the solution is unique.
    """
    lo, hi = CLUE_RANGE[size]
    if size >= 6:
        n_target = hi
    target = max(lo, min(hi, n_target, len(full_clues)))
    decoy_maps = [_placement_sizes(d, size) for d in decoys]
    chosen = []
    remaining = list(range(len(decoy_maps)))

    def taken(cl):
        return any(cl["r"] == c["r"] and cl["c"] == c["c"] for c in chosen)

    while remaining and len(chosen) < hi:
        best = None
        best_key = None
        live = [decoy_maps[i] for i in remaining]
        for cl in full_clues:
            if taken(cl):
                continue
            killed = sum(1 for smap in live if smap.get((cl["r"], cl["c"]), 0) != cl["n"])
            if killed == 0:
                continue
            key = (killed, _local_bonus(cl["n"]) - sum(1 for c in chosen if c["n"] == cl["n"]), _spread(cl, chosen), -cl["n"])
            if best_key is None or key > best_key:
                best_key = key
                best = cl
        if best is None:
            break
        chosen.append(best)
        remaining = [
            i
            for i in remaining
            if decoy_maps[i].get((best["r"], best["c"]), 0) == best["n"]
        ]
    if remaining or not _kills_all(chosen, decoy_maps):
        return None
    while len(chosen) > target:
        biggest = max(range(len(chosen)), key=lambda i: (chosen[i]["n"], -_spread(chosen[i], chosen)))
        trial = chosen[:biggest] + chosen[biggest + 1 :]
        if len(trial) < lo or not _kills_all(trial, decoy_maps):
            break
        chosen = trial
    while len(chosen) < target:
        best = None
        best_key = None
        for cl in full_clues:
            if taken(cl):
                continue
            key = (_local_bonus(cl["n"]), _spread(cl, chosen), -cl["n"], rng.random())
            if best_key is None or key > best_key:
                best_key = key
                best = cl
        if best is None:
            break
        chosen.append(best)
    if len(chosen) < lo or len(chosen) > hi or len(chosen) > MAX_CLUES:
        return None
    if not _kills_all(chosen, decoy_maps):
        return None
    if size >= 6 and not _large_board_readable(chosen, full_clues, decoy_maps, size):
        return None
    return sorted(chosen, key=lambda c: (c["r"], c["c"]))


def _replace_clue(chosen, drop_i, options, decoy_maps):
    for cl in options:
        trial = [c for i, c in enumerate(chosen) if i != drop_i] + [cl]
        if _kills_all(trial, decoy_maps):
            chosen[:] = trial
            return True
    return False


def _large_board_readable(chosen, full_clues, decoy_maps, size):
    """Several 2–4 clues, spread across the board. A 1 only says the cell is alone."""

    def fresh(pred):
        opts = [
            c
            for c in full_clues
            if pred(c) and not any(c["r"] == x["r"] and c["c"] == x["c"] for x in chosen)
        ]
        opts.sort(key=lambda c: (_spread(c, chosen), _local_bonus(c["n"])), reverse=True)
        return opts

    for _ in range(8):
        local = [c for c in chosen if 2 <= c["n"] <= 4]
        if len(local) >= 3:
            break
        big_i = max(range(len(chosen)), key=lambda i: (0 if 2 <= chosen[i]["n"] <= 4 else 1, chosen[i]["n"]))
        if 2 <= chosen[big_i]["n"] <= 4:
            return False
        if not _replace_clue(chosen, big_i, fresh(lambda c: 2 <= c["n"] <= 4), decoy_maps):
            return False
    # A region bigger than 6 only checks out when a large blob is finished.
    for _ in range(6):
        huge = [i for i, c in enumerate(chosen) if c["n"] > 6]
        if not huge:
            break
        drop_i = max(huge, key=lambda i: chosen[i]["n"])
        if not _replace_clue(chosen, drop_i, fresh(lambda c: 2 <= c["n"] <= 4), decoy_maps):
            return False
    while sum(1 for c in chosen if c["n"] == 1) > 2:
        drop_i = next(i for i, c in enumerate(chosen) if c["n"] == 1)
        if not _replace_clue(chosen, drop_i, fresh(lambda c: 2 <= c["n"] <= 4), decoy_maps):
            return False
    if len([c for c in chosen if 2 <= c["n"] <= 4]) < 3:
        return False
    rows = [c["r"] for c in chosen]
    cols = [c["c"] for c in chosen]
    if max(rows) - min(rows) < size // 2 and max(cols) - min(cols) < size // 2:
        return False
    return True


def piece_count_for(size, level_id, extra=False, pack_len=FREE_PER_SIZE):
    lo, hi = PIECE_RANGE[size]
    t = (level_id - 1) / max(1, pack_len - 1)
    if extra:
        t = 0.35 + 0.65 * t
    n = lo + int(round(t * (hi - lo)))
    return max(lo, min(hi, n))


def clue_count_for(size, level_id, pack_len=FREE_PER_SIZE):
    lo, hi = CLUE_RANGE[size]
    t = (level_id - 1) / max(1, pack_len - 1)
    n = lo + int(round(t * (hi - lo)))
    return max(lo, min(hi, n))


def write_pack(path: Path, levels):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(levels, separators=(",", ":")), encoding="utf-8")


def rect_level(rows, cols, placed, lid, name, max_clues=None):
    cover = cover_map(placed)
    clues = clues_from_regions(regions_from_cover(cover, rows, cols))
    if clues is None:
        raise RuntimeError("tutorial cover incomplete")
    if max_clues is not None and len(clues) > max_clues:
        clues = sorted(clues, key=lambda cl: (-cl["n"], cl["r"], cl["c"]))[:max_clues]
        clues = sorted(clues, key=lambda c: (c["r"], c["c"]))
    pieces, solution = placed_to_pieces_and_solution(placed)
    return {
        "id": lid,
        "name": name,
        "rows": rows,
        "cols": cols,
        "clues": clues,
        "pieces": pieces,
        "solution": solution,
        "tutorial": True,
    }


def build_tutorial():
    # Rectangles only: squares and bars, each ≤ 20 cells.
    lv1 = rect_level(
        3,
        4,
        [rect_cells(2, 4, 0, 0), rect_cells(2, 4, 1, 0)],
        1,
        "重疊才對",
        max_clues=3,
    )
    lv2 = rect_level(
        3,
        3,
        [rect_cells(3, 2, 0, 0), rect_cells(3, 2, 0, 1)],
        2,
        "中間那一欄",
        max_clues=3,
    )
    lv3 = rect_level(
        4,
        4,
        [rect_cells(2, 2, 0, 0), rect_cells(2, 2, 0, 2), rect_cells(2, 4, 2, 0)],
        3,
        "卡住那一格",
        max_clues=4,
    )
    for lv in (lv1, lv2, lv3):
        if any(not is_rect(p) for p in lv["pieces"]):
            raise RuntimeError("tutorial piece is not a rectangle")
    return [lv1, lv2, lv3]


def generate_pack(size, count, seed0, extra=False):
    levels = []
    seen = set()
    attempts = 0
    while len(levels) < count and attempts < count * 200:
        attempts += 1
        rng = random.Random(seed0 + attempts * 9973 + size * 131)
        n = piece_count_for(size, len(levels) + 1, extra=extra, pack_len=count)
        n_clues = clue_count_for(size, len(levels) + 1, pack_len=count)
        lvl = generate_one(size, n, n_clues, rng)
        if not lvl:
            continue
        key = (
            tuple(tuple(map(tuple, p)) for p in lvl["pieces"]),
            tuple((c["r"], c["c"], c["n"]) for c in lvl["clues"]),
        )
        if key in seen:
            continue
        seen.add(key)
        lvl["id"] = len(levels) + 1
        levels.append(lvl)
        kind = "extra" if extra else "free"
        print(f"  {kind} {size}x{size}: {len(levels)}/{count} (pieces={n}, clues={len(lvl['clues'])})", flush=True)
    if len(levels) < count:
        raise RuntimeError(f"Only got {len(levels)}/{count} for {size} extra={extra}")
    return levels


# One fixed drawing of each tetromino. Rotations are added below; mirrors stay
# separate (J/L and S/Z are both in the set).
_TETRO_BASES = (
    ("I", ((0, 0), (1, 0), (2, 0), (3, 0))),
    ("O", ((0, 0), (0, 1), (1, 0), (1, 1))),
    ("T", ((0, 0), (0, 1), (0, 2), (1, 1))),
    ("J", ((0, 1), (1, 1), (2, 0), (2, 1))),
    ("L", ((0, 0), (1, 0), (2, 0), (2, 1))),
    ("S", ((0, 1), (0, 2), (1, 0), (1, 1))),
    ("Z", ((0, 0), (0, 1), (1, 1), (1, 2))),
)


def tetro_orientations():
    seen = set()
    out = []
    for name, cells in _TETRO_BASES:
        cur = list(cells)
        for _ in range(4):
            norm = normalize(cur)
            if (name, norm) not in seen:
                seen.add((name, norm))
                out.append((name, norm))
            cur = [(c, -r) for r, c in cur]
    return out


TETRO_SHAPES = tetro_orientations()
TETRO_SHAPE_SET = {cells for _name, cells in TETRO_SHAPES}
_PLACE_CACHE = {}
_CELL_INDEX = {}


def is_tetro(cells):
    return normalize(cells) in TETRO_SHAPE_SET


def tetro_placements(size):
    places = []
    for name, shape in TETRO_SHAPES:
        h = max(r for r, _ in shape) + 1
        w = max(c for _, c in shape) + 1
        for r0 in range(size - h + 1):
            for c0 in range(size - w + 1):
                cells = tuple((r0 + r, c0 + c) for r, c in shape)
                mask = 0
                for r, c in cells:
                    mask |= 1 << (r * size + c)
                places.append((name, cells, mask))
    return places


def placements_for(size):
    if size not in _PLACE_CACHE:
        places = tetro_placements(size)
        buckets = [[] for _ in range(size * size)]
        for i, (_name, _cells, mask) in enumerate(places):
            bit = mask
            while bit:
                b = (bit & -bit).bit_length() - 1
                buckets[b].append(i)
                bit &= bit - 1
        _PLACE_CACHE[size] = places
        _CELL_INDEX[size] = buckets
    return _PLACE_CACHE[size], _CELL_INDEX[size]


def _empty_bits(covered, bits):
    out = []
    rest = ((1 << bits) - 1) ^ covered
    while rest:
        b = (rest & -rest).bit_length() - 1
        out.append(b)
        rest &= rest - 1
    return out


def place_tetros(size, n, rng, trials=800):
    """Cover the board with n tetrominoes. Each keeps one private cell."""
    places, buckets = placements_for(size)
    span = len(places)
    full = (1 << (size * size)) - 1
    area = size * size
    for _trial in range(trials):
        covered = 0
        reserved = 0
        chosen = []
        used = defaultdict(int)
        failed = False
        for i in range(n):
            later = n - i - 1
            empty = area - covered.bit_count()
            holes = _empty_bits(covered, area) if empty <= 12 else None
            if holes is not None and not holes and later:
                failed = True
                break
            if holes:
                pool_i = []
                seen_i = set()
                rng.shuffle(holes)
                for b in holes[:6]:
                    for idx in buckets[b]:
                        if idx not in seen_i:
                            seen_i.add(idx)
                            pool_i.append(idx)
                rng.shuffle(pool_i)
                pool_i = pool_i[:220]
            else:
                pool_i = [rng.randrange(span) for _ in range(160)]
            best = None
            best_key = None
            for idx in pool_i:
                name, cells, mask = places[idx]
                if mask & reserved:
                    continue
                fresh = mask & (full ^ covered)
                if not fresh:
                    continue
                gain = fresh.bit_count()
                empty_after = empty - gain
                if empty_after > 4 * later or empty_after < later:
                    continue
                key = gain * 5 - used[name] * 4 + rng.random()
                if best_key is None or key > best_key:
                    best_key = key
                    best = (name, cells, mask, fresh)
            if best is None:
                failed = True
                break
            name, cells, mask, fresh = best
            reserved |= fresh & -fresh
            covered |= mask
            chosen.append(cells)
            used[name] += 1
        if failed or covered != full:
            continue
        placed = [set(cells) for cells in chosen]
        if quality_ok(placed, size) and all(is_tetro(p) for p in placed):
            return placed
    return None


def sample_tetro_decoys(size, placed, rng, want=8):
    placed = [tuple(sorted(p)) for p in placed]
    shapes = [normalize(p) for p in placed]
    boxes = []
    for shape in shapes:
        boxes.append((max(r for r, _ in shape) + 1, max(c for _, c in shape) + 1))

    def moved(i, r, c):
        return tuple(sorted((r + dr, c + dc) for dr, dc in shapes[i]))

    origin = tuple(placed)
    seen = {origin}
    found = []
    n = len(placed)
    for k, tries in ((1, 40), (2, 50)):
        if k > n or len(found) >= want:
            break
        for _ in range(tries):
            new = list(placed)
            changed = False
            for i in rng.sample(range(n), k):
                h, w = boxes[i]
                cells = moved(i, rng.randint(0, size - h), rng.randint(0, size - w))
                if cells != placed[i]:
                    changed = True
                new[i] = cells
            key = tuple(new)
            if not changed or key in seen:
                continue
            seen.add(key)
            if quality_ok(new, size):
                found.append([set(p) for p in new])
                if len(found) >= want:
                    break
    return found


def nudge_tetro(size, placed, rng):
    """Slide one or two pieces. Shape and rotation stay; only the origin moves."""
    found = sample_tetro_decoys(size, placed, rng, want=1)
    return found[0] if found else None


def generate_tetro_one(size, n_pieces, n_clues, rng):
    for _ in range(50):
        placed = place_tetros(size, n_pieces, rng)
        if not placed:
            continue
        cover = cover_map(placed)
        regs = regions_from_cover(cover, size, size)
        full = clues_from_regions(regs)
        if full is None or not enough_local_regions(regs, size):
            continue
        decoys = decoys_split_locally(full, sample_tetro_decoys(size, placed, rng, want=8), size)
        if not decoys:
            continue
        clues = reasoning_clues(full, size, n_clues, decoys, rng)
        if not clues or len(clues) > MAX_CLUES:
            continue
        pieces, solution = placed_to_pieces_and_solution(placed)
        if any(not is_tetro(p) for p in pieces):
            continue
        return {
            "rows": size,
            "cols": size,
            "clues": clues,
            "pieces": pieces,
            "solution": solution,
        }
    return None


def tetro_count_for(size, level_id, pack_len=FREE_PER_SIZE):
    lo, hi = TETRO_RANGE[size]
    t = (level_id - 1) / max(1, pack_len - 1)
    n = lo + int(round(t * (hi - lo)))
    return max(lo, min(hi, n))


def generate_tetro_pack(size, count, seed0):
    levels = []
    seen = set()
    attempts = 0
    limit = count * 80
    while len(levels) < count and attempts < limit:
        attempts += 1
        rng = random.Random(seed0 + attempts * 9973 + size * 131)
        n = tetro_count_for(size, len(levels) + 1, pack_len=count)
        n_clues = clue_count_for(size, len(levels) + 1, pack_len=count)
        lvl = generate_tetro_one(size, n, n_clues, rng)
        if not lvl:
            continue
        key = (
            tuple(tuple(map(tuple, p)) for p in lvl["pieces"]),
            tuple((c["r"], c["c"], c["n"]) for c in lvl["clues"]),
        )
        if key in seen:
            continue
        seen.add(key)
        lvl["id"] = len(levels) + 1
        levels.append(lvl)
        print(
            f"  tetro {size}x{size}: {len(levels)}/{count} (pieces={n}, clues={len(lvl['clues'])})",
            flush=True,
        )
    if len(levels) < count:
        raise RuntimeError(f"Only got {len(levels)}/{count} tetro levels for {size}")
    return levels


def test_tetro():
    for size in SIZES:
        t0 = time.perf_counter()
        rng = random.Random(size * 4000091)
        n = TETRO_RANGE[size][0]
        lvl = generate_tetro_one(size, n, CLUE_RANGE[size][0], rng)
        dt = time.perf_counter() - t0
        if not lvl:
            print(f"FAIL {size} in {dt:.1f}s", flush=True)
            continue
        print(
            f"ok {size} pieces={len(lvl['pieces'])} clues={len(lvl['clues'])} {dt:.1f}s",
            flush=True,
        )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tut = build_tutorial()
    write_pack(OUT / "tutorial.json", tut)
    print(f"tutorial: {len(tut)} levels")

    for size in SIZES:
        print(f"=== {size}x{size} free ===")
        free = generate_pack(size, FREE_PER_SIZE, seed0=size * 1_000_003)
        write_pack(OUT / f"{size}.json", free)
        print(f"=== {size}x{size} extra ===")
        extra = generate_pack(size, EXTRA_PER_SIZE, seed0=size * 2_000_029, extra=True)
        write_pack(OUT / "extra" / f"{size}.json", extra)
        print(f"=== {size}x{size} daily fallback ===")
        fb = generate_pack(size, FALLBACK_PER_SIZE, seed0=size * 3_000_047)
        write_pack(OUT / "daily_fallback" / f"{size}.json", fb)
        print(f"=== {size}x{size} tetro ===")
        tetro = generate_tetro_pack(size, FREE_PER_SIZE, seed0=size * 4_000_091)
        write_pack(OUT / "tetro" / f"{size}.json", tetro)

    print("done")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "tetro-test":
        test_tetro()
    else:
        main()
