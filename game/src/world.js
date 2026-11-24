// The world object: everything the game simulates, built from one seed.
// Both the live game and the screenshot scenes start from createWorld.
import { buildCity } from './city.js';
import { makeRng } from './rng.js';
import { createPlayer } from './player.js';
import { spawnTrafficCars, spawnParkedCars } from './traffic.js';
import { spawnPedestrians } from './pedestrians.js';
import { createMissionState } from './missions.js';
import { createCar } from './vehicles.js';

export function createWorld(seed) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const player = createPlayer(500, 500); // the safehouse, west suburbs

  const cars = [];
  cars.push(...spawnTrafficCars(city, rng, 24));
  cars.push(...spawnParkedCars(city, rng, 30));
  // One parked car right by the safehouse so the first drive is seconds away.
  cars.push(createCar(545, 500, Math.PI / 2, 0, '#2e86c1', { parked: true }));

  const W = {
    seed,
    rng,
    city,
    player,
    cars,
    peds: spawnPedestrians(city, rng, 60),
    cops: [],
    bullets: [],
    enemies: [],
    particles: [],
    skids: [],
    pickups: [
      { x: 560, y: 560, kind: 'gun', taken: false },
      { x: 1700, y: 1620, kind: 'health', taken: false },
      { x: 2300, y: 2950, kind: 'health', taken: false },
      { x: 2900, y: 1100, kind: 'health', taken: false },
    ],
    wanted: 0,
    hiddenTimer: 0,
    hidden: false,
    bustTimer: 0,
    crimeCd: {},
    cash: 150,
    missions: createMissionState(),
    clock: 600, // 10:00 in the morning
    time: 0,
    camera: { x: 500, y: 500, shake: 0 },
    mode: 'menu',
    toast: '',
    toastTimer: 0,
    nearCar: false,
    goldenCoupe: null,
    input: null,
    mouseWorld: { x: 500, y: 500 },
    menuButtons: [],
  };
  return W;
}

// Apply a loaded save onto a fresh world.
export function applySave(W, data) {
  W.cash = data.cash;
  W.missions.done = data.missionsDone || 0;
  W.missions.index = data.missionIndex || 0;
  W.missions.step = 0;
  W.missions.started = false;
  W.player.x = data.x;
  W.player.y = data.y;
  W.player.hp = data.hp ?? 100;
  W.player.armed = !!data.armed;
  W.player.ammo = data.ammo || 0;
  W.camera.x = data.x;
  W.camera.y = data.y;
}
