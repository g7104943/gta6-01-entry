// Combat: the player's pistol, the bullets it fires, and the rival gang members
// who shoot back. Bullets fly straight, die on walls and water, and hurt whatever
// they touch first: pedestrians, cops, gang members, cars. Enemies stand their
// ground and fire in bursts when the player is close.

import { PLAYER } from './config.js';

export function createCombat() {
  return {
    bullets: [],
    enemies: [],
    shootTimer: 0,
    muzzle: 0,
  };
}

export function spawnEnemy(combat, x, y, health) {
  const enemy = {
    x, y,
    angle: 0,
    health: health || 60,
    shootTimer: 0.6 + Math.random() * 0.8,
    burst: 0,
    dead: false,
    hitFlash: 0,
  };
  combat.enemies.push(enemy);
  return enemy;
}

/** Fire one bullet from (x, y) along `angle`, if the cooldown allows. */
export function tryShoot(combat, x, y, angle) {
  if (combat.shootTimer > 0) return false;
  combat.shootTimer = PLAYER.shootCooldown;
  combat.muzzle = 0.07;
  combat.bullets.push({
    x: x + Math.cos(angle) * 18,
    y: y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    travelled: 0,
    fromPlayer: true,
  });
  return true;
}

/** An enemy fires one bullet at the player. */
function enemyShoot(combat, enemy, player) {
  const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  combat.bullets.push({
    x: enemy.x + Math.cos(angle) * 18,
    y: enemy.y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * 780,
    vy: Math.sin(angle) * 780,
    travelled: 0,
    fromPlayer: false,
  });
}

function hitCircle(bullet, x, y, radius) {
  const dx = bullet.x - x;
  const dy = bullet.y - y;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * One step: move bullets, resolve hits, run enemy AI. `hit` is called with
 * {kind, target} for each hit so the world can score it (a cop, a pedestrian,
 * an enemy, a car, or the player). Returns 'playerDead' when the player is hit
 * to zero, else null.
 */
export function stepCombat(combat, dt, city, player, playerCar, peds, police, cars, onHit) {
  if (combat.shootTimer > 0) combat.shootTimer -= dt;
  if (combat.muzzle > 0) combat.muzzle -= dt;

  for (let i = 0; i < combat.enemies.length; i += 1) {
    const enemy = combat.enemies[i];
    if (enemy.dead) continue;
    if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.angle = Math.atan2(dy, dx);
    if (enemy.shootTimer > 0) enemy.shootTimer -= dt;
    if (dist < 520 && enemy.shootTimer <= 0) {
      if (enemy.burst <= 0) {
        enemy.burst = 3;
        enemy.shootTimer = 0.9;
      } else {
        enemy.burst -= 1;
        enemyShoot(combat, enemy, player);
        enemy.shootTimer = 0.22;
      }
    }
  }

  let result = null;
  const bullets = combat.bullets;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += Math.hypot(b.vx, b.vy) * dt;
    let dead = b.travelled > PLAYER.bulletRange;
    if (!dead && (city.isWater(b.x, b.y) || city.buildingAt(b.x, b.y))) dead = true;
    if (!dead && b.fromPlayer) {
      for (let j = 0; j < combat.enemies.length; j += 1) {
        const enemy = combat.enemies[j];
        if (!enemy.dead && hitCircle(b, enemy.x, enemy.y, 14)) {
          enemy.health -= PLAYER.bulletDamage;
          enemy.hitFlash = 0.12;
          if (enemy.health <= 0) enemy.dead = true;
          onHit({ kind: 'enemy', target: enemy });
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (let j = 0; j < police.cops.length; j += 1) {
          const cop = police.cops[j];
          if (hitCircle(b, cop.x, cop.y, 13)) {
            onHit({ kind: 'cop', target: cop });
            police.cops.splice(j, 1);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (let j = 0; j < peds.length; j += 1) {
          const ped = peds[j];
          if (!ped.dead && hitCircle(b, ped.x, ped.y, 12)) {
            ped.dead = true;
            onHit({ kind: 'ped', target: ped });
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (let j = 0; j < cars.length; j += 1) {
          const car = cars[j];
          if (car.dead) continue;
          const cdx = b.x - car.x;
          const cdy = b.y - car.y;
          if (cdx * cdx + cdy * cdy < 34 * 34) {
            car.health -= PLAYER.bulletDamage;
            if (car.health <= 0) car.dead = true;
            onHit({ kind: 'car', target: car });
            dead = true;
            break;
          }
        }
      }
    } else if (!dead && !b.fromPlayer) {
      if (playerCar) {
        const cdx = b.x - playerCar.x;
        const cdy = b.y - playerCar.y;
        if (cdx * cdx + cdy * cdy < 36 * 36) {
          playerCar.health -= 8;
          onHit({ kind: 'playerCar', target: playerCar });
          dead = true;
        }
      } else if (hitCircle(b, player.x, player.y, PLAYER.radius)) {
        player.health -= 14;
        onHit({ kind: 'player', target: player });
        if (player.health <= 0) result = 'playerDead';
        dead = true;
      }
    }
    if (dead) bullets.splice(i, 1);
  }
  return result;
}
