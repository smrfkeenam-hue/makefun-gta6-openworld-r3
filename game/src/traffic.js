// Traffic: cars that drive the road grid, keep to their lane, turn at
// intersections and stop for the car ahead — plus parked cars to steal.
import { WORLD, ROAD_W, LANE, TRAFFIC_SPEED, CAR_TYPES } from './config.js';
import { createCar, updateCar } from './vehicles.js';
import { pick, range } from './rng.js';

export function spawnTrafficCars(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const c = spawnOneTraffic(city, rng);
    if (c) cars.push(c);
  }
  return cars;
}

function spawnOneTraffic(city, rng) {
  const vertical = rng() < 0.5;
  const centre = pick(rng, vertical ? city.roadsV : city.roadsH);
  const dir = rng() < 0.5 ? 1 : -1;
  const lane = dir === 1 ? LANE : -LANE;
  const along = 150 + rng() * (WORLD - 300);
  const type = Math.floor(rng() * CAR_TYPES.length);
  const car = createCar(
    vertical ? centre + lane : along,
    vertical ? along : centre + lane,
    vertical ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (dir === 1 ? 0 : Math.PI),
    type, null, { traffic: true, driver: true },
  );
  car.road = vertical ? 'v' : 'h';
  car.roadCentre = centre;
  car.dir = dir;
  car.lane = lane;
  car.speed = TRAFFIC_SPEED * range(rng, 0.85, 1.1);
  car.turnAt = pick(rng, vertical ? city.roadsH : city.roadsV);
  return car;
}

// Parked cars along the curbs, free for the taking.
export function spawnParkedCars(city, rng, count) {
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < count * 8) {
    tries++;
    const vertical = rng() < 0.5;
    const centre = pick(rng, vertical ? city.roadsV : city.roadsH);
    const side = rng() < 0.5 ? 1 : -1;
    const along = 200 + rng() * (WORLD - 400);
    const x = vertical ? centre + side * (ROAD_W / 2 - 11) : along;
    const y = vertical ? along : centre + side * (ROAD_W / 2 - 11);
    // Keep parked cars away from intersections.
    const onCross = (vertical ? city.roadsH : city.roadsV).some((c) => Math.abs(along - c) < 110);
    if (onCross) continue;
    const type = Math.floor(rng() * CAR_TYPES.length);
    const car = createCar(x, y, vertical ? (side === 1 ? Math.PI / 2 : -Math.PI / 2) : (side === 1 ? 0 : Math.PI), type, null, { parked: true });
    cars.push(car);
  }
  return cars;
}

// Is there a car close ahead of this traffic car?
function carAhead(W, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const o of W.cars) {
    if (o === car || o.parked) continue;
    const dx = o.x - car.x;
    const dy = o.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (along > 0 && along < 78 && side < 24) return true;
  }
  return false;
}

export function updateTraffic(W, dt) {
  const { city, rng } = W;
  for (const car of W.cars) {
    if (!car.traffic || car.dead) continue;
    // At an intersection, sometimes turn onto the crossing road.
    const along = car.road === 'v' ? car.y : car.x;
    if (Math.abs(along - car.turnAt) < 12 && W.rng() < 0.02) {
      const newRoad = car.road === 'v' ? 'h' : 'v';
      const centres = newRoad === 'v' ? city.roadsV : city.roadsH;
      const nearest = centres.reduce((a, b) => Math.abs((newRoad === 'v' ? car.x : car.y) - a) < Math.abs((newRoad === 'v' ? car.x : car.y) - b) ? a : b);
      car.road = newRoad;
      car.roadCentre = nearest;
      car.dir = W.rng() < 0.5 ? 1 : -1;
      car.lane = car.dir === 1 ? LANE : -LANE;
      car.turnAt = pick(W.rng, newRoad === 'v' ? city.roadsH : city.roadsV);
    }
    // Steer back onto the lane line.
    const targetAngle = car.road === 'v'
      ? (car.dir === 1 ? Math.PI / 2 : -Math.PI / 2)
      : (car.dir === 1 ? 0 : Math.PI);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2));
    const blocked = carAhead(W, car);
    updateCar(car, dt, {
      throttle: blocked ? (car.speed > 30 ? -1 : 0) : (car.speed < TRAFFIC_SPEED ? 0.6 : 0),
      steer,
      handbrake: false,
    }, city, W);
    // Nudge the car back to its lane centre gently.
    if (car.road === 'v') car.x += ((car.roadCentre + car.lane) - car.x) * Math.min(1, dt * 1.2);
    else car.y += ((car.roadCentre + car.lane) - car.y) * Math.min(1, dt * 1.2);

    // Off the map: respawn on the opposite side.
    if (car.x < 60 || car.x > WORLD - 60 || car.y < 60 || car.y > WORLD - 60) {
      const fresh = spawnOneTraffic(city, rng);
      if (fresh) {
        car.x = fresh.x; car.y = fresh.y; car.angle = fresh.angle;
        car.road = fresh.road; car.roadCentre = fresh.roadCentre;
        car.dir = fresh.dir; car.lane = fresh.lane; car.turnAt = fresh.turnAt;
        car.speed = fresh.speed; car.damage = 0;
      }
    }
  }
}
