"""Generate and verify overlap-number puzzle levels."""
from __future__ import annotations

from collections import defaultdict, deque
from itertools import product
import json
from pathlib import Path


def normalize(cells):
    cells = list(cells)
    mr = min(r for r, c in cells)
    mc = min(c for r, c in cells)
    return tuple(sorted((r - mr, c - mc) for r, c in cells))


def rotate90(cells):
    return normalize((c, -r) for r, c in cells)


def flip_h(cells):
    return normalize((r, -c) for r, c in cells)


def orientations(cells, flips=True):
    seen = set()
    out = []
    seeds = [normalize(cells)]
    if flips:
        seeds.append(flip_h(cells))
    for seed in seeds:
        cur = seed
        for _ in range(4):
            if cur not in seen:
                seen.add(cur)
                out.append(cur)
            cur = rotate90(cur)
    return out


def bbox(cells):
    return max(r for r, c in cells) + 1, max(c for r, c in cells) + 1


def placements(orient, rows, cols):
    h, w = bbox(orient)
    out = []
    for r in range(rows - h + 1):
        for c in range(cols - w + 1):
            out.append(tuple((r + dr, c + dc) for dr, dc in orient))
    return out


def connected(cells):
    cells = set(cells)
    if not cells:
        return False
    start = next(iter(cells))
    seen = {start}
    q = deque([start])
    while q:
        r, c = q.popleft()
        for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
            if (nr, nc) in cells and (nr, nc) not in seen:
                seen.add((nr, nc))
                q.append((nr, nc))
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

    def neigh(r, c):
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols:
                yield nr, nc

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
                for nx, ny in neigh(x, y):
                    if (nx, ny) not in visited and cover.get((nx, ny), frozenset()) == sig:
                        visited.add((nx, ny))
                        q.append((nx, ny))
            regs.append({"sig": sig, "cells": cells})
    return regs


def clues_from_regions(regs):
    clues = []
    for reg in regs:
        if not reg["sig"]:
            return None
        cell = sorted(reg["cells"], key=lambda x: (-x[0], x[1]))[0]
        clues.append((cell[0], cell[1], len(reg["cells"])))
    return clues


def region_sizes_at(cover, rows, cols):
    sizes = {}
    for reg in regions_from_cover(cover, rows, cols):
        sz = len(reg["cells"])
        for cell in reg["cells"]:
            sizes[cell] = sz if reg["sig"] else 0
    return sizes


def satisfies(placed, rows, cols, clues):
    cover = cover_map(placed)
    if any((r, c) not in cover for r in range(rows) for c in range(cols)):
        return False
    sizes = region_sizes_at(cover, rows, cols)
    return all(sizes.get((r, c), 0) == n for r, c, n in clues)


def all_place_lists(shapes, rows, cols, flips=True):
    lists = []
    for shape in shapes:
        pls = []
        for ori in orientations(shape, flips):
            pls.extend(placements(ori, rows, cols))
        # unique placements
        lists.append(list(dict.fromkeys(pls)))
    return lists


def count_solutions(shapes, rows, cols, clues, flips=True, limit=6):
    place_lists = all_place_lists(shapes, rows, cols, flips)
    found = 0
    for combo in product(*place_lists):
        if satisfies(combo, rows, cols, clues):
            found += 1
            if found >= limit:
                return found
    return found


def describe_shape(cells):
    cells = normalize(cells)
    h, w = bbox(cells)
    if len(cells) == h * w:
        return f"{h}x{w}矩形"
    return f"{len(cells)}格異形"


def seed_to_level(placed, rows, cols, flips=True):
    for p in placed:
        if not connected(p):
            return None
        if any(r < 0 or c < 0 or r >= rows or c >= cols for r, c in p):
            return None
    cover = cover_map(placed)
    if any((r, c) not in cover for r in range(rows) for c in range(cols)):
        return None
    regs = regions_from_cover(cover, rows, cols)
    clues = clues_from_regions(regs)
    if clues is None:
        return None
    # each piece should have at least one exclusive cell; overlap required
    ids = range(len(placed))
    exclusives = {i: 0 for i in ids}
    overlaps = 0
    for sig, group in ((reg["sig"], reg) for reg in regs):
        if len(sig) >= 2:
            overlaps += len(group["cells"])
        elif len(sig) == 1:
            exclusives[next(iter(sig))] += len(group["cells"])
    if overlaps == 0 or any(v == 0 for v in exclusives.values()):
        return None
    shapes = [normalize(p) for p in placed]
    nsol = count_solutions(shapes, rows, cols, clues, flips=flips, limit=8)
    return {
        "rows": rows,
        "cols": cols,
        "pieces": [list(map(list, s)) for s in shapes],
        "clues": [{"r": r, "c": c, "n": n} for r, c, n in clues],
        "solutions": nsol,
        "overlap": overlaps,
        "labels": [describe_shape(s) for s in shapes],
        "placed": [list(map(list, normalize(p))) for p in placed],
        "placedAbs": [list(map(list, p)) for p in placed],
    }


def rect(h, w):
    return tuple((r, c) for r in range(h) for c in range(w))


SHAPES = {
    "2x2": rect(2, 2),
    "2x3": rect(2, 3),
    "3x3": rect(3, 3),
    "2x4": rect(2, 4),
    "3x4": rect(3, 4),
    "I3": ((0, 0), (1, 0), (2, 0)),
    "L3": ((0, 0), (1, 0), (1, 1)),
    "I4": ((0, 0), (1, 0), (2, 0), (3, 0)),
    "O": ((0, 0), (0, 1), (1, 0), (1, 1)),
    "T": ((0, 0), (0, 1), (0, 2), (1, 1)),
    "L4": ((0, 0), (1, 0), (2, 0), (2, 1)),
    "J4": ((0, 1), (1, 1), (2, 1), (2, 0)),
    "S": ((1, 0), (1, 1), (0, 1), (0, 2)),
    "Z": ((0, 0), (0, 1), (1, 1), (1, 2)),
    "P5": ((0, 0), (0, 1), (1, 0), (1, 1), (2, 0)),
    "U5": ((0, 0), (0, 2), (1, 0), (1, 1), (1, 2)),
    "V5": ((0, 0), (1, 0), (2, 0), (2, 1), (2, 2)),
    "T5": ((0, 0), (0, 1), (0, 2), (1, 1), (2, 1)),
    "L5": ((0, 0), (1, 0), (2, 0), (3, 0), (3, 1)),
    "Y5": ((0, 1), (1, 0), (1, 1), (1, 2), (1, 3)),
    "N5": ((0, 1), (1, 0), (1, 1), (2, 0), (3, 0)),
    "2x5": rect(2, 5),
}


# Hand-designed intended placements (absolute cells).
SEEDS = [
    # 1. Original example 3x4: 2x3 + 3x3
    (3, 4, [
        [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)],
        [(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (1, 3), (2, 3)],
    ]),
    # 2. 3x3 two 2x3
    (3, 3, [
        [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)],
        [(0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2)],
    ]),
    # 3. 3x3 rect + L tetromino
    (3, 3, [
        [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)],
        [(0, 2), (1, 2), (2, 2), (2, 1)],
    ]),
    # 4. 3x4 T + 3x3
    (3, 4, [
        [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2)],
        [(1, 2), (0, 3), (1, 3), (2, 3)],
    ]),
    # 5. 4x4 two rectangles
    (4, 4, [
        [(0, 0), (0, 1), (0, 2), (0, 3), (1, 0), (1, 1), (1, 2), (1, 3), (2, 0), (2, 1), (2, 2), (2, 3)],
        [(2, 0), (2, 1), (2, 2), (2, 3), (3, 0), (3, 1), (3, 2), (3, 3)],
    ]),
    # 6. 4x4 L4 + 3x4
    (4, 4, [
        [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (1, 3), (2, 3)],
        [(2, 3), (3, 1), (3, 2), (3, 3)],
    ]),
    # 7. 3x4 S + 2x3 + I3? three pieces later
    (3, 4, [
        [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)],
        [(0, 2), (1, 2), (0, 3), (1, 3)],
        [(1, 1), (2, 1), (2, 2), (2, 3)],
    ]),
    # 8. 3x3 three 2x2-ish
    (3, 3, [
        [(0, 0), (0, 1), (1, 0), (1, 1)],
        [(0, 1), (0, 2), (1, 1), (1, 2)],
        [(1, 0), (2, 0), (2, 1), (2, 2)],
    ]),
    # 9. 4x5 P + 3x3 + L4
    (4, 4, [
        [(0, 0), (1, 0), (2, 0), (3, 0), (0, 1), (1, 1), (2, 1), (3, 1)],
        [(0, 1), (0, 2), (0, 3), (1, 1), (1, 2), (1, 3)],
        [(1, 2), (2, 2), (3, 2), (3, 1), (3, 3), (2, 3), (1, 3)],
    ]),
    # 10. 4x5 bigger
    (4, 5, [
        [(0, 0), (1, 0), (2, 0), (3, 0), (0, 1), (1, 1), (2, 1)],
        [(0, 1), (0, 2), (0, 3), (0, 4), (1, 2), (1, 3), (1, 4)],
        [(1, 0), (1, 1), (2, 1), (2, 2), (2, 3), (2, 4), (3, 1), (3, 2), (3, 3), (3, 4)],
    ]),
]


def search_two_piece(rows, cols, shape_names, flips=True, limit=30):
    found = []
    seen_key = set()
    names = list(shape_names)
    for i, na in enumerate(names):
        for nb in names[i:]:
            sa, sb = SHAPES[na], SHAPES[nb]
            pa_list = []
            for ori in orientations(sa, flips):
                pa_list.extend(placements(ori, rows, cols))
            pb_list = []
            for ori in orientations(sb, flips):
                pb_list.extend(placements(ori, rows, cols))
            pa_list = list(dict.fromkeys(pa_list))
            pb_list = list(dict.fromkeys(pb_list))
            for pa in pa_list:
                for pb in pb_list:
                    lvl = seed_to_level([pa, pb], rows, cols, flips=flips)
                    if not lvl:
                        continue
                    if lvl["solutions"] != 1:
                        continue
                    key = (tuple(map(tuple, lvl["pieces"][0])), tuple(map(tuple, lvl["pieces"][1])),
                           tuple((c["r"], c["c"], c["n"]) for c in lvl["clues"]))
                    key2 = (key[1], key[0], key[2])
                    if key in seen_key or key2 in seen_key:
                        continue
                    seen_key.add(key)
                    lvl["names"] = [na, nb]
                    found.append(lvl)
                    if len(found) >= limit:
                        return found
    return found


def main():
    print("=== SEED CHECK ===")
    levels = []
    for idx, (rows, cols, placed) in enumerate(SEEDS, 1):
        placed_t = [tuple(map(tuple, p)) for p in placed]
        lvl = seed_to_level(placed_t, rows, cols, flips=True)
        print(f"Seed {idx}: {rows}x{cols} pieces={len(placed)} ->", end=" ")
        if not lvl:
            print("INVALID")
            continue
        print(f"sols={lvl['solutions']} overlap={lvl['overlap']} shapes={lvl['labels']} clues={lvl['clues']}")
        levels.append(lvl)

    print("\n=== SEARCH 3x3 two-piece unique ===")
    s33 = search_two_piece(3, 3, ["2x2", "2x3", "L3", "L4", "T", "S", "P5"], limit=20)
    print(f"found {len(s33)}")
    for lvl in s33[:8]:
        print(" ", lvl["names"], lvl["clues"], "ov", lvl["overlap"])

    print("\n=== SEARCH 3x4 two-piece unique ===")
    s34 = search_two_piece(3, 4, ["2x2", "2x3", "3x3", "L4", "T", "S", "Z", "P5", "U5"], limit=25)
    print(f"found {len(s34)}")
    for lvl in s34[:10]:
        print(" ", lvl["names"], lvl["clues"], "ov", lvl["overlap"], lvl["labels"])

    print("\n=== SEARCH 4x4 two-piece unique ===")
    s44 = search_two_piece(4, 4, ["2x3", "3x3", "2x4", "3x4", "L4", "T", "P5", "U5", "V5", "L5"], limit=20)
    print(f"found {len(s44)}")
    for lvl in s44[:10]:
        print(" ", lvl["names"], lvl["clues"], "ov", lvl["overlap"], lvl["labels"])

    Path("tools/_search_out.json").write_text(
        json.dumps({"seeds": levels, "s33": s33, "s34": s34, "s44": s44}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("\nWrote tools/_search_out.json")


if __name__ == "__main__":
    main()
