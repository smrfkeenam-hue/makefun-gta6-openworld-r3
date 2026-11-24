// Pedestrians: they walk the sidewalks, stroll the plaza and the beach
// promenade, and flee when a gunshot goes off or a car bears down on them.
import { WORLD, ROAD_W, SIDEWALK } from './config.js';
import { pick, range } from './rng.js';

const SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1', '#fd79a8', '#00cec9'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function spawnPedestrians(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const centre = pick(rng, vertical ? city.roadsV : city.roadsH);
    const side = rng() < 0.5 ? 1 : -1;
    const along = 150 + rng() * (WORLD - 300);
    const x = vertical ? centre + side * (ROAD_W / 2 + SIDEWALK / 2) : along;
    const y = vertical ? along : centre + side * (ROAD_W / 2 + SIDEWALK / 2);
    peds.push(makePed(x, y, rng, vertical ? 'v' : 'h', centre, side));
  }
  return peds;
}

function makePed(x, y, rng, road, centre, side) {
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    tx: x, ty: y,
    road: road || 'v', // the road whose sidewalk this ped walks
    centre: centre || 0,
    side: side || 1,
    crossing: false, // mid-turn at an intersection corner
    speed: range(rng, 42, 72),
    flee: 0, fleeX: 0, fleeY: 0,
    shirt: pick(rng, SHIRTS),
    skin: pick(rng, SKINS),
    bob: rng() * Math.PI * 2,
    hp: 100,
    dead: false,
    deadTimer: 0,
  };
}

// A new target on the ped's OWN road, so their path stays on the sidewalk
// and never cuts across traffic. Near an intersection they may turn onto
// the crossing road — via the corner, like a real pedestrian, never
// diagonally across the junction.
function nextSidewalkTarget(p, city, rng) {
  const off = ROAD_W / 2 + SIDEWALK / 2;
  if (p.crossing) {
    // Reached the corner; now walk along the new road, on this block's
    // stretch of it.
    p.crossing = false;
    pickSegmentTarget(p, city, rng);
    return;
  }
  const along = p.road === 'v' ? p.y : p.x;
  const crossings = p.road === 'v' ? city.roadsH : city.roadsV;
  const nearest = crossings.reduce((a, b) => Math.abs(along - a) < Math.abs(along - b) ? a : b);
  if (Math.abs(along - nearest) < 100 && rng() < 0.35) {
    const oldCentre = p.centre;
    const oldSide = p.side;
    p.road = p.road === 'v' ? 'h' : 'v';
    p.centre = nearest;
    p.side = rng() < 0.5 ? 1 : -1;
    p.crossing = true;
    // The corner where the two sidewalks meet.
    if (p.road === 'v') { p.tx = p.centre + p.side * off; p.ty = oldCentre + oldSide * off; }
    else { p.tx = oldCentre + oldSide * off; p.ty = p.centre + p.side * off; }
    return;
  }
  // Stay on this block's stretch of sidewalk: between the two crossings
  // bracketing the ped, so they never walk across a road mid-block.
  pickSegmentTarget(p, city, rng);
}

// Pick a target on the ped's road between the two crossings bracketing
// their current position — one block's stretch of sidewalk.
function pickSegmentTarget(p, city, rng) {
  const off = ROAD_W / 2 + SIDEWALK / 2;
  const along = p.road === 'v' ? p.y : p.x;
  const crossings = p.road === 'v' ? city.roadsH : city.roadsV;
  let lo = 150;
  let hi = WORLD - 150;
  for (const c of crossings) {
    if (c < along && c > lo) lo = c;
    if (c > along && c < hi) hi = c;
  }
  const target = lo + 80 + rng() * Math.max(40, hi - lo - 160);
  if (p.road === 'v') { p.tx = p.centre + p.side * off; p.ty = target; }
  else { p.tx = target; p.ty = p.centre + p.side * off; }
}

export function randomSidewalkPoint(city, rng) {
  const vertical = rng() < 0.5;
  const centre = pick(rng, vertical ? city.roadsV : city.roadsH);
  const side = rng() < 0.5 ? 1 : -1;
  const off = side * (ROAD_W / 2 + SIDEWALK / 2);
  const along = 150 + rng() * (WORLD - 300);
  const point = vertical ? { x: centre + off, y: along } : { x: along, y: centre + off };
  point.road = vertical ? 'v' : 'h';
  point.centre = centre;
  point.side = side;
  return point;
}

// A gunshot or a near-miss makes every ped nearby run for it.
export function scarePeds(W, x, y, radius) {
  for (const p of W.peds) {
    if (p.dead) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) {
      p.flee = 3;
      p.fleeX = x;
      p.fleeY = y;
    }
  }
}

export function updatePedestrians(W, dt) {
  const { city } = W;
  for (const p of W.peds) {
    if (p.dead) {
      p.deadTimer += dt;
      continue;
    }
    p.bob += dt * 8;
    let mx = 0;
    let my = 0;
    let speed = p.speed;
    if (p.flee > 0) {
      p.flee -= dt;
      const dx = p.x - p.fleeX;
      const dy = p.y - p.fleeY;
      const d = Math.hypot(dx, dy) || 1;
      mx = dx / d;
      my = dy / d;
      speed = 165;
    } else {
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) {
        if (p.plaza) {
          // Plaza strollers keep to the square.
          p.tx = 1600 + W.rng() * 200;
          p.ty = 1600 + W.rng() * 200;
        } else {
          nextSidewalkTarget(p, city, W.rng);
        }
      } else {
        mx = dx / d;
        my = dy / d;
      }
    }
    if (mx !== 0 || my !== 0) {
      p.angle = Math.atan2(my, mx);
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
    }
    p.x = Math.max(20, Math.min(WORLD - 20, p.x));
    p.y = Math.max(20, Math.min(WORLD - 20, p.y));

    // A fast car bearing down scares them before it hits them.
    for (const car of W.cars) {
      if (car.parked || Math.abs(car.speed) < 120) continue;
      const d = Math.hypot(p.x - car.x, p.y - car.y);
      if (d < 90 && p.flee <= 0) {
        p.flee = 2.5;
        p.fleeX = car.x;
        p.fleeY = car.y;
      }
    }
  }
  // Drop peds that died long ago so the crowd slowly refreshes.
  for (let i = W.peds.length - 1; i >= 0; i--) {
    if (W.peds[i].dead && W.peds[i].deadTimer > 8) {
      const np = randomSidewalkPoint(city, W.rng);
      W.peds[i] = makePed(np.x, np.y, W.rng, np.road, np.centre, np.side);
    }
  }
}

// Draw a pedestrian: shadow, body (shirt), head, walking bob.
export function drawPed(ctx, p) {
  if (p.dead) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(10, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(p.bob) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(p.x + 3, p.y + 4, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.3, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob * 0.3, 4.5, 0, Math.PI * 2);
  ctx.fill();
}
