/**
 * Premium particle network — fullscreen canvas background
 * Features: inward depth motion, node connections, mouse repulsion, glow
 */

(function () {
  "use strict";

  const canvas = document.getElementById("network-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });

  /* ---- Configuration ---- */
  const CONFIG = {
    particleCount: 0, // set dynamically from screen size
    particleDensity: 0.00012,
    maxParticles: 120,
    minParticles: 55,
    connectionDistance: 140,
    mouseRadius: 160,
    mouseForce: 0.35,
    inwardSpeed: 0.00035,
    driftSpeed: 0.15,
    nodeGlow: 6,
    lineOpacity: 0.14,
    nodeColor: "77, 232, 255",
    prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };

  let width = 0;
  let height = 0;
  let centerX = 0;
  let centerY = 0;
  let particles = [];
  let mouse = { x: -9999, y: -9999, active: false };
  let animationId = null;
  let dpr = 1;

  /* ---- Particle class ---- */
  class Particle {
    constructor() {
      this.reset(true);
    }

    /**
     * Spawn particle at outer region with depth value (0 = far, 1 = near center)
     * @param {boolean} randomDepth - if true, randomize starting depth
     */
    reset(randomDepth = false) {
      const angle = Math.random() * Math.PI * 2;
      const maxRadius = Math.max(width, height) * 0.65;
      const spawnRadius = maxRadius * (0.55 + Math.random() * 0.45);

      this.baseX = centerX + Math.cos(angle) * spawnRadius;
      this.baseY = centerY + Math.sin(angle) * spawnRadius;
      this.x = this.baseX;
      this.y = this.baseY;
      this.vx = 0;
      this.vy = 0;

      this.depth = randomDepth ? Math.random() * 0.6 : 0;
      this.driftAngle = Math.random() * Math.PI * 2;
      this.driftSpeed = CONFIG.driftSpeed * (0.5 + Math.random() * 0.5);
      this.size = 1 + Math.random() * 1.2;
    }

    /** Target position pulling inward based on depth */
    getTarget() {
      const pull = this.depth;
      const tx = centerX + (this.baseX - centerX) * (1 - pull * 0.92);
      const ty = centerY + (this.baseY - centerY) * (1 - pull * 0.92);
      return { x: tx, y: ty };
    }

    update() {
      if (CONFIG.prefersReducedMotion) {
        this.depth = 0.3;
        return;
      }

      // Slow inward depth progression — creates floating-in-space feel
      this.depth += CONFIG.inwardSpeed;
      if (this.depth >= 1) {
        this.reset(false);
        return;
      }

      const target = this.getTarget();

      // Gentle orbital drift
      this.driftAngle += 0.002;
      const driftX = Math.cos(this.driftAngle) * this.driftSpeed;
      const driftY = Math.sin(this.driftAngle) * this.driftSpeed;

      // Spring toward depth-based target
      this.vx += (target.x + driftX - this.x) * 0.008;
      this.vy += (target.y + driftY - this.y) * 0.008;

      // Mouse repulsion — fluid, organic
      if (mouse.active) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.hypot(dx, dy);

        if (dist < CONFIG.mouseRadius && dist > 0) {
          const strength = (1 - dist / CONFIG.mouseRadius) * CONFIG.mouseForce;
          const force = strength / dist;
          this.vx += dx * force * 8;
          this.vy += dy * force * 8;
        }
      }

      // Damping for smooth motion
      this.vx *= 0.92;
      this.vy *= 0.92;

      this.x += this.vx;
      this.y += this.vy;
    }

    draw() {
      const alpha = 0.35 + this.depth * 0.55;
      const glow = CONFIG.nodeGlow * (0.6 + this.depth * 0.5);

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (0.7 + this.depth * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${CONFIG.nodeColor}, ${alpha})`;
      ctx.shadowBlur = glow;
      ctx.shadowColor = `rgba(${CONFIG.nodeColor}, 0.8)`;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  /* ---- Init & resize ---- */
  function getParticleCount() {
    const area = width * height;
    const count = Math.floor(area * CONFIG.particleDensity);
    return Math.min(CONFIG.maxParticles, Math.max(CONFIG.minParticles, count));
  }

  function initParticles() {
    const count = getParticleCount();
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    centerX = width / 2;
    centerY = height / 2;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (particles.length === 0) {
      initParticles();
    } else {
      const target = getParticleCount();
      while (particles.length < target) particles.push(new Particle());
      if (particles.length > target) particles.length = target;
    }
  }

  /* ---- Draw connections between nearby nodes ---- */
  function drawConnections() {
    const len = particles.length;
    const maxDist = CONFIG.connectionDistance;
    const maxDistSq = maxDist * maxDist;

    for (let i = 0; i < len; i++) {
      const a = particles[i];
      for (let j = i + 1; j < len; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxDistSq) {
          const dist = Math.sqrt(distSq);
          const opacity =
            CONFIG.lineOpacity *
            (1 - dist / maxDist) *
            (0.5 + (a.depth + b.depth) * 0.25);

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${CONFIG.nodeColor}, ${opacity})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
  }

  /* ---- Main render loop ---- */
  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Subtle background glow at center
    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      Math.max(width, height) * 0.45
    );
    gradient.addColorStop(0, "rgba(77, 232, 255, 0.03)");
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    particles.forEach((p) => p.update());
    drawConnections();
    particles.forEach((p) => p.draw());

    animationId = requestAnimationFrame(animate);
  }

  /* ---- Pointer tracking (mouse + touch) ---- */
  function setPointer(x, y) {
    mouse.x = x;
    mouse.y = y;
    mouse.active = true;
  }

  function clearPointer() {
    mouse.active = false;
    mouse.x = -9999;
    mouse.y = -9999;
  }

  window.addEventListener("mousemove", (e) => setPointer(e.clientX, e.clientY));
  window.addEventListener("mouseleave", clearPointer);

  window.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches[0]) {
        setPointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: true }
  );
  window.addEventListener("touchend", clearPointer);

  window.addEventListener("resize", () => {
    resize();
  });

  /* ---- Start ---- */
  resize();
  animate();

  /* Cleanup if needed (e.g. SPA navigation) */
  window.addEventListener("beforeunload", () => {
    if (animationId) cancelAnimationFrame(animationId);
  });
})();

/**
 * Tic Tac Toe — visitor (X) vs unbeatable Almas bot (O)
 * Minimax AI, scoreboard persisted in localStorage
 */
(function () {
  "use strict";

  const PLAYER = "X";
  const ALMAS = "O";
  const STORAGE_KEY = "almas-ttt-scores";
  const WIN_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  const modal = document.getElementById("game-modal");
  const playBtn = document.getElementById("play-ttt-btn");
  const closeBtn = document.querySelector(".game-close");
  const resetBtn = document.getElementById("game-reset-btn");
  const boardEl = document.getElementById("ttt-board");
  const statusEl = document.getElementById("game-status");
  const scoreYouEl = document.getElementById("score-you");
  const scoreAlmasEl = document.getElementById("score-almas");
  const cells = boardEl ? [...boardEl.querySelectorAll(".ttt-cell")] : [];

  if (!modal || !playBtn || !boardEl || cells.length !== 9) return;

  let board = Array(9).fill("");
  let gameOver = false;
  let waitingForBot = false;
  let scores = loadScores();

  /* ---- Score persistence ---- */
  function loadScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          you: Number(parsed.you) || 0,
          almas: Number(parsed.almas) || 0,
        };
      }
    } catch (_) {
      /* ignore corrupt storage */
    }
    return { you: 0, almas: 0 };
  }

  function saveScores() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }

  function renderScores() {
    scoreYouEl.textContent = String(scores.you);
    scoreAlmasEl.textContent = String(scores.almas);
  }

  /* ---- Win / draw detection ---- */
  function getWinner(b) {
    for (const [a, c, d] of WIN_LINES) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    return null;
  }

  function isDraw(b) {
    return b.every((cell) => cell !== "") && !getWinner(b);
  }

  function getWinningLine(b) {
    for (const line of WIN_LINES) {
      const [a, c, d] = line;
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return line;
    }
    return null;
  }

  /* ---- Unbeatable minimax (Almas = O) ---- */
  function minimax(b, isMaximizing) {
    const winner = getWinner(b);
    if (winner === ALMAS) return 10;
    if (winner === PLAYER) return -10;
    if (isDraw(b)) return 0;

    if (isMaximizing) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (b[i] === "") {
          b[i] = ALMAS;
          best = Math.max(best, minimax(b, false));
          b[i] = "";
        }
      }
      return best;
    }

    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] === "") {
        b[i] = PLAYER;
        best = Math.min(best, minimax(b, true));
        b[i] = "";
      }
    }
    return best;
  }

  function getBestMove(b) {
    let bestScore = -Infinity;
    let move = -1;

    for (let i = 0; i < 9; i++) {
      if (b[i] === "") {
        b[i] = ALMAS;
        const score = minimax(b, false);
        b[i] = "";
        if (score > bestScore) {
          bestScore = score;
          move = i;
        }
      }
    }
    return move;
  }

  /* ---- UI updates ---- */
  function setStatus(message, type = "") {
    statusEl.textContent = message;
    statusEl.className = "game-status";
    if (type) statusEl.classList.add(type);
  }

  function renderBoard() {
    cells.forEach((cell, i) => {
      const value = board[i];
      cell.textContent = value;
      cell.classList.remove("ttt-cell--x", "ttt-cell--o", "ttt-cell--win");
      cell.disabled = gameOver || waitingForBot || value !== "";

      if (value === PLAYER) cell.classList.add("ttt-cell--x");
      if (value === ALMAS) cell.classList.add("ttt-cell--o");
    });
  }

  function highlightWin(line) {
    line.forEach((i) => cells[i].classList.add("ttt-cell--win"));
  }

  function endGame(winner) {
    gameOver = true;
    const winLine = getWinningLine(board);

    if (winner === PLAYER) {
      scores.you += 1;
      saveScores();
      renderScores();
      if (winLine) highlightWin(winLine);
      setStatus("You win! Impressive — but Almas will be ready for a rematch.", "is-win");
    } else if (winner === ALMAS) {
      scores.almas += 1;
      saveScores();
      renderScores();
      if (winLine) highlightWin(winLine);
      setStatus("Almas wins. Perfect play — try again?", "is-lose");
    } else {
      setStatus("Draw. Almas never slips — a tie is the best many can do.", "is-draw");
    }

    cells.forEach((cell) => {
      cell.disabled = true;
    });
  }

  function resetRound() {
    board = Array(9).fill("");
    gameOver = false;
    waitingForBot = false;
    renderBoard();
    setStatus("Your turn — make the first move.");
  }

  function handleCellClick(index) {
    if (gameOver || waitingForBot || board[index] !== "") return;

    board[index] = PLAYER;
    renderBoard();

    const winner = getWinner(board);
    if (winner) {
      endGame(winner);
      return;
    }
    if (isDraw(board)) {
      endGame(null);
      return;
    }

    waitingForBot = true;
    renderBoard();
    setStatus("Almas is thinking…");

    // Brief delay so the bot move feels natural
    window.setTimeout(() => {
      const move = getBestMove(board);
      waitingForBot = false;

      if (move === -1) {
        renderBoard();
        return;
      }

      board[move] = ALMAS;
      renderBoard();

      const w = getWinner(board);
      if (w) {
        endGame(w);
      } else if (isDraw(board)) {
        endGame(null);
      } else {
        setStatus("Your turn.");
      }
    }, 420);
  }

  /* ---- Modal open / close ---- */
  function openModal() {
    modal.removeAttribute("hidden");
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    resetRound();
    playBtn.blur();
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("hidden", "");
    document.body.style.overflow = "hidden"; /* landing page keeps hidden overflow */
  }

  /* ---- Event listeners ---- */
  playBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  resetBtn.addEventListener("click", resetRound);

  cells.forEach((cell) => {
    cell.addEventListener("click", () => {
      const index = Number(cell.dataset.index);
      handleCellClick(index);
    });
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });

  renderScores();
})();
