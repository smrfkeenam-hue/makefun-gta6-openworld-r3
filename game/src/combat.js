// Combat: bullets, punches, rival gunmen and pickups. Bullets fly fast and
// straight; rivals in missions move toward the player and shoot back.
import { BULLET_SPEED, BULLET_DAMAGE, ENEMY_HP, PUNCH_RANGE, PUNCH_DAMAGE, PLAYER_HP } from './config.js';
import { insideBuilding } from './city.js';
import { scarePeds } from './pedestrians.js';
import { sfxShot } from './audio.js';
import { addWanted } from './police.js';

export function fireBullet(W, x, y, angle, from) {
  W.bullets.push({
    x: x + Math.cos(angle) * 18,
    y: y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: 1.2,
    from,
  });
  // Muzzle flash.
  W.particles.push({
    x: x + Math.cos(angle) * 22, y: y + Math.sin(angle) * 22,
    vx: 0, vy: 0, life: 0.07, max: 0.07, size: 9, color: '#ffe066',
  });
  if (from === 'player') {
    sfxShot();
    addWanted(W, 1, 'shooting');
    scarePeds(W, x, y, 320);
  }
}

// A punch hits the nearest enemy or pedestrian in front of the player.
export function punchHit(W, x, y, angle) {
  let best = null;
  let bestD = PUNCH_RANGE + 14;
  const targets = [];
  for (const e of W.enemies) if (!e.dead) targets.push(e);
  for (const p of W.peds) if (!p.dead) targets.push(p);
  for (const t of targets) {
    const dx = t.x - x;
    const dy = t.y - y;
    const d = Math.hypot(dx, dy);
    const facing = (dx * Math.cos(angle) + dy * Math.sin(angle)) / (d || 1);
    if (d < bestD && facing > 0.5) { best = t; bestD = d; }
  }
  if (!best) return;
  best.hp -= PUNCH_DAMAGE;
  if (best.hp <= 0) {
    best.dead = true;
    best.deadTimer = 0;
  }
  W.particles.push({
    x: best.x, y: best.y, vx: 0, vy: -20, life: 0.3, max: 0.3, size: 6, color: '#ffffff',
  });
}

export function spawnEnemy(W, x, y) {
  W.enemies.push({
    x, y, angle: 0, hp: ENEMY_HP, shootCd: 0.5 + Math.random(),
    speed: 150, dead: false, deadTimer: 0,
  });
}

export function updateCombat(W, dt) {
  // Bullets.
  for (let i = W.bullets.length - 1; i >= 0; i--) {
    const b = W.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let hit = b.life <= 0;
    if (!hit && insideBuilding(W.city, b.x, b.y, 0)) {
      hit = true;
      W.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: 4, color: '#ffd94a' });
    }
    if (!hit && b.from === 'player') {
      for (const e of W.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < 16) {
          e.hp -= BULLET_DAMAGE;
          hit = true;
          if (e.hp <= 0) { e.dead = true; e.deadTimer = 0; }
          break;
        }
      }
      if (!hit) {
        for (const p of W.peds) {
          if (p.dead) continue;
          if (Math.hypot(p.x - b.x, p.y - b.y) < 12) {
            p.dead = true;
            p.deadTimer = 0;
            addWanted(W, 1, 'hit-ped');
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        for (const car of W.cars) {
          if (car.dead || car === W.player.car) continue;
          if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
            car.damage = Math.min(1, car.damage + 0.08);
            hit = true;
            break;
          }
        }
      }
    }
    if (!hit && b.from === 'enemy') {
      const p = W.player;
      if (!p.dead && p.onFoot && Math.hypot(p.x - b.x, p.y - b.y) < 14) {
        p.hp -= 12;
        hit = true;
        W.camera.shake = Math.min(8, W.camera.shake + 3);
      } else if (!p.dead && !p.onFoot && p.car && Math.hypot(p.car.x - b.x, p.car.y - b.y) < 26) {
        p.car.damage = Math.min(1, p.car.damage + 0.05);
        hit = true;
      }
    }
    if (hit) W.bullets.splice(i, 1);
  }

  // Enemies: advance on the player, shoot when in range.
  const pp = W.player;
  const px = pp.onFoot || !pp.car ? pp.x : pp.car.x;
  const py = pp.onFoot || !pp.car ? pp.y : pp.car.y;
  for (const e of W.enemies) {
    if (e.dead) { e.deadTimer += dt; continue; }
    const dx = px - e.x;
    const dy = py - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);
    e.shootCd -= dt;
    if (d > 260) {
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;
    } else if (e.shootCd <= 0 && d < 480) {
      fireBullet(W, e.x, e.y, e.angle + (Math.random() - 0.5) * 0.15, 'enemy');
      e.shootCd = 0.9 + Math.random() * 0.7;
    }
  }
  // Clear long-dead enemies.
  for (let i = W.enemies.length - 1; i >= 0; i--) {
    if (W.enemies[i].dead && W.enemies[i].deadTimer > 6) W.enemies.splice(i, 1);
  }
}

export function drawEnemies(ctx, W) {
  for (const e of W.enemies) {
    if (e.dead) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(2, 3, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8e2f2f';
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(3, 4, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(e.angle);
    ctx.fillStyle = '#8e2f2f'; // rivals wear red
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(2, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222222';
    ctx.fillRect(6, -2, 12, 4);
    ctx.restore();
    // Health bar above the rival.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 14, e.y - 24, 28, 5);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(e.x - 13, e.y - 23, 26 * Math.max(0, e.hp / ENEMY_HP), 3);
  }
}

export function drawBullets(ctx, W) {
  ctx.fillStyle = '#ffe066';
  for (const b of W.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawPickups(ctx, W, time) {
  for (const pk of W.pickups) {
    if (pk.taken) continue;
    const pulse = 1 + Math.sin(time * 4 + pk.x) * 0.12;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.scale(pulse, pulse);
    if (pk.kind === 'gun') {
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(-9, -3, 18, 6);
      ctx.fillRect(-3, 2, 5, 7);
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('GUN', 0, -12);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    } else if (pk.kind === 'cash') {
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(-10, -6, 20, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    }
    ctx.restore();
  }
}
