// Missions and story. Dana Vega, a courier new in Palmira, gets pulled
// into Mara's crew one job at a time. Four missions, in order, each with
// steps, a marker on the map, and a cash reward.
import { ROAD_FIRST, ROAD_GAP } from './config.js';
import { createCar } from './vehicles.js';
import { spawnEnemy } from './combat.js';
import { setWanted, clearWanted } from './police.js';
import { sfxMission, sfxCash } from './audio.js';

export const STORY_INTRO =
  'Dana Vega came to Palmira with a scooter, a phone and $150. ' +
  'One delivery for the fixer Mara and the whole city knows her name. ' +
  'Four jobs stand between her and a real life here — if the cops let her live it.';

const MISSIONS = [
  {
    id: 'delivery',
    title: 'FIRST DELIVERY',
    giver: 'Mara',
    intro: 'Mara: "A package is waiting at the docks. Pick it up, bring it to the hotel downtown. No questions, no cops."',
    reward: 200,
    steps: [
      { type: 'goto', text: 'Pick up the package at the docks', x: 1700, y: 3050, label: 'PACKAGE' },
      { type: 'goto', text: 'Deliver it to the hotel downtown', x: 1700, y: 1500, label: 'HOTEL' },
    ],
  },
  {
    id: 'kiko',
    title: "KIKO'S RIDE",
    giver: 'Mara',
    intro: 'Mara: "Kiko is hiding at the beach bar and the cops are sniffing around. Pick him up and bring him to the safehouse. Drive like you mean it."',
    reward: 400,
    steps: [
      { type: 'goto', text: 'Pick up Kiko at the beach bar', x: 2900, y: 1500, label: 'KIKO', onArrive: 'heat' },
      { type: 'goto', text: 'Lose the heat and reach the safehouse', x: 500, y: 500, label: 'SAFEHOUSE', onArrive: 'clear' },
    ],
  },
  {
    id: 'pier',
    title: 'HEAT ON THE PIER',
    giver: 'Old Sal',
    intro: 'Old Sal: "Rivals took my pier and my cash with it. Clear them out, grab the stash, and come see me. Bring a gun."',
    reward: 600,
    steps: [
      { type: 'goto', text: 'Reach the pier at the port', x: 2300, y: 3050, label: 'PIER', onArrive: 'rivals' },
      { type: 'kill', text: 'Clear out the rivals', x: 2300, y: 3050, label: 'RIVALS' },
      { type: 'goto', text: 'Grab the stash', x: 2350, y: 3100, label: 'STASH', onArrive: 'stash' },
      { type: 'goto', text: 'Return to Old Sal at the docks', x: 1100, y: 3050, label: 'OLD SAL' },
    ],
  },
  {
    id: 'getaway',
    title: 'THE GOLDEN GETAWAY',
    giver: 'Mara',
    intro: 'Mara: "One last job. A golden coupe is sitting at the downtown dealership. Steal it, lose a three-star tail, and bring it home. Then we talk about your cut."',
    reward: 1000,
    steps: [
      { type: 'goto', text: 'Reach the dealership downtown', x: 1900, y: 1900, label: 'DEALERSHIP', onArrive: 'coupe' },
      { type: 'steal', text: 'Steal the golden coupe', x: 1900, y: 1900, label: 'COUPE', onArrive: 'heat3' },
      { type: 'goto', text: 'Escape to the safehouse', x: 500, y: 500, label: 'SAFEHOUSE', onArrive: 'clear' },
    ],
  },
];

export function missionCount() { return MISSIONS.length; }

export function createMissionState() {
  return {
    index: 0, // current mission
    step: 0,
    done: 0,
    started: false,
    introShown: false,
    introTimer: 0,
    banner: '',
    bannerTimer: 0,
  };
}

export function currentMission(W) {
  if (W.missions.index >= MISSIONS.length) return null;
  return MISSIONS[W.missions.index];
}

export function currentStep(W) {
  const m = currentMission(W);
  if (!m) return null;
  return m.steps[W.missions.step] || null;
}

export function missionMarker(W) {
  const s = currentStep(W);
  if (!s) return null;
  return { x: s.x, y: s.y, label: s.label };
}

export function startMission(W) {
  const m = currentMission(W);
  if (!m) return;
  W.missions.started = true;
  W.missions.introShown = true;
  W.missions.introTimer = 7;
  W.missions.banner = m.title;
  W.missions.bannerTimer = 3.5;
}

function advanceStep(W) {
  const m = currentMission(W);
  W.missions.step++;
  if (W.missions.step >= m.steps.length) {
    // Mission complete.
    W.cash += m.reward;
    W.missions.done++;
    W.missions.index++;
    W.missions.step = 0;
    W.missions.started = false;
    W.missions.introShown = false;
    W.missions.banner = 'MISSION COMPLETE  +$' + m.reward;
    W.missions.bannerTimer = 4;
    sfxMission();
    sfxCash();
    if (W.missions.index < MISSIONS.length) {
      W.toast = 'NEW MISSION AVAILABLE — HEAD FOR THE MARKER';
    } else {
      W.toast = 'ALL MISSIONS DONE — PALMIRA IS YOURS';
    }
  } else {
    W.missions.banner = '';
  }
}

function runStepEvent(W, event) {
  if (event === 'heat') {
    setWanted(W, 2);
    W.toast = 'KIKO IS IN — THE COPS ARE ON YOU!';
  } else if (event === 'heat3') {
    setWanted(W, 3);
    W.toast = 'THREE STARS — LOSE THEM AND GET HOME!';
  } else if (event === 'clear') {
    clearWanted(W);
  } else if (event === 'rivals') {
    const spots = [[2250, 3000], [2350, 3020], [2300, 3120], [2400, 3080]];
    for (const [x, y] of spots) spawnEnemy(W, x, y);
    W.toast = 'FOUR RIVALS ON THE PIER';
  } else if (event === 'stash') {
    W.pickups.push({ x: 2350, y: 3100, kind: 'cash', amount: 250, taken: false });
  } else if (event === 'coupe') {
    if (!W.goldenCoupe) {
      const coupe = createCar(1900, 1900, 0, 1, '#e8c33c', { parked: true, mission: true });
      W.cars.push(coupe);
      W.goldenCoupe = coupe;
    }
  }
}

export function updateMissions(W, dt) {
  const ms = W.missions;
  if (ms.bannerTimer > 0) ms.bannerTimer -= dt;
  if (ms.introTimer > 0) ms.introTimer -= dt;
  const m = currentMission(W);
  if (!m) return;
  if (!ms.started) {
    // A mission starts when the player reaches its first marker.
    const s = m.steps[0];
    const p = W.player;
    const px = p.onFoot || !p.car ? p.x : p.car.x;
    const py = p.onFoot || !p.car ? p.y : p.car.y;
    if (Math.hypot(px - s.x, py - s.y) < 90) startMission(W);
    return;
  }
  const step = currentStep(W);
  if (!step) return;
  const p = W.player;
  const px = p.onFoot || !p.car ? p.x : p.car.x;
  const py = p.onFoot || !p.car ? p.y : p.car.y;
  if (step.type === 'goto') {
    if (Math.hypot(px - step.x, py - step.y) < 90) {
      if (step.onArrive) runStepEvent(W, step.onArrive);
      advanceStep(W);
    }
  } else if (step.type === 'kill') {
    if (W.enemies.every((e) => e.dead)) advanceStep(W);
  } else if (step.type === 'steal') {
    if (!p.onFoot && p.car && p.car.mission) {
      if (step.onArrive) runStepEvent(W, step.onArrive);
      advanceStep(W);
    }
  }
}

// The first marker of the next unstarted mission, for the minimap.
export function nextMissionStart(W) {
  const m = currentMission(W);
  if (!m || W.missions.started) return null;
  return { x: m.steps[0].x, y: m.steps[0].y, label: m.steps[0].label };
}
