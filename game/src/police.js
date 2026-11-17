// The Solmar police: the wanted system and the cars and officers who answer it.
// Heat rises with each crime and cools when the player behaves; the star level
// sets how many police cars chase and how many officers run the player down on
// foot. Police cars ram; officers punch. Get busted or wasted and the run resets
// at the hospital, poorer and clean.

import { CITY, COP, HEAT, WANTED } from './config.js';
import { createCar } from './vehicles.js';

export function wantedLevel(heat) {
  if (heat < 0.5) return 0;
  if (heat < 1.5) return 1;
  if (heat < 2.5) return 2;
  if (heat < 3.5) return 3;
  if (heat < 4.5) return 4;
  return 5;
}

export function createPolice() {
  return {
    heat: 0,
    level: 0,
    cars: [],
    cops: [],
    bustTimer: 0,
    siren: 0,
  };
}

function spawnPoliceCar(police, random, city, target) {
  const spot = city.randomRoadPoint(random, 200);
  const car = createCar(spot.x, spot.y, spot.vertical ? Math.PI / 2 : 0, '#1d4fa8', 'police');
  car.vertical = spot.vertical;
  car.dir = 1;
  car.cruiseSpeed = 0;
  // Start it off-screen-ish, away from the player, so it arrives with sirens.
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 500) {
    car.x = target.x + (dx / (dist || 1)) * -600;
    car.y = target.y + (dy / (dist || 1)) * -600;
    const road = city.nearestRoadPoint(car.x, car.y);
    car.x = road.x;
    car.y = road.y;
    car.vertical = road.vertical;
  }
  police.cars.push(car);
  return car;
}

function spawnCop(police, random, target) {
  const angle = random() * Math.PI * 2;
  police.cops.push({
    x: target.x + Math.cos(angle) * 320,
    y: target.y + Math.sin(angle) * 320,
    angle,
    punchTimer: 0,
    radius: COP.radius,
  });
}

/** Keep the number of police cars and cops at the level's quota, spawning as needed. */
export function maintainPolice(police, random, city, target) {
  const quota = WANTED[police.level];
  while (police.cars.length < quota.cars) spawnPoliceCar(police, random, city, target);
  while (police.cops.length < quota.cops) spawnCop(police, random, target);
  if (police.cars.length > quota.cars) police.cars.length = quota.cars;
  if (police.cops.length > quota.cops) police.cops.length = quota.cops;
}

/**
 * One step of the chase. Police cars steer toward the player and ram; when the
 * player is on foot and slow, officers close in and punch. Returns 'busted' when
 * an officer holds the player still long enough, else null.
 */
export function stepPolice(police, dt, random, city, player, playerCar) {
  police.siren += dt;
  const target = playerCar || player;
  const quota = WANTED[police.level];

  for (let i = 0; i < police.cars.length; i += 1) {
    const car = police.cars[i];
    car.sirenPhase += dt * 6;
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const want = Math.atan2(dy, dx);
    let turn = want - car.angle;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, turn * 1.6));
    const speed = quota.speed;
    car.speed += (speed - car.speed) * Math.min(1, 1.5 * dt);
    car.angle += steer * 2.4 * dt * Math.min(1, Math.abs(car.speed) / 200 + 0.3);
    const prevX = car.x;
    const prevY = car.y;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Police drive through the city like everyone else: buildings still stop them.
    const hit = city.buildingAt(car.x, car.y) || city.isWater(car.x, car.y);
    if (hit) {
      car.x = prevX;
      car.y = prevY;
      car.speed *= 0.3;
      car.angle += 0.6;
    }
  }

  let busted = null;
  for (let i = 0; i < police.cops.length; i += 1) {
    const cop = police.cops[i];
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    if (cop.punchTimer > 0) cop.punchTimer -= dt;
    if (dist < 26 && !playerCar) {
      // An officer on top of the player holds them: a few seconds and it's over.
      police.bustTimer += dt;
      if (police.bustTimer > 2.2) busted = 'busted';
      if (cop.punchTimer <= 0) {
        cop.punchTimer = COP.punchCooldown;
        player.health -= COP.punchDamage;
      }
    } else {
      const moved = city.moveCircle(cop.x, cop.y, (dx / dist) * COP.speed * dt, (dy / dist) * COP.speed * dt, COP.radius);
      cop.x = moved.x;
      cop.y = moved.y;
    }
  }
  if (police.cops.length === 0) police.bustTimer = 0;
  return busted;
}

/** Add heat for a crime and refresh the star level. */
export function addHeat(police, kind) {
  police.heat = Math.min(5.4, police.heat + (HEAT[kind] || 0.4));
  police.level = wantedLevel(police.heat);
}

/** Clear the heat entirely (after a bust, a waste, or a mission escape). */
export function clearHeat(police) {
  police.heat = 0;
  police.level = 0;
  police.bustTimer = 0;
  police.cars.length = 0;
  police.cops.length = 0;
}
