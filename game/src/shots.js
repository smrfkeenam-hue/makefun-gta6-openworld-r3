// Screenshot scenes: ?shot=<name>&seed=<n> builds a fresh seeded world,
// runs the REAL game forward with a simple autopilot for a fixed number of
// seconds, and stops at one composed frame. The screenshots are real renders
// of the game's own code — never edited or composited.
// Also ?shot=selftest: runs every scene's simulation and reports errors.
import { createWorld } from './world.js';
import { stepWorld } from './step.js';
import { drawWorld } from './render.js';
import { drawHUD } from './hud.js';
import { createCar, createCopCar } from './vehicles.js';
import { spawnEnemy, fireBullet } from './combat.js';
import { setWanted, clearWanted } from './police.js';
import { saveGame, loadSave } from './save.js';

function stubInput() {
  return {
    keys: new Set(),
    mouseX: 640,
    mouseY: 360,
    mouseDown: false,
    clicked: false,
    clickX: 0,
    clickY: 0,
    override: null,
    pressed: new Set(),
  };
}

// Remove moving traffic AND parked cars inside a rectangle so the
// autopilot's route is clear and the shot shows driving, not a pile-up.
function clearRoute(W, x0, y0, x1, y1) {
  W.cars = W.cars.filter((c) => {
    if (c === W.player.car) return true;
    return !(c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1);
  });
}

// Autopilot: steer the player's car toward a point on the road ahead,
// braking when another car is right in front of it.
function driveToward(W, tx, ty) {
  const car = W.player.car;
  if (!car) return;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Blocked? A car close ahead in the driving direction — including one
  // crossing the player's path at an intersection.
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let blocked = false;
  for (const o of W.cars) {
    if (o === car || o.parked) continue;
    const dx = o.x - car.x;
    const dy = o.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (along > 0 && along < 160 && side < 55) { blocked = true; break; }
  }
  W.input.override = {
    up: !blocked,
    down: blocked,
    left: diff < -0.08,
    right: diff > 0.08,
    handbrake: false,
  };
}

// Autopilot on foot: walk toward a point.
function walkToward(W, tx, ty) {
  const p = W.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  W.input.override = {
    up: dy < -8,
    down: dy > 8,
    left: dx < -8,
    right: dx > 8,
    handbrake: false,
  };
}

function runSteps(W, steps, canvasW, canvasH, perStep) {
  const dt = 1 / 60;
  for (let i = 0; i < steps; i++) {
    if (perStep) perStep(i);
    stepWorld(W, dt, canvasW, canvasH);
    W.input.pressed.clear();
  }
  W.input.override = null;
}

function putPlayerInCar(W, x, y, angle, typeIndex, color) {
  const car = createCar(x, y, angle, typeIndex, color, {});
  car.owned = true;
  W.cars.push(car);
  const p = W.player;
  p.onFoot = false;
  p.car = car;
  p.x = x;
  p.y = y;
  p.angle = angle;
  W.camera.x = x;
  W.camera.y = y;
  return car;
}

const SCENES = {
  // Cover: a police chase — player car, two cop cars behind, 3 stars,
  // minimap and a mission objective on the HUD.
  chase(W, canvasW, canvasH) {
    clearRoute(W, 300, 1380, 2800, 1650);
    const car = putPlayerInCar(W, 900, 1500, 0, 1, '#e74c3c');
    car.speed = 500;
    W.missions.index = 1;
    W.missions.step = 1;
    W.missions.started = true;
    W.missions.introTimer = 0;
    W.missions.banner = '';
    W.missions.bannerTimer = 0;
    setWanted(W, 3);
    const cop1 = createCopCar(550, 1472, 0);
    const cop2 = createCopCar(450, 1532, 0);
    cop1.speed = 520;
    cop2.speed = 520;
    cop1.maxSpeed = 780; // staged chase pace: close behind, never catching
    cop2.maxSpeed = 760;
    W.cars.push(cop1, cop2);
    W.cops.push(cop1, cop2);
    runSteps(W, 170, canvasW, canvasH, () => driveToward(W, W.player.car.x + 300, 1528));
  },

  // Driving through downtown with traffic and pedestrians.
  drive(W, canvasW, canvasH) {
    clearRoute(W, 1780, 1100, 2020, 2450);
    putPlayerInCar(W, 1900, 2350, -Math.PI / 2, 0, '#2e86c1');
    runSteps(W, 200, canvasW, canvasH, () => driveToward(W, 1872, W.player.car.y - 300));
  },

  // On foot in the busy plaza with pedestrians and shops.
  foot(W, canvasW, canvasH) {
    const p = W.player;
    p.x = 1620;
    p.y = 1780;
    W.camera.x = p.x;
    W.camera.y = p.y;
    // A crowd spread across the plaza, each strolling to their own spot.
    for (let i = 0; i < 14; i++) {
      const a = W.rng() * Math.PI * 2;
      const r = 40 + W.rng() * 130;
      W.peds.push({
        x: 1700 + Math.cos(a) * r,
        y: 1700 + Math.sin(a) * r,
        angle: W.rng() * Math.PI * 2,
        tx: 1600 + W.rng() * 200,
        ty: 1600 + W.rng() * 200,
        road: 'v', centre: 1500, side: 1, plaza: true,
        speed: 50,
        flee: 0, fleeX: 0, fleeY: 0,
        shirt: ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'][i % 5],
        skin: '#e0ac69',
        bob: W.rng() * 6,
        hp: 100, dead: false, deadTimer: 0,
      });
    }
    runSteps(W, 150, canvasW, canvasH, (i) => {
      if (i < 90) walkToward(W, 1700, 1700);
    });
  },

  // A mission in progress at the pier: armed, rivals in view, a shot fired.
  mission(W, canvasW, canvasH) {
    W.missions.index = 2;
    W.missions.step = 1;
    W.missions.started = true;
    W.missions.introTimer = 0;
    W.missions.banner = '';
    W.missions.bannerTimer = 0;
    const p = W.player;
    p.x = 2200;
    p.y = 2980;
    p.armed = true;
    p.ammo = 24;
    W.camera.x = p.x;
    W.camera.y = p.y;
    const spots = [[2320, 3010], [2380, 3060], [2290, 3100], [2420, 2990]];
    for (const [x, y] of spots) spawnEnemy(W, x, y);
    runSteps(W, 60, canvasW, canvasH, (i) => {
      // Aim at the nearest rival through the mouse position.
      const target = W.enemies[0];
      if (target) {
        W.input.mouseX = target.x - (W.camera.x - canvasW / 2);
        W.input.mouseY = target.y - (W.camera.y - canvasH / 2);
      }
      if (i === 55) fireBullet(W, p.x, p.y, p.angle, 'player');
    });
  },
};

export function runShot(ctx, canvas) {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot') || 'chase';
  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  const canvasW = canvas.width;
  const canvasH = canvas.height;

  if (name === 'selftest') {
    try {
      for (const key of Object.keys(SCENES)) {
        const W = createWorld(seed);
        W.input = stubInput();
        W.mode = 'playing';
        SCENES[key](W, canvasW, canvasH);
        drawWorld(ctx, W, canvasW, canvasH, W.time);
        drawHUD(ctx, W, canvasW, canvasH, W.time);
      }
      document.title = 'SELFTEST OK';
    } catch (err) {
      document.title = 'SELFTEST ERROR: ' + (err && err.message ? err.message : err);
    }
    return;
  }

  if (name === 'playtest') {
    runPlaytest(canvasW, canvasH);
    return;
  }

  const scene = SCENES[name];
  if (!scene) {
    document.title = 'SHOT ERROR: unknown scene ' + name;
    return;
  }
  const W = createWorld(seed);
  W.input = stubInput();
  W.mode = 'playing';
  scene(W, canvasW, canvasH);
  // Report the scene's end state in the title for debugging.
  const crimes = (W.crimeLog || []).join(' ');
  const state = ' wanted=' + W.wanted + ' cash=' + W.cash + (crimes ? ' crimes[' + crimes + ']' : '');
  // Paint in a continuous animation loop: a late window resize clears a
  // canvas, so one paint is not enough — repainting the same composed
  // frame every tick keeps it on screen for the screenshot.
  const paint = () => {
    drawWorld(ctx, W, canvasW, canvasH, W.time);
    drawHUD(ctx, W, canvasW, canvasH, W.time);
    document.title = 'SHOT ' + name + ' READY' + state;
    requestAnimationFrame(paint);
  };
  paint();
}

// Scripted play-test: drives the real game through its core loops —
// steal a car, drive, police chase, a full mission, combat, save/load —
// and reports PASS/FAIL per check in the document title.
function runPlaytest(canvasW, canvasH) {
  const results = [];
  const check = (name, ok, detail) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' (' + detail + ')' : ''));
  try {
    const W = createWorld(7);
    W.input = stubInput();
    W.mode = 'playing';
    const dt = 1 / 60;
    const step = (n, per) => {
      for (let i = 0; i < n; i++) {
        if (per) per(i);
        stepWorld(W, dt, canvasW, canvasH);
        W.input.pressed.clear();
      }
    };

    // 1. Enter the car by the safehouse (E).
    W.input.pressed.add('e');
    step(1);
    check('enter-car', !W.player.onFoot && !!W.player.car);
    // 2. Stealing raised the heat.
    check('wanted-after-theft', W.wanted >= 1, 'wanted=' + W.wanted);
    clearWanted(W);

    // 3. Drive: put the car on a road and drive north.
    W.player.car.x = 728;
    W.player.car.y = 2000;
    W.player.car.angle = -Math.PI / 2;
    W.player.car.speed = 0;
    clearRoute(W, 640, 800, 820, 2100);
    const sx = W.player.car.x;
    const sy = W.player.car.y;
    step(150, () => driveToward(W, 672, W.player.car.y - 300));
    const moved = Math.hypot(W.player.car.x - sx, W.player.car.y - sy);
    check('drive-moves', moved > 400, 'moved=' + Math.round(moved));

    // 4. Police respond to a 3-star wanted level.
    setWanted(W, 3);
    step(300);
    check('cops-spawn', W.cops.length >= 2, 'cops=' + W.cops.length);
    const px = W.player.car.x;
    const py = W.player.car.y;
    const nearest = W.cops.length ? Math.min(...W.cops.map((c) => Math.hypot(c.x - px, c.y - py))) : Infinity;
    check('cops-chase', nearest < 900, 'nearest=' + Math.round(nearest));
    clearWanted(W);

    // 5. Mission 1 completes: reach each marker in turn.
    W.player.car.x = 1700;
    W.player.car.y = 3050;
    step(5);
    check('mission-starts', W.missions.started === true);
    W.player.car.x = 1700;
    W.player.car.y = 1500;
    step(5);
    check('mission-completes', W.missions.done === 1 && W.cash === 350, 'done=' + W.missions.done + ' cash=' + W.cash);

    // 6. Combat: step out and shoot a rival dead.
    W.input.pressed.add('e');
    step(1);
    check('exit-car', W.player.onFoot === true);
    W.player.armed = true;
    W.player.ammo = 24;
    spawnEnemy(W, W.player.x + 120, W.player.y);
    const enemy = W.enemies[W.enemies.length - 1];
    for (let s = 0; s < 10 && !enemy.dead; s++) {
      const a = Math.atan2(enemy.y - W.player.y, enemy.x - W.player.x);
      W.player.angle = a;
      fireBullet(W, W.player.x, W.player.y, a, 'player');
      step(12);
    }
    check('combat-kill', enemy.dead === true, 'enemyHp=' + Math.round(enemy.hp));

    // 7. Save and load round-trip.
    saveGame(W);
    const data = loadSave();
    check('save-load', !!data && data.cash === W.cash && data.missionsDone === W.missions.done,
      'savedCash=' + (data ? data.cash : 'null'));

    const allPass = results.every((r) => r.startsWith('PASS'));
    document.title = (allPass ? 'PLAYTEST OK: ' : 'PLAYTEST FAIL: ') + results.join(' | ');
  } catch (err) {
    document.title = 'PLAYTEST ERROR: ' + (err && err.message ? err.message : err);
  }
}
