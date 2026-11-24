// Rendering: the city, the camera, particles, day lighting and every menu.
// One canvas, drawn in layers: ground, roads, buildings, props, skids,
// cars, people, bullets, particles, then a warm sun-soaked tint.
import { WORLD, ROAD_W, SIDEWALK, PALETTE } from './config.js';
import { districtAt, groundColor } from './city.js';
import { drawCar } from './vehicles.js';
import { drawPed } from './pedestrians.js';
import { drawPlayer } from './player.js';
import { drawEnemies, drawBullets, drawPickups } from './combat.js';
import { missionMarker, nextMissionStart } from './missions.js';
import { STORY_INTRO } from './missions.js';

// Camera follows the player with a velocity look-ahead and screen shake.
export function updateCamera(W, dt, canvasW, canvasH) {
  const cam = W.camera;
  const p = W.player;
  const px = p.onFoot || !p.car ? p.x : p.car.x;
  const py = p.onFoot || !p.car ? p.y : p.car.y;
  const vx = p.onFoot || !p.car ? 0 : Math.cos(p.car.angle) * p.car.speed;
  const vy = p.onFoot || !p.car ? 0 : Math.sin(p.car.angle) * p.car.speed;
  const tx = px + vx * 0.35;
  const ty = py + vy * 0.35;
  const k = Math.min(1, dt * 5);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  cam.x = Math.max(canvasW / 2 - 100, Math.min(WORLD - canvasW / 2 + 100, cam.x));
  cam.y = Math.max(canvasH / 2 - 100, Math.min(WORLD - canvasH / 2 + 100, cam.y));
  cam.shake = Math.max(0, cam.shake - dt * 26);
}

export function drawWorld(ctx, W, canvasW, canvasH, time) {
  const cam = W.camera;
  const shX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  const shY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  const vx = cam.x - canvasW / 2 + shX;
  const vy = cam.y - canvasH / 2 + shY;

  ctx.save();
  ctx.translate(-vx, -vy);

  const x0 = vx - 60;
  const y0 = vy - 60;
  const x1 = vx + canvasW + 60;
  const y1 = vy + canvasH + 60;

  drawGround(ctx, W, x0, y0, x1, y1);
  drawRoads(ctx, W, x0, y0, x1, y1);
  drawBuildings(ctx, W, x0, y0, x1, y1);
  drawProps(ctx, W, x0, y0, x1, y1, time);
  drawSkids(ctx, W);
  drawPickups(ctx, W, time);
  drawMissionMarker(ctx, W, time);

  // Cars (parked and driven), then people, then the player on top.
  for (const car of W.cars) {
    if (car.dead) continue;
    if (car.x < x0 - 80 || car.x > x1 + 80 || car.y < y0 - 80 || car.y > y1 + 80) continue;
    drawCar(ctx, car, time);
  }
  for (const p of W.peds) {
    if (p.x < x0 - 40 || p.x > x1 + 40 || p.y < y0 - 40 || p.y > y1 + 40) continue;
    drawPed(ctx, p);
  }
  drawEnemies(ctx, W);
  if (W.player.onFoot) drawPlayer(ctx, W.player, time);
  drawBullets(ctx, W);
  drawParticles(ctx, W);

  // Warm late-afternoon sun tint over the whole view.
  ctx.fillStyle = 'rgba(255, 176, 92, 0.07)';
  ctx.fillRect(vx, vy, canvasW, canvasH);
  ctx.restore();

  // Vignette.
  const grad = ctx.createRadialGradient(
    canvasW / 2, canvasH / 2, Math.min(canvasW, canvasH) * 0.45,
    canvasW / 2, canvasH / 2, Math.max(canvasW, canvasH) * 0.75,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(20,8,0,0.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);
}

function drawGround(ctx, W, x0, y0, x1, y1) {
  // Base grass.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Beach strip (east).
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(x0, 2820), y0, x1 - Math.max(x0, 2820), y1 - y0);
  // Sea band at the far east edge.
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(Math.max(x0, 3340), y0, x1 - Math.max(x0, 3340), y1 - y0);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
    ctx.fillRect(3346, y, 50, 3);
  }
  // Port strip (south).
  ctx.fillStyle = PALETTE.blockPort;
  ctx.fillRect(x0, Math.max(y0, 2820), x1 - x0, y1 - Math.max(y0, 2820));
  // Downtown concrete (circle).
  ctx.fillStyle = PALETTE.blockDown;
  ctx.beginPath();
  ctx.arc(WORLD / 2, WORLD / 2, 850, 0, Math.PI * 2);
  ctx.fill();
  // Suburb lawns (west).
  ctx.fillStyle = PALETTE.lawn;
  ctx.fillRect(x0, y0, Math.min(x1, 1020) - x0, y1 - y0);
  // The plaza.
  const pl = W.city.plaza;
  ctx.fillStyle = '#c9bda6';
  ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
  ctx.strokeStyle = '#a89a7e';
  ctx.lineWidth = 4;
  ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
}

function drawRoads(ctx, W, x0, y0, x1, y1) {
  const half = ROAD_W / 2;
  // Sidewalks.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const c of W.city.roadsV) {
    if (c + half + SIDEWALK < x0 || c - half - SIDEWALK > x1) continue;
    ctx.fillRect(c - half - SIDEWALK, y0, ROAD_W + SIDEWALK * 2, y1 - y0);
  }
  for (const c of W.city.roadsH) {
    if (c + half + SIDEWALK < y0 || c - half - SIDEWALK > y1) continue;
    ctx.fillRect(x0, c - half - SIDEWALK, x1 - x0, ROAD_W + SIDEWALK * 2);
  }
  // Asphalt.
  ctx.fillStyle = PALETTE.road;
  for (const c of W.city.roadsV) {
    if (c + half < x0 || c - half > x1) continue;
    ctx.fillRect(c - half, y0, ROAD_W, y1 - y0);
  }
  for (const c of W.city.roadsH) {
    if (c + half < y0 || c - half > y1) continue;
    ctx.fillRect(x0, c - half, x1 - x0, ROAD_W);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const c of W.city.roadsV) {
    if (c < x0 || c > x1) continue;
    for (let y = Math.floor(y0 / 60) * 60; y < y1; y += 60) {
      if (W.city.roadsH.some((h) => Math.abs(y + 15 - h) < 70)) continue;
      ctx.fillRect(c - 2, y, 4, 30);
    }
  }
  for (const c of W.city.roadsH) {
    if (c < y0 || c > y1) continue;
    for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) {
      if (W.city.roadsV.some((v) => Math.abs(x + 15 - v) < 70)) continue;
      ctx.fillRect(x, c - 2, 30, 4);
    }
  }
  // Crosswalks at intersections in view.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const vx of W.city.roadsV) {
    for (const hy of W.city.roadsH) {
      if (vx < x0 - 80 || vx > x1 + 80 || hy < y0 - 80 || hy > y1 + 80) continue;
      for (let k = -2; k <= 2; k++) {
        ctx.fillRect(vx + k * 12 - 4, hy - half - 14, 8, 10);
        ctx.fillRect(vx + k * 12 - 4, hy + half + 4, 8, 10);
      }
    }
  }
}

function drawBuildings(ctx, W, x0, y0, x1, y1) {
  for (const b of W.city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    const sh = 10 + b.stories * 4; // taller buildings cast longer shadows
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + sh, b.y + sh, b.w, b.h);
    // Walls.
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    // Roof detail: AC units / skylights for towers, tiles for houses.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    if (b.kind === 'tower') {
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 14, 10);
        }
      }
    } else if (b.kind === 'house') {
      ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
    }
  }
}

function drawProps(ctx, W, x0, y0, x1, y1, time) {
  // Containers at the port.
  for (const pr of W.city.props) {
    if (pr.x < x0 || pr.x > x1 || pr.y < y0 || pr.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(pr.x + 4, pr.y + 4, 44, 20);
    ctx.fillStyle = pr.c;
    ctx.fillRect(pr.x, pr.y, 44, 20);
  }
  // Palms: trunk + swaying fronds.
  for (const palm of W.city.palms) {
    if (palm.x < x0 - 30 || palm.x > x1 + 30 || palm.y < y0 - 30 || palm.y > y1 + 30) continue;
    const sway = Math.sin(time * 1.2 + palm.x * 0.05) * 0.12;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(palm.x + 8, palm.y + 9, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.trunk;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y + 6);
    ctx.lineTo(palm.x + 2, palm.y - 4);
    ctx.stroke();
    ctx.fillStyle = PALETTE.palm;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + sway;
      ctx.beginPath();
      ctx.ellipse(palm.x + Math.cos(a) * 9, palm.y - 4 + Math.sin(a) * 9, 10, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e8c33c';
    ctx.beginPath();
    ctx.arc(palm.x + 3, palm.y - 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSkids(ctx, W) {
  ctx.fillStyle = 'rgba(20,20,20,0.4)';
  for (const s of W.skids) {
    ctx.globalAlpha = Math.max(0, s.life / s.max) * 0.7;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMissionMarker(ctx, W, time) {
  const marker = W.missions.started ? missionMarker(W) : nextMissionStart(W);
  if (!marker) return;
  const pulse = 1 + Math.sin(time * 4) * 0.15;
  ctx.save();
  ctx.translate(marker.x, marker.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = 'rgba(255,217,74,0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd94a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(10, 8);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.fillText(marker.label, marker.x, marker.y - 52);
}

function drawParticles(ctx, W) {
  for (const pt of W.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- Menus (drawn on the canvas, buttons returned for click handling) ----

export function drawStartScreen(ctx, W, canvasW, canvasH, time, hasSaveGame) {
  // Sunset sky.
  const sky = ctx.createLinearGradient(0, 0, 0, canvasH);
  sky.addColorStop(0, '#ff9a56');
  sky.addColorStop(0.45, '#ffb26b');
  sky.addColorStop(0.7, '#ffd194');
  sky.addColorStop(1, '#ffe8c0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvasW, canvasH);
  // Sun.
  ctx.fillStyle = '#fff3c8';
  ctx.beginPath();
  ctx.arc(canvasW * 0.78, canvasH * 0.24, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,243,200,0.4)';
  ctx.beginPath();
  ctx.arc(canvasW * 0.78, canvasH * 0.24, 80, 0, Math.PI * 2);
  ctx.fill();
  // City silhouette.
  ctx.fillStyle = '#5a3d5e';
  const base = canvasH * 0.72;
  const widths = [70, 110, 60, 130, 80, 100, 140, 70, 120, 90];
  let bx = 0;
  for (let i = 0; i < widths.length && bx < canvasW; i++) {
    const h = 90 + ((i * 67) % 130);
    ctx.fillRect(bx, base - h, widths[i], h + canvasH);
    bx += widths[i] + 8;
  }
  // Palms silhouette.
  ctx.fillStyle = '#3d2a4a';
  for (let i = 0; i < 7; i++) {
    const px = 40 + i * (canvasW / 7);
    ctx.fillRect(px, base - 60, 5, 60);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(px + Math.cos(a) * 14, base - 62 + Math.sin(a) * 6, 16, 5, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Sea.
  ctx.fillStyle = '#2b7d99';
  ctx.fillRect(0, canvasH * 0.86, canvasW, canvasH * 0.14);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  for (let i = 0; i < 12; i++) {
    ctx.fillRect((i * 173) % canvasW, canvasH * 0.88 + (i % 3) * 12, 60, 3);
  }

  // Title.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 74px Arial';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 18;
  ctx.fillText('PALMIRA HEAT', canvasW / 2, canvasH * 0.24);
  ctx.shadowBlur = 0;
  ctx.font = 'bold 21px Arial';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('AN OPEN-WORLD CRIME GAME IN THE SUN-SOAKED CITY OF PALMIRA', canvasW / 2, canvasH * 0.24 + 36);

  // Story intro.
  ctx.font = '16px Arial';
  ctx.fillStyle = '#fff';
  const lines = wrap(ctx, STORY_INTRO, canvasW * 0.62);
  lines.forEach((line, i) => ctx.fillText(line, canvasW / 2, canvasH * 0.38 + i * 24));

  // Buttons.
  const bw = 260;
  const bh = 48;
  const cx = canvasW / 2 - bw / 2;
  const buttons = [];
  let by = canvasH * 0.52;
  buttons.push(drawButton(ctx, cx, by, bw, bh, 'NEW GAME', '#ffd94a', '#222'));
  by += 62;
  if (hasSaveGame) {
    buttons.push(drawButton(ctx, cx, by, bw, bh, 'CONTINUE', '#ffffff', '#222'));
    by += 62;
  }
  buttons.push(drawButton(ctx, cx, by, bw, bh, 'HOW TO PLAY', 'rgba(0,0,0,0.45)', '#fff'));
  const controlsY = by + 78;
  ctx.font = '14px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('WASD move & drive · E steal / exit car · MOUSE aim · CLICK shoot · F punch · SPACE handbrake · ESC pause · M mute', canvasW / 2, controlsY);
  ctx.font = '13px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('A complete open world: traffic, pedestrians, police, missions, combat and a save — all original, built for make.fun', canvasW / 2, controlsY + 22);
  return buttons;
}

export function drawHowToPlay(ctx, canvasW, canvasH) {
  ctx.fillStyle = 'rgba(10,10,20,0.88)';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 30px Arial';
  ctx.fillText('HOW TO PLAY', canvasW / 2, 70);
  const rows = [
    ['MOVE / DRIVE', 'WASD or arrow keys — W accelerates, S brakes and reverses, A/D steer'],
    ['RUN', 'Hold SHIFT on foot'],
    ['STEAL A CAR', 'Walk up to any car and press E — the cops will notice'],
    ['HANDBRAKE', 'SPACE while driving — slides, skid marks, sharp turns'],
    ['FIGHT', 'Mouse aims, CLICK shoots (with a gun) or punches, F punches too'],
    ['WANTED', 'Crimes raise your stars. Hide from the cops and stars drop one by one'],
    ['BUSTED', 'A cop that pins you on foot busts you — keep moving'],
    ['MISSIONS', 'Follow the yellow marker. Four jobs, each one pays'],
    ['SAVE', 'ESC opens the pause menu — save any time, Continue picks it up'],
    ['MUTE', 'M toggles sound'],
  ];
  ctx.font = '16px Arial';
  rows.forEach((r, i) => {
    const y = 120 + i * 40;
    ctx.fillStyle = '#ffd94a';
    ctx.textAlign = 'right';
    ctx.fillText(r[0], canvasW / 2 - 130, y);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(r[1], canvasW / 2 - 110, y);
  });
  const btn = drawButton(ctx, canvasW / 2 - 110, canvasH - 110, 220, 46, 'BACK', '#ffd94a', '#222');
  return [btn];
}

export function drawPauseMenu(ctx, canvasW, canvasH) {
  ctx.fillStyle = 'rgba(8,8,16,0.72)';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px Arial';
  ctx.fillText('PAUSED', canvasW / 2, canvasH * 0.28);
  const bw = 240;
  const bh = 46;
  const cx = canvasW / 2 - bw / 2;
  const buttons = [];
  let by = canvasH * 0.36;
  for (const [label, id] of [['RESUME', 'resume'], ['SAVE GAME', 'save'], ['RESTART', 'restart'], ['QUIT TO MENU', 'menu']]) {
    buttons.push(drawButton(ctx, cx, by, bw, bh, label, id === 'resume' ? '#ffd94a' : '#ffffff', '#222', id));
    by += 60;
  }
  return buttons;
}

export function drawEndScreen(ctx, canvasW, canvasH, kind) {
  ctx.fillStyle = kind === 'busted' ? 'rgba(20,20,80,0.82)' : 'rgba(80,10,10,0.82)';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px Arial';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', canvasW / 2, canvasH * 0.34);
  ctx.font = '18px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const line = kind === 'busted'
    ? 'The Palmira police caught up with you. $100 bail — and the crew is waiting.'
    : 'Dana went down in Palmira. The hospital patched her up — $100 off the top.';
  ctx.fillText(line, canvasW / 2, canvasH * 0.34 + 40);
  const bw = 240;
  const bh = 46;
  const cx = canvasW / 2 - bw / 2;
  const buttons = [];
  buttons.push(drawButton(ctx, cx, canvasH * 0.5, bw, bh, 'TRY AGAIN', '#ffd94a', '#222', 'retry'));
  buttons.push(drawButton(ctx, cx, canvasH * 0.5 + 60, bw, bh, 'QUIT TO MENU', '#ffffff', '#222', 'menu'));
  return buttons;
}

function drawButton(ctx, x, y, w, h, label, bg, fg, id) {
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = 'bold 19px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 7);
  return { id: id || label.toLowerCase().replace(/ /g, '-'), x, y, w, h };
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
