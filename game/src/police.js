// The wanted system and the Palmira police: crimes raise the star level,
// cop cars spawn and chase, and hiding long enough drops a star. A cop
// that pins the player on foot busts her.
import { WORLD, MAX_WANTED, HIDE_SECONDS, BUST_SECONDS, COP_MAX_SPEED, ROAD_W } from './config.js';
import { createCopCar, updateCar, collideCars } from './vehicles.js';
import { sfxBusted, sirenStart, sirenStop } from './audio.js';

// Per-crime cooldowns so one crash does not stack five stars at once.
const COOLDOWNS = { 'car-theft': 5, 'hit-ped': 2, shooting: 8, 'kill-cop': 4 };

export function addWanted(W, stars, reason) {
  const now = W.time;
  W.crimeCd = W.crimeCd || {};
  if (reason && W.crimeCd[reason] && now - W.crimeCd[reason] < (COOLDOWNS[reason] || 3)) return;
  if (reason) W.crimeCd[reason] = now;
  const before = W.wanted;
  W.wanted = Math.min(MAX_WANTED, W.wanted + stars);
  // Debug log of crimes, so a screenshot scene can say what raised the heat.
  W.crimeLog = W.crimeLog || [];
  if (W.crimeLog.length < 20) {
    const p = W.player;
    W.crimeLog.push(reason + '@' + now.toFixed(1) + 's(' + Math.round(p.onFoot || !p.car ? p.x : p.car.x) + ',' + Math.round(p.onFoot || !p.car ? p.y : p.car.y) + ')');
  }
  if (W.wanted > before) {
    W.hiddenTimer = 0;
    W.toast = W.wanted >= 3 ? 'WANTED LEVEL ' + W.wanted + ' — LOSE THE COPS!' : 'WANTED LEVEL ' + W.wanted;
  }
}

export function setWanted(W, stars) {
  W.wanted = Math.max(0, Math.min(MAX_WANTED, stars));
  W.hiddenTimer = 0;
}

export function clearWanted(W) {
  W.wanted = 0;
  W.hiddenTimer = 0;
  // Cops give up and drive off.
  for (const cop of W.cops) cop.leaving = true;
}

function nearestCopDistance(W) {
  const p = W.player;
  const px = p.onFoot || !p.car ? p.x : p.car.x;
  const py = p.onFoot || !p.car ? p.y : p.car.y;
  let best = Infinity;
  for (const cop of W.cops) {
    const d = Math.hypot(cop.x - px, cop.y - py);
    if (d < best) best = d;
  }
  return best;
}

// Spawn a cop car on a road a little way from the player.
function spawnCop(W) {
  const p = W.player;
  const px = p.onFoot || !p.car ? p.x : p.car.x;
  const py = p.onFoot || !p.car ? p.y : p.car.y;
  for (let tries = 0; tries < 12; tries++) {
    const vertical = W.rng() < 0.5;
    const centre = W.city[vertical ? 'roadsV' : 'roadsH'][Math.floor(W.rng() * W.city.roadsV.length)];
    const along = 200 + W.rng() * (WORLD - 400);
    const x = vertical ? centre : along;
    const y = vertical ? along : centre;
    const d = Math.hypot(x - px, y - py);
    if (d > 500 && d < 900) {
      const cop = createCopCar(x, y, Math.atan2(py - y, px - x));
      cop.leaving = false;
      W.cars.push(cop);
      W.cops.push(cop);
      return;
    }
  }
}

export function updatePolice(W, dt) {
  const p = W.player;
  const px = p.onFoot || !p.car ? p.x : p.car.x;
  const py = p.onFoot || !p.car ? p.y : p.car.y;

  // Keep the right number of cops on the street for the star level.
  const want = W.wanted === 0 ? 0 : Math.min(6, W.wanted + 1);
  const active = W.cops.filter((c) => !c.leaving && !c.dead).length;
  if (active < want && W.wanted > 0) spawnCop(W);

  // Hidden: no cop close for HIDE_SECONDS and a star drops.
  const nearest = nearestCopDistance(W);
  if (W.wanted > 0 && nearest > 550) {
    W.hiddenTimer += dt;
    if (W.hiddenTimer > HIDE_SECONDS) {
      W.wanted--;
      W.hiddenTimer = 0;
      W.toast = W.wanted === 0 ? 'YOU LOST THEM' : 'WANTED LEVEL ' + W.wanted;
      if (W.wanted === 0) clearWanted(W);
    }
  } else {
    W.hiddenTimer = 0;
  }
  W.hidden = W.wanted > 0 && nearest > 550;

  // Siren while any cop is near.
  if (nearest < 900 && W.cops.some((c) => !c.leaving)) sirenStart();
  else sirenStop();

  // Bust: a cop beside a slow player on foot pins her.
  if (W.wanted > 0 && p.onFoot && !p.dead) {
    if (nearest < 80) {
      W.bustTimer += dt;
      if (W.bustTimer > BUST_SECONDS) {
        W.mode = 'busted';
        sfxBusted();
        return;
      }
    } else {
      W.bustTimer = 0;
    }
  } else {
    W.bustTimer = 0;
  }

  // Chase AI: steer toward the player with a little prediction, ram on contact.
  for (let i = W.cops.length - 1; i >= 0; i--) {
    const cop = W.cops[i];
    if (cop.dead) continue;
    if (cop.leaving) {
      // Drive away and despawn offscreen.
      updateCar(cop, dt, { throttle: 0.7, steer: 0, handbrake: false }, W.city, W);
      if (Math.hypot(cop.x - px, cop.y - py) > 1200) {
        cop.dead = true;
        W.cops.splice(i, 1);
        const ci = W.cars.indexOf(cop);
        if (ci !== -1) W.cars.splice(ci, 1);
      }
      continue;
    }
    // Predict where the player will be, aim there.
    const pvx = p.onFoot || !p.car ? 0 : Math.cos(p.car.angle) * p.car.speed;
    const pvy = p.onFoot || !p.car ? 0 : Math.sin(p.car.angle) * p.car.speed;
    const tx = px + pvx * 0.5;
    const ty = py + pvy * 0.5;
    const wantAngle = Math.atan2(ty - cop.y, tx - cop.x);
    let diff = wantAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const dist = Math.hypot(px - cop.x, py - cop.y);
    // Slow down a touch when very close so the ram is a nudge, not a teleport.
    const throttle = dist < 60 ? 0.5 : 1;
    updateCar(cop, dt, { throttle, steer, handbrake: false }, W.city, W);
    // Cap cop speed a little below the player's top speed so escape is
    // possible (a scene may set cop.maxSpeed to stage a closer chase).
    const cap = cop.maxSpeed || COP_MAX_SPEED;
    if (cop.speed > cap) cop.speed = cap;
    // Ramming the player's car damages both.
    if (!p.onFoot && p.car) {
      if (collideCars(cop, p.car, W)) {
        // The crash already shook the camera in collideCars.
      }
    }
    // A cop car wrecked by the player raises the heat.
    if (cop.damage >= 1 && !cop.dead) {
      cop.dead = true;
      addWanted(W, 1, 'kill-cop');
      W.cops.splice(i, 1);
    }
  }
}
