// PALMIRA HEAT — entry point. Wires the canvas, the input, the game loop
// and the menu state machine together; the simulation itself lives in
// step.js, the world in world.js, the scenes in shots.js.
import { createWorld, applySave } from './world.js';
import { createInput, keyPressed, endFrame } from './input.js';
import { stepWorld } from './step.js';
import { drawWorld, drawStartScreen, drawHowToPlay, drawPauseMenu, drawEndScreen } from './render.js';
import { drawHUD } from './hud.js';
import { runShot } from './shots.js';
import { saveGame, loadSave, hasSave, clearSave } from './save.js';
import { ensureAudio, engineStart, setMuted, isMuted, sirenStop, engineStop } from './audio.js';
import { clearWanted } from './police.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Any script error is written into the title so the headless self-test
// can see it without a console.
window.addEventListener('error', (e) => {
  document.title = 'ERROR: ' + (e.message || 'script error');
});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Screenshot mode: ?shot=<name>&seed=<n> renders one composed frame and
// stops — no game loop, no audio, no animation.
const params = new URLSearchParams(window.location.search);
if (params.has('shot')) {
  runShot(ctx, canvas);
} else {
  startGame();
}

function startGame() {
  let W = createWorld((Math.random() * 1e9) | 0);
  const input = createInput(canvas);
  W.input = input;
  let audioReady = false;

  function wakeAudio() {
    if (audioReady) return;
    audioReady = true;
    ensureAudio();
    engineStart();
  }
  window.addEventListener('keydown', wakeAudio, { once: false });
  window.addEventListener('mousedown', wakeAudio, { once: false });

  // Auto-pause when the tab is hidden, so the city never plays on while
  // nobody is watching it.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && W.mode === 'playing') W.mode = 'paused';
  });

  // Losing the window pauses too — a click outside the game should not
  // leave Dana standing in traffic.
  window.addEventListener('blur', () => {
    if (W.mode === 'playing') W.mode = 'paused';
  });

  function newGame() {
    W = createWorld((Math.random() * 1e9) | 0);
    W.input = input;
    W.mode = 'playing';
    clearSave();
  }

  function continueGame() {
    const data = loadSave();
    W = createWorld((Math.random() * 1e9) | 0);
    W.input = input;
    if (data) applySave(W, data);
    W.mode = 'playing';
  }

  function respawn() {
    const p = W.player;
    p.dead = false;
    p.hp = 100;
    p.onFoot = true;
    p.car = null;
    p.x = 500;
    p.y = 500;
    W.cash = Math.max(0, W.cash - 100);
    clearWanted(W);
    W.camera.x = 500;
    W.camera.y = 500;
    W.camera.shake = 0;
    W.mode = 'playing';
  }

  function quitToMenu() {
    W = createWorld((Math.random() * 1e9) | 0);
    W.input = input;
    W.mode = 'menu';
    engineStop();
    sirenStop();
  }

  function handleButtons() {
    if (!input.clicked) return;
    for (const b of W.menuButtons) {
      if (input.clickX >= b.x && input.clickX <= b.x + b.w && input.clickY >= b.y && input.clickY <= b.y + b.h) {
        wakeAudio();
        if (b.id === 'new-game') newGame();
        else if (b.id === 'continue') continueGame();
        else if (b.id === 'how-to-play') W.mode = 'howto';
        else if (b.id === 'back') W.mode = 'menu';
        else if (b.id === 'resume') W.mode = 'playing';
        else if (b.id === 'save') saveGame(W);
        else if (b.id === 'restart') newGame();
        else if (b.id === 'retry') respawn();
        else if (b.id === 'menu') quitToMenu();
        break;
      }
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const cw = canvas.width;
    const ch = canvas.height;

    if (keyPressed(input, 'm')) setMuted(!isMuted());

    if (W.mode === 'playing') {
      if (keyPressed(input, 'escape') || keyPressed(input, 'p')) {
        W.mode = 'paused';
      } else {
        stepWorld(W, dt, cw, ch);
        if (W.mode === 'playing') {
          drawWorld(ctx, W, cw, ch, W.time);
          drawHUD(ctx, W, cw, ch, W.time);
        }
      }
    }

    if (W.mode === 'menu') {
      W.menuButtons = drawStartScreen(ctx, W, cw, ch, now / 1000, hasSave());
      handleButtons();
    } else if (W.mode === 'howto') {
      W.menuButtons = drawHowToPlay(ctx, cw, ch);
      handleButtons();
      if (keyPressed(input, 'escape')) W.mode = 'menu';
    } else if (W.mode === 'paused') {
      drawWorld(ctx, W, cw, ch, W.time);
      drawHUD(ctx, W, cw, ch, W.time);
      W.menuButtons = drawPauseMenu(ctx, cw, ch);
      handleButtons();
      if (keyPressed(input, 'escape') || keyPressed(input, 'p')) W.mode = 'playing';
    } else if (W.mode === 'busted' || W.mode === 'wasted') {
      drawWorld(ctx, W, cw, ch, W.time);
      W.menuButtons = drawEndScreen(ctx, cw, ch, W.mode);
      handleButtons();
    }

    endFrame(input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
