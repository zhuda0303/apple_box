import { Game } from "./game/Game.js";

const canvas = document.querySelector("[data-canvas]");
const elScore = document.querySelector("[data-score]");
const elLevel = document.querySelector("[data-level]");
const elNext = document.querySelector("[data-next]");
const btnMute = document.querySelector("[data-mute]");
const btnPause = document.querySelector("[data-pause]");
const overlay = document.querySelector("[data-overlay]");
const btnResume = document.querySelector("[data-resume]");
const btnRestart = document.querySelector("[data-restart]");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas element not found");
}

const game = new Game({
  canvas,
  onHud: ({ score, level, nextAt }) => {
    if (elScore) elScore.textContent = String(score);
    if (elLevel) elLevel.textContent = String(level);
    if (elNext) elNext.textContent = String(nextAt);
  },
});

const setOverlay = (open) => {
  if (!overlay) return;
  overlay.hidden = !open;
  if (open) {
    btnResume?.focus();
  } else {
    btnPause?.focus();
  }
};

btnPause?.addEventListener("click", () => {
  game.togglePause();
  setOverlay(game.isPaused());
});

btnResume?.addEventListener("click", () => {
  game.setPaused(false);
  setOverlay(false);
});

btnRestart?.addEventListener("click", () => {
  game.restart();
  game.setPaused(false);
  setOverlay(false);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    game.togglePause();
    setOverlay(game.isPaused());
  }
});

btnMute?.addEventListener("click", () => {
  const next = !game.isMuted();
  game.setMuted(next);
  btnMute.setAttribute("aria-label", next ? "사운드 켜기" : "사운드 끄기");
  btnMute.dataset.muted = String(next);
  btnMute.innerHTML = next ? "<span aria-hidden=\"true\">🔇</span>" : "<span aria-hidden=\"true\">🔈</span>";
});

game.start();

