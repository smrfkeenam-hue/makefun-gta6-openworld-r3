// The live minimap: roads, districts, the player arrow, the mission
// marker, police and pickups, drawn in a corner of the HUD.
import { WORLD, PALETTE } from './config.js';
import { districtAt } from './city.js';
import { missionMarker, nextMissionStart, currentMission } from './missions.js';

export const MINIMAP_SIZE = 168;
export const MINIMAP_MARGIN = 14;

export function drawMinimap(ctx, W, canvasW, canvasH, time) {
  const size = MINIMAP_SIZE;
  const x0 = canvasW - size - MINIMAP_MARGIN;
  const y0 = canvasH - size - MINIMAP_MARGIN;
  const scale = size / WORLD;

  ctx.save();
  // Frame.
  ctx.fillStyle = 'rgba(8, 10, 16, 0.78)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();

  // Ground by district, sampled coarsely.
  const step = 220;
  for (let gx = 0; gx < WORLD; gx += step) {
    for (let gy = 0; gy < WORLD; gy += step) {
      ctx.fillStyle = districtColor(districtAt(gx + step / 2, gy + step / 2));
      ctx.fillRect(x0 + gx * scale, y0 + gy * scale, step * scale + 1, step * scale + 1);
    }
  }
  // Roads.
  ctx.fillStyle = '#3a3a42';
  for (const c of W.city.roadsV) ctx.fillRect(x0 + (c - 55) * scale, y0, 110 * scale, size);
  for (const c of W.city.roadsH) ctx.fillRect(x0, y0 + (c - 55) * scale, size, 110 * scale);
  // Beach sand strip.
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(x0 + (WORLD - 180) * scale, y0, 180 * scale, size);

  // Pickups.
  ctx.fillStyle = '#2ecc71';
  for (const pk of W.pickups) {
    if (pk.taken) continue;
    ctx.fillRect(x0 + pk.x * scale - 2, y0 + pk.y * scale - 2, 4, 4);
  }
  // Police.
  for (const cop of W.cops) {
    if (cop.dead || cop.leaving) continue;
    ctx.fillStyle = Math.floor(time * 5) % 2 === 0 ? '#ff2a2a' : '#2a6aff';
    ctx.beginPath();
    ctx.arc(x0 + cop.x * scale, y0 + cop.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Enemies.
  ctx.fillStyle = '#e74c3c';
  for (const e of W.enemies) {
    if (e.dead) continue;
    ctx.beginPath();
    ctx.arc(x0 + e.x * scale, y0 + e.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission marker (pulsing yellow diamond).
  const marker = W.missions.started ? missionMarker(W) : nextMissionStart(W);
  if (marker) {
    const pulse = 4 + Math.sin(time * 5) * 1.5;
    ctx.save();
    ctx.translate(x0 + marker.x * scale, y0 + marker.y * scale);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
    ctx.restore();
  }
  // Player arrow.
  const p = W.player;
  const px = p.onFoot || !p.car ? p.x : p.car.x;
  const py = p.onFoot || !p.car ? p.y : p.car.y;
  ctx.save();
  ctx.translate(x0 + px * scale, y0 + py * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
  // North indicator.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('N', x0 + size / 2, y0 - 8);
}

function districtColor(d) {
  if (d === 'beach') return '#d8c88a';
  if (d === 'downtown') return '#565660';
  if (d === 'suburb') return '#6f9e52';
  if (d === 'port') return '#6e6658';
  return '#5f8f47';
}
