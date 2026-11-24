// PALMIRA HEAT — tuning constants and shared palette.
// One place for every magic number so the rest of the game reads like a spec.
export const WORLD = 3400; // world is WORLD x WORLD units
export const ROAD_W = 110; // road width
export const ROAD_GAP = 400; // distance between parallel road centres
export const ROAD_FIRST = 300; // first road centre
export const ROAD_COUNT = 8; // roads each way (300..3100)
export const SIDEWALK = 24; // sidewalk width beside each road
export const LANE = 28; // lane offset from a road centre line

// Player
export const WALK_SPEED = 240;
export const RUN_SPEED = 380;
export const PLAYER_RADIUS = 14;
export const PLAYER_HP = 100;

// Cars
export const CAR_MAX_SPEED = 720;
export const CAR_ACCEL = 620;
export const CAR_BRAKE = 900;
export const CAR_REVERSE_MAX = 260;
export const CAR_TURN = 2.6; // radians per second at full lock, scaled by speed
export const CAR_RADIUS = 26;
export const COP_MAX_SPEED = 640;
export const TRAFFIC_SPEED = 300;

// Combat
export const BULLET_SPEED = 1300;
export const BULLET_DAMAGE = 34;
export const ENEMY_HP = 100;
export const PUNCH_DAMAGE = 20;
export const PUNCH_RANGE = 34;
export const FIRE_COOLDOWN = 0.22;

// Wanted
export const MAX_WANTED = 5;
export const HIDE_SECONDS = 12; // unseen this long and a star drops
export const BUST_SECONDS = 2.5; // cop beside a slow player on foot

// Palette: warm, sun-soaked coastal city.
export const PALETTE = {
  grass: '#7fae5a',
  lawn: '#8fc165',
  sand: '#e8d29a',
  sea: '#3f9db8',
  seaDeep: '#2b7d99',
  road: '#4a4a52',
  roadLine: '#d8d8c0',
  sidewalk: '#b9b3a4',
  curb: '#8f887a',
  blockMid: '#6f9e52',
  blockDown: '#5d5d66',
  blockSub: '#7fae5a',
  blockPort: '#7a7264',
  blockBeach: '#e8d29a',
  building: ['#c9b18c', '#b89a78', '#d8c9a8', '#a8b8c8', '#c8a8a0', '#9fb8a8', '#d8b890'],
  roof: ['#8a6f52', '#7a5f48', '#9a8a6a', '#6f7f8f', '#8f6f6f', '#7f8f7a'],
  house: ['#e8d8b8', '#d8c8a8', '#c8d8e8', '#e8c8b8', '#d8e8c8'],
  warehouse: ['#b8b0a0', '#a8a090', '#c0b8a8'],
  palm: '#3f8f4f',
  trunk: '#8a6f4f',
  hudBg: 'rgba(10, 10, 18, 0.62)',
  hudText: '#ffffff',
  gold: '#ffd94a',
  starOn: '#ffd94a',
  starOff: 'rgba(255,255,255,0.28)',
};

// Car types: name, length, width, colour pool, top speed factor.
export const CAR_TYPES = [
  { name: 'sedan', len: 52, wid: 26, speed: 1.0, colors: ['#c0392b', '#2e86c1', '#e8e8e8', '#7d3c98', '#b7950b'] },
  { name: 'coupe', len: 50, wid: 25, speed: 1.12, colors: ['#e74c3c', '#f39c12', '#1abc9c', '#e8e8e8', '#2c3e50'] },
  { name: 'truck', len: 58, wid: 28, speed: 0.86, colors: ['#5d6d7e', '#7f8c8d', '#a04000', '#616a6b'] },
  { name: 'taxi', len: 52, wid: 26, speed: 1.0, colors: ['#f1c40f'] },
  { name: 'van', len: 56, wid: 28, speed: 0.9, colors: ['#ecf0f1', '#aab7b8', '#5dade2'] },
];

export const COP_COLORS = { body: '#1a2a4a', stripe: '#e8e8e8' };
export const GOLDEN_COUPE_COLOR = '#e8c33c';
