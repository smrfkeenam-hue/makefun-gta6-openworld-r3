// Cars: creation, arcade driving physics, damage, smoke and skid marks.
// One update function drives any car — the player's, traffic or police.
import { WORLD, CAR_TYPES, CAR_MAX_SPEED, CAR_ACCEL, CAR_BRAKE, CAR_REVERSE_MAX, CAR_TURN, CAR_RADIUS, COP_COLORS } from './config.js';
import { pick } from './rng.js';
import { collideBuildings } from './city.js';

let nextId = 1;

export function createCar(x, y, angle, typeIndex, color, opts) {
  const t = CAR_TYPES[typeIndex ?? 0];
  return {
    id: nextId++,
    x, y, angle,
    speed: 0,
    type: t.name,
    len: t.len,
    wid: t.wid,
    speedFactor: t.speed,
    color: color || pick(Math.random, t.colors),
    damage: 0, // 0..1, 1 = wrecked
    smoke: 0,
    parked: !!(opts && opts.parked),
    traffic: !!(opts && opts.traffic),
    cop: !!(opts && opts.cop),
    mission: !!(opts && opts.mission),
    driver: !!(opts && opts.driver), // a traffic car with a driver inside
    road: null, // traffic: 'v' or 'h'
    roadCentre: 0,
    dir: 1,
    lane: 0,
    turnAt: 0, // next intersection the car may turn at
    dead: false,
  };
}

export function createCopCar(x, y, angle) {
  const c = createCar(x, y, angle, 0, COP_COLORS.body, { cop: true, driver: true });
  c.speedFactor = 1.0;
  return c;
}

// Drive a car one step. inputs: {throttle (-1..1), steer (-1..1), handbrake}.
// Returns true when the car hit something hard this step.
export function updateCar(car, dt, inputs, city, W) {
  const maxFwd = CAR_MAX_SPEED * car.speedFactor * (car.damage > 0.7 ? 0.55 : 1);
  const maxRev = CAR_REVERSE_MAX;
  const t = inputs.throttle || 0;
  if (t > 0) car.speed += CAR_ACCEL * t * dt;
  else if (t < 0) {
    if (car.speed > 20) car.speed -= CAR_BRAKE * dt; // braking
    else car.speed += CAR_ACCEL * 0.6 * t * dt; // reversing
  }
  // Drag and rolling resistance.
  car.speed -= car.speed * (inputs.handbrake ? 1.6 : 0.35) * dt;
  if (Math.abs(car.speed) < 2 && t === 0) car.speed = 0;
  car.speed = Math.max(-maxRev, Math.min(maxFwd, car.speed));

  // Steering: only bites while moving; handbrake loosens the rear.
  const spd = Math.abs(car.speed);
  const grip = inputs.handbrake ? 1.5 : 1;
  const steerRate = CAR_TURN * (inputs.steer || 0) * Math.min(1, spd / 120) * grip;
  car.angle += steerRate * dt * (car.speed >= 0 ? 1 : -1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const clamped = {
    x: Math.max(20, Math.min(WORLD - 20, nx)),
    y: Math.max(20, Math.min(WORLD - 20, ny)),
  };
  const hitWall = clamped.x !== nx || clamped.y !== ny;
  const res = collideBuildings(city, clamped.x, clamped.y, CAR_RADIUS);
  car.x = res.x;
  car.y = res.y;

  let crashed = false;
  if (res.pushed || hitWall) {
    if (spd > 180) {
      crashed = true;
      car.damage = Math.min(1, car.damage + spd / 3000);
      car.speed *= -0.25;
      if (W) W.camera.shake = Math.min(14, W.camera.shake + spd / 60);
    } else {
      car.speed *= 0.4;
    }
  }

  // Skid marks when handbraking or cornering hard at speed.
  if (W && inputs.handbrake && spd > 220) {
    const bx = car.x - Math.cos(car.angle) * (car.len / 2);
    const by = car.y - Math.sin(car.angle) * (car.len / 2);
    W.skids.push({ x: bx, y: by, life: 6, max: 6 });
    if (W.skids.length > 400) W.skids.splice(0, W.skids.length - 400);
  }
  // Smoke when badly damaged.
  if (car.damage > 0.5 && W && Math.random() < 0.3) {
    W.particles.push({
      x: car.x + Math.cos(car.angle) * car.len * 0.4,
      y: car.y + Math.sin(car.angle) * car.len * 0.4,
      vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 20,
      life: 0.9, max: 0.9, size: 7 + Math.random() * 5, color: 'rgba(120,120,120,0.5)',
    });
  }
  return crashed;
}

// Circle-circle collision between two cars; pushes both apart.
export function collideCars(a, b, W) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = CAR_RADIUS * 1.7;
  if (d >= min || d < 0.01) return false;
  const push = (min - d) / 2;
  const ux = dx / d;
  const uy = dy / d;
  a.x -= ux * push; a.y -= uy * push;
  b.x += ux * push; b.y += uy * push;
  const impact = Math.abs(a.speed - b.speed);
  if (impact > 150) {
    a.damage = Math.min(1, a.damage + impact / 4000);
    b.damage = Math.min(1, b.damage + impact / 4000);
    a.speed *= 0.6; b.speed *= 0.6;
    if (W) {
      W.camera.shake = Math.min(12, W.camera.shake + impact / 80);
      for (let i = 0; i < 6; i++) {
        W.particles.push({
          x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
          vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200,
          life: 0.4, max: 0.4, size: 3, color: '#ffd94a',
        });
      }
    }
    return true;
  }
  return false;
}

// Draw a car top-down: shadow, body, cabin, windshield, lights, cop livery.
export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const l = car.len;
  const w = car.wid;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.fillRect(-l / 2 + 5, -w / 2 + 6, l, w);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -l / 2, -w / 2, l, w, 7);
  ctx.fill();
  // Cop stripe + light bar.
  if (car.cop) {
    ctx.fillStyle = COP_COLORS.stripe;
    ctx.fillRect(-l * 0.1, -w / 2, l * 0.2, w);
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
    ctx.fillRect(-4, -w / 2 - 2, 8, 5);
    ctx.fillStyle = flash ? '#2a6aff' : '#ff2a2a';
    ctx.fillRect(-4, w / 2 - 3, 8, 5);
  }
  // Cabin.
  ctx.fillStyle = 'rgba(20,24,32,0.9)';
  roundRect(ctx, -l * 0.22, -w * 0.36, l * 0.4, w * 0.72, 4);
  ctx.fill();
  // Windshield.
  ctx.fillStyle = 'rgba(160,210,230,0.85)';
  ctx.fillRect(l * 0.16, -w * 0.32, 4, w * 0.64);
  // Headlights / taillights.
  ctx.fillStyle = '#fff8c8';
  ctx.fillRect(l / 2 - 3, -w / 2 + 3, 3, 5);
  ctx.fillRect(l / 2 - 3, w / 2 - 8, 3, 5);
  ctx.fillStyle = '#e03030';
  ctx.fillRect(-l / 2, -w / 2 + 3, 3, 5);
  ctx.fillRect(-l / 2, w / 2 - 8, 3, 5);
  // Damage: dents show as dark patches.
  if (car.damage > 0.3) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-l / 2 + 4, -w / 2 + 4, 12, 8);
  }
  if (car.damage > 0.7) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(l / 2 - 18, w / 2 - 12, 12, 8);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
