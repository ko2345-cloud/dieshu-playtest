"""Overlap-number level generator. Fixed orientation (no rotate). Sparse clues."""
from __future__ import annotations

import json
import random
from collections import defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "levels"

SIZES = [4, 5, 6, 7, 8, 9, 10]
# Rectangles only (squares included). Each piece has at most MAX_PIECE_CELLS.
MAX_PIECE_CELLS = 20
PIECE_RANGE = {
    4: (2, 5),
    5: (3, 6),
    6: (3, 7),
    7: (4, 8),
    8: (5, 9),
    9: (5, 9),
    10: (6, 10),
}
CLUE_RANGE = {
    4: (2, 5),
    5: (2, 6),
    6: (3, 7),
    7: (3, 8),
    8: (4, 9),
    9: (4, 9),
    10: (5, 10),
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
    origin = [tuple(p) for p in pos]
    n = len(dims)

    def placed_at(new_pos):
        return [rect_cells(h, w, r, c) for (h, w), (r, c) in zip(dims, new_pos)]

    for k in (1, 2):
        if k > n:
            continue
        tries = 30 if k == 1 else 50
        for _ in range(tries):
            new_pos = list(origin)
            for i in rng.sample(range(n), k):
                h, w = dims[i]
                new_pos[i] = (rng.randint(0, size - h), rng.randint(0, size - w))
            if list(map(tuple, new_pos)) == origin:
                continue
            placed = placed_at(new_pos)
            if quality_ok(placed, size):
                return placed
    return None


def _level_from_pair(size, n_clues, rng, dims, placed_a, pos_a):
    placed_b = nudge_decoy(size, dims, pos_a, rng)
    if not placed_b or signature(placed_a) == signature(placed_b):
        return None
    cover = cover_map(placed_a)
    full = clues_from_regions(regions_from_cover(cover, size, size))
    if full is None or satisfies(placed_b, size, size, full):
        return None
    clues = thin_clues(full, size, n_clues, placed_a, placed_b, rng)
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


def thin_clues(full_clues, size, n_target, placed_a, placed_b, rng):
    """Keep as few numbers as possible while still rejecting the decoy."""
    lo, hi = CLUE_RANGE[size]
    target = max(lo, min(hi, n_target, len(full_clues)))
    # Prefer larger regions (more informative).
    ranked = sorted(full_clues, key=lambda cl: (-cl["n"], cl["r"], cl["c"]))
    # Grow until decoy fails, then trim extras down toward target if still unique.
    chosen = []
    for cl in ranked:
        chosen.append(cl)
        if not satisfies(placed_b, size, size, chosen) and len(chosen) >= lo:
            break
    if satisfies(placed_b, size, size, chosen):
        return None
    while len(chosen) > target:
        # Drop the least informative remaining clue if uniqueness holds.
        drop_idx = None
        for i in range(len(chosen) - 1, -1, -1):
            trial = chosen[:i] + chosen[i + 1 :]
            if len(trial) < lo:
                break
            if not satisfies(placed_b, size, size, trial):
                drop_idx = i
                break
        if drop_idx is None:
            break
        chosen.pop(drop_idx)
    # Optional: if still under target and we have more clues, add a couple for fairness.
    if len(chosen) < target:
        have = {(c["r"], c["c"]) for c in chosen}
        for cl in ranked:
            if (cl["r"], cl["c"]) in have:
                continue
            chosen.append(cl)
            have.add((cl["r"], cl["c"]))
            if len(chosen) >= target:
                break
    if satisfies(placed_b, size, size, chosen):
        return None
    rng.shuffle(chosen)
    return sorted(chosen, key=lambda c: (c["r"], c["c"]))


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

    print("done")


if __name__ == "__main__":
    main()
