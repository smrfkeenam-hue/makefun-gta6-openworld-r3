// The city of Palmira: a seeded grid of roads, blocks and buildings, split
// into districts (beach, downtown, suburbs, port, midtown) with their own
// ground colour, building style and props. Also answers collision and
// district questions for the rest of the game.
import { WORLD, ROAD_W, ROAD_GAP, ROAD_FIRST, ROAD_COUNT, SIDEWALK, PALETTE } from './config.js';
import { makeRng, range, pick, intRange } from './rng.js';

export function roadCentres() {
  const out = [];
  for (let i = 0; i < ROAD_COUNT; i++) out.push(ROAD_FIRST + i * ROAD_GAP);
  return out;
}

export function districtAt(x, y) {
  if (x > ROAD_FIRST + 6 * ROAD_GAP + 120) return 'beach'; // east strip
  if (y > ROAD_FIRST + 6 * ROAD_GAP + 120) return 'port'; // south strip
  const dx = x - WORLD / 2;
  const dy = y - WORLD / 2;
  if (Math.hypot(dx, dy) < 850) return 'downtown';
  if (x < ROAD_FIRST + ROAD_GAP + 120) return 'suburb';
  return 'midtown';
}

export function groundColor(x, y) {
  const d = districtAt(x, y);
  if (d === 'beach') return PALETTE.blockBeach;
  if (d === 'downtown') return PALETTE.blockDown;
  if (d === 'suburb') return PALETTE.blockSub;
  if (d === 'port') return PALETTE.blockPort;
  return PALETTE.blockMid;
}

export function isOnRoad(x, y) {
  const half = ROAD_W / 2;
  for (const c of roadCentres()) {
    if (Math.abs(x - c) < half) return true;
    if (Math.abs(y - c) < half) return true;
  }
  return false;
}

export function nearestRoadCentre(v) {
  let best = roadCentres()[0];
  for (const c of roadCentres()) if (Math.abs(v - c) < Math.abs(v - best)) best = c;
  return best;
}

// Build the whole city from a seed: buildings, palms, plaza, props.
export function buildCity(seed) {
  const rng = makeRng(seed);
  const roadsV = roadCentres();
  const roadsH = roadCentres();
  const buildings = [];
  const palms = [];
  const props = []; // {x, y, kind} small non-blocking decor

  // Blocks sit between neighbouring roads.
  for (let bi = 0; bi < ROAD_COUNT - 1; bi++) {
    for (let bj = 0; bj < ROAD_COUNT - 1; bj++) {
      const x0 = roadsV[bi] + ROAD_W / 2 + SIDEWALK + 8;
      const y0 = roadsH[bj] + ROAD_W / 2 + SIDEWALK + 8;
      const x1 = roadsV[bi + 1] - ROAD_W / 2 - SIDEWALK - 8;
      const y1 = roadsH[bj] + ROAD_W / 2 + SIDEWALK + 8;
      const y2 = roadsH[bj + 1] - ROAD_W / 2 - SIDEWALK - 8;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y2) / 2;
      const d = districtAt(cx, cy);
      const bw = x1 - x0;
      const bh = y2 - y0;

      if (d === 'downtown') {
        // One tower per block, sometimes two.
        const n = rng() < 0.5 ? 1 : 2;
        for (let k = 0; k < n; k++) {
          const w = n === 1 ? bw * range(rng, 0.6, 0.8) : bw * 0.42;
          const h = n === 1 ? bh * range(rng, 0.6, 0.8) : bh * 0.42;
          const bx = n === 1 ? cx : x0 + bw * (k === 0 ? 0.25 : 0.75);
          const by = n === 1 ? cy : y0 + bh * 0.5;
          buildings.push({
            x: bx - w / 2, y: by - h / 2, w, h,
            stories: intRange(rng, 4, 9),
            color: pick(rng, PALETTE.building),
            roof: pick(rng, PALETTE.roof),
            kind: 'tower',
          });
        }
      } else if (d === 'suburb') {
        // Four small houses with lawns.
        for (let hx = 0; hx < 2; hx++) {
          for (let hy = 0; hy < 2; hy++) {
            const w = range(rng, 70, 95);
            const h = range(rng, 60, 85);
            buildings.push({
              x: x0 + bw * (0.25 + hx * 0.5) - w / 2,
              y: y0 + bh * (0.25 + hy * 0.5) - h / 2,
              w, h, stories: 1,
              color: pick(rng, PALETTE.house),
              roof: pick(rng, PALETTE.roof),
              kind: 'house',
            });
          }
        }
      } else if (d === 'port') {
        // Warehouses and container stacks.
        const w = bw * range(rng, 0.7, 0.85);
        const h = bh * range(rng, 0.45, 0.6);
        buildings.push({
          x: cx - w / 2, y: y0 + bh * 0.3 - h / 2, w, h, stories: 2,
          color: pick(rng, PALETTE.warehouse),
          roof: '#6f6a5e', kind: 'warehouse',
        });
        for (let k = 0; k < 4; k++) {
          props.push({ x: x0 + 30 + k * 55, y: y0 + bh * 0.82, kind: 'container', c: pick(rng, ['#c0392b', '#2980b9', '#27ae60', '#f39c12']) });
        }
      } else if (d === 'beach') {
        // Low beach bars and palms.
        if (rng() < 0.8) {
          const w = range(rng, 90, 130);
          const h = range(rng, 60, 90);
          buildings.push({
            x: cx - w / 2, y: cy - h / 2, w, h, stories: 1,
            color: pick(rng, PALETTE.house),
            roof: '#e8e8e8', kind: 'bar',
          });
        }
        for (let k = 0; k < 5; k++) palms.push({ x: x0 + rng() * bw, y: y0 + rng() * bh });
      } else {
        // Midtown: two or three medium blocks.
        const n = intRange(rng, 2, 3);
        for (let k = 0; k < n; k++) {
          const w = range(rng, 80, 130);
          const h = range(rng, 70, 110);
          buildings.push({
            x: x0 + 20 + (k % 2) * (bw / 2 - 10) + range(rng, -8, 8),
            y: y0 + 20 + Math.floor(k / 2) * (bh / 2 - 10) + range(rng, -8, 8),
            w: Math.min(w, bw / 2 - 30), h: Math.min(h, bh / 2 - 30),
            stories: intRange(rng, 2, 4),
            color: pick(rng, PALETTE.building),
            roof: pick(rng, PALETTE.roof),
            kind: 'block',
          });
        }
      }

      // A few palms along the block's sidewalk corners.
      if (rng() < 0.4) palms.push({ x: x0 + 6, y: y0 + 6 });
      if (rng() < 0.4) palms.push({ x: x1 - 6, y: y2 - 6 });
    }
  }

  // The plaza: a pedestrian square in downtown, ringed with shops.
  const plaza = { x: WORLD / 2 - 130, y: WORLD / 2 - 130, w: 260, h: 260 };
  for (let k = 0; k < 6; k++) palms.push({ x: plaza.x + 20 + k * 44, y: plaza.y + 14 });
  for (let k = 0; k < 6; k++) palms.push({ x: plaza.x + 20 + k * 44, y: plaza.y + plaza.h - 14 });

  // Promenade palms along the beach road.
  const beachRoad = ROAD_FIRST + 6 * ROAD_GAP;
  for (let y = 350; y < WORLD - 300; y += 130) {
    palms.push({ x: beachRoad + ROAD_W / 2 + SIDEWALK + 14, y: y + range(rng, -10, 10) });
  }

  return { seed, roadsV, roadsH, buildings, palms, props, plaza };
}

// Circle vs building collision: push a circle out of any building it overlaps.
// Returns true when a push happened.
export function collideBuildings(city, px, py, radius) {
  let pushed = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(px, b.x + b.w));
    const ny = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - nx;
    const dy = py - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      pushed = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = radius - d;
        px += (dx / d) * push;
        py += (dy / d) * push;
      } else {
        // Centre inside the building: push out along the smallest penetration.
        const left = px - b.x;
        const right = b.x + b.w - px;
        const top = py - b.y;
        const bottom = b.y + b.h - py;
        const m = Math.min(left, right, top, bottom);
        if (m === left) px = b.x - radius;
        else if (m === right) px = b.x + b.w + radius;
        else if (m === top) py = b.y - radius;
        else py = b.y + b.h + radius;
      }
    }
  }
  return { x: px, y: py, pushed };
}

// Is a point inside any building (with a margin)?
export function insideBuilding(city, x, y, margin) {
  for (const b of city.buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return true;
  }
  return false;
}

// A random free point on a road (for spawning traffic / pickups).
export function randomRoadPoint(rng, city) {
  const vertical = rng() < 0.5;
  const c = pick(rng, vertical ? city.roadsV : city.roadsH);
  const along = 200 + rng() * (WORLD - 400);
  return vertical ? { x: c, y: along } : { x: along, y: c };
}
