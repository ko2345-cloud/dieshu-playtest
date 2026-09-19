(() => {
  const COLOR_DEFS = [
    { key: "Y", fill: "#f4c430", name: "黃" },
    { key: "B", fill: "#4aa3f0", name: "藍" },
    { key: "R", fill: "#e45b73", name: "紅" },
  ];
  const MIX = {
    Y: "#f4c430",
    B: "#4aa3f0",
    R: "#e45b73",
    YB: "#5ecf6a",
    YR: "#f08a32",
    BR: "#9b62d4",
    YBR: "#7a6558",
  };

  const STORAGE = "dieshu-progress-v1";
  const helpEl = document.getElementById("modal-help");
  const winEl = document.getElementById("modal-win");
  const levelsEl = document.getElementById("modal-levels");
  const hintEl = document.getElementById("modal-hint");
  const boardEl = document.getElementById("board");
  const trayEl = document.getElementById("tray");
  const ghostEl = document.getElementById("ghost");
  const statusEl = document.getElementById("status");

  let levelIndex = 0;
  let pieces = [];
  let selected = 0;
  let drag = null;
  let won = false;
  let progress = loadProgress();

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE) || "{}");
    } catch {
      return {};
    }
  }
  function saveProgress() {
    localStorage.setItem(STORAGE, JSON.stringify(progress));
  }

  function mixFill(ids) {
    const present = [false, false, false];
    for (const i of ids) present[pieces[i].colorIndex] = true;
    const keys = COLOR_DEFS.filter((_, i) => present[i]).map((d) => d.key).join("");
    return MIX[keys] || "#888";
  }

  function bbox(cells) {
    return {
      h: Math.max(...cells.map((c) => c[0])) + 1,
      w: Math.max(...cells.map((c) => c[1])) + 1,
    };
  }

  function normalize(cells) {
    const mr = Math.min(...cells.map((c) => c[0]));
    const mc = Math.min(...cells.map((c) => c[1]));
    return cells.map(([r, c]) => [r - mr, c - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }

  function rotateCells(cells) {
    return normalize(cells.map(([r, c]) => [c, -r]));
  }

  function flipCells(cells) {
    return normalize(cells.map(([r, c]) => [r, -c]));
  }

  function currentLevel() {
    return window.LEVELS[levelIndex];
  }

  function loadLevel(index, { keepHelp } = {}) {
    levelIndex = index;
    const lv = currentLevel();
    won = false;
    press = null;
    drag = null;
    pieces = lv.pieces.map((cells, i) => ({
      id: i,
      cells: cells.map(([r, c]) => [r, c]),
      colorIndex: i,
      row: null,
      col: null,
    }));
    selected = 0;
    drag = null;
    document.getElementById("progress").textContent = `第 ${lv.id}／${window.LEVELS.length} 關`;
    document.getElementById("level-name").textContent = lv.name;
    document.getElementById("level-tip").textContent = lv.tip;
    winEl.classList.add("hidden");
    levelsEl.classList.add("hidden");
    hintEl.classList.add("hidden");
    if (!keepHelp) helpEl.classList.add("hidden");
    fitBoard();
    render();
    setStatus("點積木，再點棋盤空格放下。也可以拖曳，積木可以重疊。");
  }

  function fitBoard() {
    const lv = currentLevel();
    const wrap = document.getElementById("board-wrap").clientWidth;
    const maxH = Math.max(180, window.innerHeight * 0.42);
    const gap = lv.cols >= 5 ? 5 : 6;
    const pad = 20;
    const cellW = (wrap - pad - gap * (lv.cols - 1)) / lv.cols;
    const cellH = (maxH - pad - gap * (lv.rows - 1)) / lv.rows;
    const cell = Math.max(34, Math.min(68, Math.floor(Math.min(cellW, cellH))));
    document.documentElement.style.setProperty("--cell", `${cell}px`);
    document.documentElement.style.setProperty("--gap", `${gap}px`);
  }

  function pieceAbs(p, row = p.row, col = p.col) {
    if (row == null || col == null) return [];
    return p.cells.map(([r, c]) => [row + r, col + c]);
  }

  function fits(p, row, col) {
    const lv = currentLevel();
    return p.cells.every(([r, c]) => {
      const rr = row + r;
      const cc = col + c;
      return rr >= 0 && cc >= 0 && rr < lv.rows && cc < lv.cols;
    });
  }

  function coverage(preview) {
    const lv = currentLevel();
    const cover = Array.from({ length: lv.rows }, () =>
      Array.from({ length: lv.cols }, () => [])
    );
    for (const p of pieces) {
      let row = p.row;
      let col = p.col;
      if (preview && preview.id === p.id) {
        row = preview.row;
        col = preview.col;
      }
      if (row == null) continue;
      for (const [r, c] of pieceAbs(p, row, col)) {
        if (r >= 0 && c >= 0 && r < lv.rows && c < lv.cols) cover[r][c].push(p.id);
      }
    }
    return cover;
  }

  function regionSize(cover, sr, sc) {
    const lv = currentLevel();
    const key = cover[sr][sc].slice().sort().join(",");
    const seen = Array.from({ length: lv.rows }, () => Array(lv.cols).fill(false));
    const q = [[sr, sc]];
    seen[sr][sc] = true;
    let n = 0;
    while (q.length) {
      const [r, c] = q.pop();
      n += 1;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= lv.rows || nc >= lv.cols || seen[nr][nc]) continue;
        if (cover[nr][nc].slice().sort().join(",") !== key) continue;
        seen[nr][nc] = true;
        q.push([nr, nc]);
      }
    }
    return n;
  }

  function evaluate(preview) {
    const lv = currentLevel();
    const cover = coverage(preview);
    const filled = cover.every((row) => row.every((ids) => ids.length > 0));
    const allPlaced = pieces.every((p) => {
      if (preview && preview.id === p.id) return preview.row != null;
      return p.row != null;
    });
    const clueState = lv.clues.map((clue) => {
      const ids = cover[clue.r][clue.c];
      if (!ids.length) return { ...clue, state: "empty", size: 0 };
      const size = regionSize(cover, clue.r, clue.c);
      return { ...clue, state: size === clue.n ? "ok" : "bad", size };
    });
    const cluesOk = clueState.every((c) => c.state === "ok");
    return { cover, filled, allPlaced, clueState, win: filled && allPlaced && cluesOk };
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  function renderPieceShape(cells, color, cellClass) {
    const { h, w } = bbox(cells);
    const grid = document.createElement("div");
    grid.className = "piece-grid";
    grid.style.gridTemplateColumns = `repeat(${w}, auto)`;
    const set = new Set(cells.map(([r, c]) => `${r},${c}`));
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const d = document.createElement("div");
        if (set.has(`${r},${c}`)) {
          d.className = cellClass || "pcell";
          d.style.setProperty("--pc", color);
        } else {
          d.style.visibility = "hidden";
        }
        grid.appendChild(d);
      }
    }
    return grid;
  }

  function render() {
    const lv = currentLevel();
    const preview = drag && drag.hover && drag.hover.valid ? drag.hover : null;
    const ev = evaluate(preview);

    boardEl.style.gridTemplateColumns = `repeat(${lv.cols}, var(--cell))`;
    boardEl.innerHTML = "";
    for (let r = 0; r < lv.rows; r++) {
      for (let c = 0; c < lv.cols; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.setAttribute("role", "gridcell");
        const clue = ev.clueState.find((x) => x.r === r && x.c === c);
        cell.setAttribute(
          "aria-label",
          clue ? `格子 ${r + 1}行 ${c + 1}列 數字${clue.n}` : `格子 ${r + 1}行 ${c + 1}列`
        );
        const ids = ev.cover[r][c];
        if (ids.length) {
          cell.classList.add("filled");
          cell.style.background = mixFill(ids);
        }
        if (clue) {
          const span = document.createElement("span");
          span.className = "clue";
          span.textContent = clue.n;
          if (clue.state === "ok") span.classList.add("ok");
          if (clue.state === "bad") span.classList.add("bad");
          cell.appendChild(span);
        }
        if (drag && drag.hover && !drag.hover.valid && drag.hover.cells.some(([rr, cc]) => rr === r && cc === c)) {
          cell.classList.add("preview-off");
        }
        const sel = pieces[selected];
        if (!drag && sel && sel.row != null && pieceAbs(sel).some(([rr, cc]) => rr === r && cc === c)) {
          cell.classList.add("picked");
        }
        boardEl.appendChild(cell);
      }
    }

    trayEl.innerHTML = "";
    for (const p of pieces) {
      if (p.row != null && !(drag && drag.id === p.id)) continue;
      const el = document.createElement("button");
      el.type = "button";
      el.className = "piece" + (selected === p.id ? " selected" : "");
      el.dataset.pid = p.id;
      const color = COLOR_DEFS[p.colorIndex].fill;
      el.appendChild(renderPieceShape(p.cells, color));
      const label = document.createElement("span");
      label.className = "piece-label";
      label.textContent = `${COLOR_DEFS[p.colorIndex].name}　${p.cells.length} 格`;
      el.appendChild(label);
      el.addEventListener("pointerdown", onPieceDown);
      el.addEventListener("click", (ev) => {
        selected = Number(ev.currentTarget.dataset.pid);
        render();
      });
      trayEl.appendChild(el);
    }

    if (ev.win && !won && !drag) {
      onWin();
    } else if (!won && !drag) {
      if (ev.allPlaced && ev.filled && !ev.clueState.every((c) => c.state === "ok")) {
        setStatus("棋盤滿了，但數字還沒對上。試試改重疊的位置。", "bad");
      } else if (ev.allPlaced && !ev.filled) {
        setStatus("還有空格。積木可以重疊，但不能伸出棋盤外。", "bad");
      }
    }
  }

  function onWin() {
    won = true;
    progress[currentLevel().id] = true;
    saveProgress();
    const last = levelIndex >= window.LEVELS.length - 1;
    document.getElementById("win-title").textContent = last ? "10 關都解開了" : "解開了";
    document.getElementById("win-text").textContent = last
      ? "謝謝試玩。請跟邀請你的人說：規則好不好懂、哪一關最有趣或最卡、值不值得做成完整遊戲。"
      : `「${currentLevel().name}」完成了。`;
    document.getElementById("btn-next").textContent = last ? "從頭再玩" : "下一關";
    winEl.classList.remove("hidden");
    setStatus("解開了！", "win");
  }

  function boardCellFromPoint(x, y) {
    const lv = currentLevel();
    const rect = boardEl.getBoundingClientRect();
    const styles = getComputedStyle(document.documentElement);
    const cell = parseFloat(styles.getPropertyValue("--cell"));
    const gap = parseFloat(styles.getPropertyValue("--gap"));
    const pad = 10;
    const c = Math.floor((x - rect.left - pad) / (cell + gap));
    const r = Math.floor((y - rect.top - pad) / (cell + gap));
    if (r < 0 || c < 0 || r >= lv.rows || c >= lv.cols) return null;
    return { r, c };
  }

  function showGhost(p, clientX, clientY) {
    ghostEl.innerHTML = "";
    ghostEl.appendChild(renderPieceShape(p.cells, COLOR_DEFS[p.colorIndex].fill, "pcell"));
    ghostEl.classList.remove("hidden");
    moveGhost(p, clientX, clientY);
  }

  function moveGhost(p, clientX, clientY) {
    const styles = getComputedStyle(document.documentElement);
    const cell = parseFloat(styles.getPropertyValue("--cell"));
    const gap = parseFloat(styles.getPropertyValue("--gap"));
    const { w, h } = bbox(p.cells);
    const grab = drag.grab;
    const originX = clientX - grab.c * (cell + gap) - cell / 2;
    const originY = clientY - grab.r * (cell + gap) - cell / 2;
    ghostEl.style.width = `${w * cell + (w - 1) * gap}px`;
    ghostEl.style.height = `${h * cell + (h - 1) * gap}px`;
    ghostEl.style.transform = `translate(${originX}px, ${originY}px)`;
  }

  let press = null;

  function tryPlace(p, row, col) {
    if (!fits(p, row, col)) {
      setStatus("放不下，換一個格子或先旋轉。", "bad");
      return false;
    }
    p.row = row;
    p.col = col;
    render();
    return true;
  }

  function beginDrag(p, grab, ev, target) {
    selected = p.id;
    const hover =
      p.row != null
        ? { id: p.id, row: p.row, col: p.col, valid: true, cells: pieceAbs(p) }
        : null;
    p.row = null;
    p.col = null;
    drag = { id: p.id, grab, hover };
    try {
      (target || ev.currentTarget).setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    showGhost(p, ev.clientX, ev.clientY);
    render();
  }

  function onPieceDown(ev) {
    if (won) return;
    const id = Number(ev.currentTarget.dataset.pid);
    selected = id;
    press = {
      id,
      x: ev.clientX,
      y: ev.clientY,
      grab: cellFromPiecePointer(pieces[id], ev),
      target: ev.currentTarget,
      pointerId: ev.pointerId,
    };
    render();
    ev.preventDefault();
  }

  function onBoardDown(ev) {
    if (won || drag) return;
    const cell = ev.target.closest(".cell");
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const p = pieces[selected];
    if (p && p.row == null) {
      tryPlace(p, r, c);
      ev.preventDefault();
      return;
    }
    const ids = coverage()[r][c];
    if (ids.length) {
      const id = ids.includes(selected) ? selected : ids[ids.length - 1];
      const on = pieces[id];
      selected = id;
      press = {
        id,
        x: ev.clientX,
        y: ev.clientY,
        grab: { r: r - on.row, c: c - on.col },
        target: boardEl,
        pointerId: ev.pointerId,
      };
      render();
      ev.preventDefault();
      return;
    }
    if (p) tryPlace(p, r, c);
    ev.preventDefault();
  }

  function cellFromPiecePointer(p, ev) {
    const target = ev.currentTarget.querySelector(".piece-grid");
    if (!target) return { r: 0, c: 0 };
    const { w, h } = bbox(p.cells);
    const rect = target.getBoundingClientRect();
    if (
      ev.clientX < rect.left ||
      ev.clientY < rect.top ||
      ev.clientX > rect.right ||
      ev.clientY > rect.bottom
    ) {
      return { r: 0, c: 0 };
    }
    const sizeX = rect.width / w;
    const sizeY = rect.height / h;
    const c = Math.max(0, Math.min(w - 1, Math.floor((ev.clientX - rect.left) / sizeX)));
    const r = Math.max(0, Math.min(h - 1, Math.floor((ev.clientY - rect.top) / sizeY)));
    const hit = p.cells.find(([rr, cc]) => rr === r && cc === c);
    return hit ? { r, c } : { r: p.cells[0][0], c: p.cells[0][1] };
  }

  function onPointerMove(ev) {
    if (press && !drag) {
      const dist = Math.hypot(ev.clientX - press.x, ev.clientY - press.y);
      if (dist > 10) {
        beginDrag(pieces[press.id], press.grab, ev, press.target);
        press = null;
      }
    }
    if (!drag) return;
    const p = pieces[drag.id];
    moveGhost(p, ev.clientX, ev.clientY);
    const at = boardCellFromPoint(ev.clientX, ev.clientY);
    if (!at) {
      drag.hover = null;
      render();
      return;
    }
    const row = at.r - drag.grab.r;
    const col = at.c - drag.grab.c;
    const cells = pieceAbs(p, row, col);
    drag.hover = { id: p.id, row, col, valid: fits(p, row, col), cells };
    render();
  }

  function onPointerUp(ev) {
    press = null;
    if (!drag) return;
    const p = pieces[drag.id];
    if (drag.hover && drag.hover.valid) {
      p.row = drag.hover.row;
      p.col = drag.hover.col;
    } else {
      p.row = null;
      p.col = null;
    }
    drag = null;
    ghostEl.classList.add("hidden");
    try {
      ev.target.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    render();
  }

  function rotateSelected() {
    if (won) return;
    const p = pieces[selected];
    p.cells = rotateCells(p.cells);
    if (p.row != null && !fits(p, p.row, p.col)) {
      p.row = null;
      p.col = null;
    }
    render();
  }

  function flipSelected() {
    if (won) return;
    const p = pieces[selected];
    p.cells = flipCells(p.cells);
    if (p.row != null && !fits(p, p.row, p.col)) {
      p.row = null;
      p.col = null;
    }
    render();
  }

  function returnSelected() {
    if (won) return;
    pieces[selected].row = null;
    pieces[selected].col = null;
    render();
    setStatus("積木已收回。");
  }

  function renderLevelGrid() {
    const grid = document.getElementById("level-grid");
    grid.innerHTML = "";
    window.LEVELS.forEach((lv, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "level-btn";
      b.textContent = lv.id;
      if (progress[lv.id]) b.classList.add("done");
      if (i === levelIndex) b.classList.add("current");
      b.addEventListener("click", () => loadLevel(i));
      grid.appendChild(b);
    });
  }

  document.getElementById("btn-start").addEventListener("click", () => {
    helpEl.classList.add("hidden");
  });
  document.getElementById("btn-rotate").addEventListener("click", rotateSelected);
  document.getElementById("btn-flip").addEventListener("click", flipSelected);
  document.getElementById("btn-return").addEventListener("click", returnSelected);
  document.getElementById("btn-reset").addEventListener("click", () => loadLevel(levelIndex));
  document.getElementById("btn-hint").addEventListener("click", () => {
    document.getElementById("hint-text").textContent = currentLevel().hint;
    hintEl.classList.remove("hidden");
  });
  document.getElementById("btn-close-hint").addEventListener("click", () => hintEl.classList.add("hidden"));
  document.getElementById("btn-skip").addEventListener("click", () => {
    loadLevel(Math.min(levelIndex + 1, window.LEVELS.length - 1));
  });
  document.getElementById("btn-levels").addEventListener("click", () => {
    renderLevelGrid();
    levelsEl.classList.remove("hidden");
  });
  document.getElementById("btn-close-levels").addEventListener("click", () => levelsEl.classList.add("hidden"));
  document.getElementById("btn-win-levels").addEventListener("click", () => {
    winEl.classList.add("hidden");
    renderLevelGrid();
    levelsEl.classList.remove("hidden");
  });
  document.getElementById("btn-next").addEventListener("click", () => {
    if (levelIndex >= window.LEVELS.length - 1) loadLevel(0);
    else loadLevel(levelIndex + 1);
  });

  boardEl.addEventListener("pointerdown", onBoardDown);
  boardEl.addEventListener("click", (ev) => {
    if (won || drag) return;
    const cell = ev.target.closest(".cell");
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const p = pieces[selected];
    if (p && p.row == null) tryPlace(p, r, c);
  });
  window.addEventListener("pointermove", onPointerMove, true);
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("pointercancel", onPointerUp, true);
  window.addEventListener("mousemove", (e) => {
    if (drag) onPointerMove(e);
  });
  window.addEventListener("mouseup", (e) => {
    if (drag) onPointerUp(e);
  });

  window.Dieshu = {
    place(id, row, col) {
      const p = pieces[id];
      if (!p || !fits(p, row, col)) return false;
      p.row = row;
      p.col = col;
      render();
      return true;
    },
    state() {
      return {
        level: currentLevel().id,
        won,
        selected,
        pieces: pieces.map((p) => ({ id: p.id, row: p.row, col: p.col })),
      };
    },
  };
  window.addEventListener("resize", () => {
    fitBoard();
    render();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") rotateSelected();
    if (e.key === "f" || e.key === "F") flipSelected();
  });

  loadLevel(0, { keepHelp: true });
})();
