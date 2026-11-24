// The HUD: wanted stars, cash, clock, health, speed, the mission objective,
// toasts, banners and the controls hint — everything the player reads while
// playing, drawn on the canvas above the world.
import { PALETTE, PLAYER_HP } from './config.js';
import { drawMinimap, MINIMAP_SIZE, MINIMAP_MARGIN } from './minimap.js';
import { currentMission, currentStep, missionCount } from './missions.js';
import { playerSpeed } from './player.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

export function drawHUD(ctx, W, canvasW, canvasH, time) {
  const p = W.player;

  // Top-right: wanted stars, cash, clock.
  const stars = '★'.repeat(W.wanted) + '☆'.repeat(5 - W.wanted);
  ctx.font = 'bold 26px Arial';
  const starsW = ctx.measureText('★★★★★').width;
  panel(ctx, canvasW - starsW - 40, 12, starsW + 28, 92);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.starOff;
  ctx.fillText('☆☆☆☆☆', canvasW - starsW - 26, 40);
  ctx.fillStyle = PALETTE.starOn;
  ctx.fillText('★'.repeat(W.wanted), canvasW - starsW - 26, 40);
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#7dff8a';
  ctx.fillText('$' + W.cash.toLocaleString('en-US'), canvasW - starsW - 26, 68);
  ctx.font = '16px Arial';
  ctx.fillStyle = '#ffffff';
  const mins = Math.floor(W.clock) % (24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  ctx.fillText(hh + ':' + mm + '  PALMIRA', canvasW - starsW - 26, 92);

  // Hidden indicator.
  if (W.hidden && W.wanted > 0) {
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#7dff8a';
    ctx.textAlign = 'right';
    ctx.fillText('HIDDEN — STAY OUT OF SIGHT', canvasW - 16, 128);
  }

  // Top-centre: mission objective.
  const mission = currentMission(W);
  const step = currentStep(W);
  if (mission && W.missions.started && step) {
    ctx.font = 'bold 15px Arial';
    const text = mission.title + ' — ' + step.text;
    const tw = ctx.measureText(text).width;
    panel(ctx, canvasW / 2 - tw / 2 - 14, 12, tw + 28, 34);
    ctx.fillStyle = '#ffd94a';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvasW / 2, 34);
  } else if (mission && !W.missions.started) {
    const text = 'NEW MISSION: ' + mission.title + ' — head for the yellow marker';
    ctx.font = 'bold 15px Arial';
    const tw = ctx.measureText(text).width;
    panel(ctx, canvasW / 2 - tw / 2 - 14, 12, tw + 28, 34);
    ctx.fillStyle = '#ffd94a';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvasW / 2, 34);
  } else if (!mission) {
    ctx.font = 'bold 15px Arial';
    const text = 'ALL MISSIONS COMPLETE — PALMIRA IS YOURS';
    const tw = ctx.measureText(text).width;
    panel(ctx, canvasW / 2 - tw / 2 - 14, 12, tw + 28, 34);
    ctx.fillStyle = '#7dff8a';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvasW / 2, 34);
  }

  // Mission intro card.
  if (W.missions.introTimer > 0 && mission) {
    ctx.font = '16px Arial';
    const lines = wrapText(ctx, mission.intro, 520);
    const h = 30 + lines.length * 22;
    panel(ctx, canvasW / 2 - 290, 60, 580, h);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 17px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(mission.giver.toUpperCase() + ' — ' + mission.title, canvasW / 2, 84);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    lines.forEach((line, i) => ctx.fillText(line, canvasW / 2, 110 + i * 22));
  }

  // Centre banner (mission complete / mission title).
  if (W.missions.bannerTimer > 0 && W.missions.banner) {
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const bw = ctx.measureText(W.missions.banner).width + 40;
    ctx.fillRect(canvasW / 2 - bw / 2, canvasH * 0.3 - 34, bw, 52);
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(W.missions.banner, canvasW / 2, canvasH * 0.3);
  }

  // Toast line.
  if (W.toastTimer > 0 && W.toast) {
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(W.toast, canvasW / 2, canvasH - 24);
  }

  // Bottom-left: health bar, ammo, missions done.
  panel(ctx, 14, canvasH - 76, 220, 62);
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HEALTH', 26, canvasH - 56);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(90, canvasH - 67, 120, 12);
  ctx.fillStyle = p.hp > 40 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(90, canvasH - 67, 120 * Math.max(0, p.hp / PLAYER_HP), 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px Arial';
  ctx.fillText((p.armed ? 'PISTOL  ' + p.ammo + ' RDS' : 'UNARMED — FIND A GUN') + '   ·   MISSIONS ' + W.missions.done + '/' + missionCount(), 26, canvasH - 30);

  // Speed when driving.
  if (!p.onFoot && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.28);
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(kmh + '', canvasW - MINIMAP_SIZE - MINIMAP_MARGIN - 24, canvasH - 40);
    ctx.font = '13px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('KM/H', canvasW - MINIMAP_SIZE - MINIMAP_MARGIN - 24, canvasH - 22);
    // Damage bar.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(canvasW - MINIMAP_SIZE - MINIMAP_MARGIN - 144, canvasH - 66, 120, 8);
    ctx.fillStyle = p.car.damage > 0.7 ? '#e74c3c' : '#f39c12';
    ctx.fillRect(canvasW - MINIMAP_SIZE - MINIMAP_MARGIN - 144, canvasH - 66, 120 * (1 - p.car.damage), 8);
    ctx.font = '11px Arial';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'left';
    ctx.fillText('CAR', canvasW - MINIMAP_SIZE - MINIMAP_MARGIN - 144, canvasH - 72);
  }

  // Controls hint, fading out after the first half-minute.
  if (W.time < 30) {
    ctx.globalAlpha = W.time < 25 ? 0.9 : 0.9 * (30 - W.time) / 5;
    ctx.font = '13px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    const hint = p.onFoot
      ? 'WASD move · SHIFT run · E enter car · CLICK shoot / F punch · ESC pause · M mute'
      : 'W/S drive · A/D steer · SPACE handbrake · E step out · ESC pause · M mute';
    ctx.fillText(hint, 16, canvasH - 88);
    ctx.globalAlpha = 1;
  }

  // "Press E" prompt near a stealable car.
  if (p.onFoot && W.nearCar) {
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('[E] STEAL CAR', canvasW / 2, canvasH * 0.62);
  }

  // Bust progress.
  if (W.bustTimer > 0) {
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a5a';
    ctx.fillText('THE COPS ARE GRABBING YOU — RUN!', canvasW / 2, canvasH * 0.2);
  }

  drawMinimap(ctx, W, canvasW, canvasH, time);
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
