// The player: Dana Vega, courier new in town. On foot she walks, runs,
// punches and shoots; near a car she can steal it (E) and drive; she can
// step out again (E) and pick up guns, health and cash.
import { WORLD, PLAYER_RADIUS, PLAYER_HP, WALK_SPEED, RUN_SPEED, PUNCH_RANGE, PUNCH_DAMAGE, FIRE_COOLDOWN } from './config.js';
import { collideBuildings } from './city.js';
import { updateCar, collideCars } from './vehicles.js';
import { fireBullet, punchHit } from './combat.js';
import { addWanted } from './police.js';
import { moveAxes, keyPressed } from './input.js';
import { sfxEnterCar, sfxPunch, sfxPickup, sfxCrash, engineUpdate } from './audio.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    hp: PLAYER_HP,
    onFoot: true,
    car: null, // the car she is driving, or null
    armed: false,
    ammo: 0,
    fireCd: 0,
    punchCd: 0,
    bob: 0,
    dead: false,
  };
}

export function playerPosition(W) {
  const p = W.player;
  if (!p.onFoot && p.car) return { x: p.car.x, y: p.car.y };
  return { x: p.x, y: p.y };
}

export function playerSpeed(W) {
  const p = W.player;
  if (!p.onFoot && p.car) return Math.abs(p.car.speed);
  return 0;
}

// Nearest stealable car within reach (parked or driven, not a cop car).
export function nearestStealableCar(W, range) {
  const p = W.player;
  let best = null;
  let bestD = range;
  for (const car of W.cars) {
    if (car.cop || car.dead) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function enterCar(W, car) {
  const p = W.player;
  p.onFoot = false;
  p.car = car;
  car.parked = false;
  car.traffic = false;
  car.driver = false;
  car.speed = 0;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Stealing is a crime — unless the car was already hers.
  if (!car.owned) {
    addWanted(W, 1, 'car-theft');
    car.owned = true;
  }
  sfxEnterCar();
}

function exitCar(W) {
  const p = W.player;
  const car = p.car;
  if (!car) return;
  p.onFoot = true;
  p.car = null;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 30;
  p.y = car.y + Math.sin(side) * 30;
  p.angle = car.angle;
  car.speed = 0;
}

export function updatePlayer(W, dt) {
  const p = W.player;
  const input = W.input;
  if (p.dead) return;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  const axes = moveAxes(input);

  if (p.onFoot) {
    // On foot: WASD movement, Shift to run, mouse aims.
    const speed = axes.run ? RUN_SPEED : WALK_SPEED;
    let mx = 0;
    let my = 0;
    if (axes.up) my -= 1;
    if (axes.down) my += 1;
    if (axes.left) mx -= 1;
    if (axes.right) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      p.bob += dt * (axes.run ? 14 : 10);
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
    }
    p.x = Math.max(20, Math.min(WORLD - 20, p.x));
    p.y = Math.max(20, Math.min(WORLD - 20, p.y));
    const res = collideBuildings(W.city, p.x, p.y, PLAYER_RADIUS);
    p.x = res.x;
    p.y = res.y;
    // Face the mouse while armed, else face the walk direction.
    if (p.armed) {
      p.angle = Math.atan2(W.mouseWorld.y - p.y, W.mouseWorld.x - p.x);
    } else if (len > 0) {
      p.angle = Math.atan2(my, mx);
    }
    // Enter a car.
    if (keyPressed(input, 'e')) {
      const car = nearestStealableCar(W, 60);
      if (car) enterCar(W, car);
    }
    // Shoot or punch.
    if (input.mouseDown && p.fireCd <= 0) {
      if (p.armed && p.ammo > 0) {
        fireBullet(W, p.x, p.y, p.angle, 'player');
        p.ammo--;
        p.fireCd = FIRE_COOLDOWN;
      } else if (!p.armed && p.punchCd <= 0) {
        punchHit(W, p.x, p.y, p.angle);
        p.punchCd = 0.35;
        sfxPunch();
      }
    }
    if (keyPressed(input, 'f') && p.punchCd <= 0) {
      punchHit(W, p.x, p.y, p.angle);
      p.punchCd = 0.35;
      sfxPunch();
    }
    // Pickups.
    for (const pk of W.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
        pk.taken = true;
        if (pk.kind === 'gun') { p.armed = true; p.ammo += 24; W.toast = 'PISTOL PICKED UP — 24 ROUNDS'; }
        if (pk.kind === 'health') { p.hp = Math.min(PLAYER_HP, p.hp + 50); W.toast = '+50 HEALTH'; }
        if (pk.kind === 'cash') { W.cash += pk.amount || 100; W.toast = `+$${pk.amount || 100}`; }
        sfxPickup();
      }
    }
    engineUpdate(0, false);
  } else if (p.car) {
    // Driving: W/S throttle, A/D steer, Space handbrake, E to step out.
    const car = p.car;
    const throttle = (axes.up ? 1 : 0) + (axes.down ? -1 : 0);
    const steer = (axes.left ? -1 : 0) + (axes.right ? 1 : 0);
    const crashed = updateCar(car, dt, { throttle, steer, handbrake: axes.handbrake }, W.city, W);
    if (crashed) sfxCrash();
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    // Dust kicked up off-road or at speed.
    if (Math.abs(car.speed) > 350 && Math.random() < 0.25) {
      W.particles.push({
        x: car.x - Math.cos(car.angle) * car.len * 0.5,
        y: car.y - Math.sin(car.angle) * car.len * 0.5,
        vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40,
        life: 0.6, max: 0.6, size: 6 + Math.random() * 5, color: 'rgba(190,170,130,0.45)',
      });
    }
    if (keyPressed(input, 'e')) exitCar(W);
    engineUpdate(Math.abs(car.speed) / 720, true);
    // Running a pedestrian over is a crime.
    for (const ped of W.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 60) {
        ped.dead = true;
        ped.deadTimer = 0;
        addWanted(W, 1, 'hit-ped');
        W.camera.shake = Math.min(10, W.camera.shake + 4);
      }
    }
  }

  // Car-car collisions involving the player's car.
  if (!p.onFoot && p.car) {
    for (const other of W.cars) {
      if (other === p.car || other.dead) continue;
      collideCars(p.car, other, W);
    }
  }

  if (p.hp <= 0 && !p.dead) {
    p.dead = true;
    W.mode = 'wasted';
  }
}

// Draw Dana on foot: shadow, jacket, head, gun when armed.
export function drawPlayer(ctx, p, time) {
  if (p.dead) return;
  const bob = Math.sin(p.bob) * 1.5;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(3, 4, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  // Jacket (teal) with a white stripe — Dana's look.
  ctx.fillStyle = '#0e7c7b';
  ctx.beginPath();
  ctx.arc(0, bob * 0.3, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(-2, -11 + bob * 0.3, 4, 22);
  // Head.
  ctx.fillStyle = '#e0ac69';
  ctx.beginPath();
  ctx.arc(2, bob * 0.3, 6, 0, Math.PI * 2);
  ctx.fill();
  // Gun.
  if (p.armed) {
    ctx.fillStyle = '#222222';
    ctx.fillRect(6, -2 + bob * 0.3, 12, 4);
  }
  ctx.restore();
}
