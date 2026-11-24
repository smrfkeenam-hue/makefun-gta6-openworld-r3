// One simulation step: advance the clock, the player, traffic, peds,
// police, missions and combat, then the camera and the particles.
// Both the live game loop and the screenshot autopilot call this.
import { updatePlayer, nearestStealableCar } from './player.js';
import { updateTraffic } from './traffic.js';
import { updatePedestrians } from './pedestrians.js';
import { updatePolice } from './police.js';
import { updateMissions } from './missions.js';
import { updateCombat } from './combat.js';
import { updateCamera } from './render.js';

export function stepWorld(W, dt, canvasW, canvasH) {
  W.time += dt;
  W.clock += dt * 0.5; // one game minute every two real seconds
  if (W.toastTimer > 0) W.toastTimer -= dt;

  // Mouse position in world coordinates (for aiming).
  const cam = W.camera;
  W.mouseWorld.x = W.input.mouseX + cam.x - canvasW / 2;
  W.mouseWorld.y = W.input.mouseY + cam.y - canvasH / 2;

  updatePlayer(W, dt);
  updateTraffic(W, dt);
  updatePedestrians(W, dt);
  updatePolice(W, dt);
  updateMissions(W, dt);
  updateCombat(W, dt);

  // The [E] prompt: a stealable car within reach on foot.
  W.nearCar = W.player.onFoot ? !!nearestStealableCar(W, 60) : false;

  // Particles.
  for (let i = W.particles.length - 1; i >= 0; i--) {
    const pt = W.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.life <= 0) W.particles.splice(i, 1);
  }
  // Skid marks fade.
  for (let i = W.skids.length - 1; i >= 0; i--) {
    W.skids[i].life -= dt;
    if (W.skids[i].life <= 0) W.skids.splice(i, 1);
  }

  updateCamera(W, dt, canvasW, canvasH);
}
