// Cars: the player's driveable car and the traffic that fills the roads. A car is a
// rectangle with a heading, a forward speed and a colour; the player steers with a
// simple arcade model (accelerate, brake, drift a little), traffic follows the road
// grid and turns at intersections, and both collide with buildings and each other.

import { CAR, CITY, TRAFFIC } from './config.js';
import { pick, range } from './random.js';

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8b23a', '#7bc96f', '#c9c9c9', '#8a5fc0', '#e07b39', '#4fb3a9'];

function collideBuildings(city, x, y, halfLen, halfWid, angle) {
  // Check the four corners of the rotated rectangle against buildings and water.
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [
    [halfLen, halfWid], [halfLen, -halfWid], [-halfLen, halfWid], [-halfLen, -halfWid],
  ];
  for (let i = 0; i < corners.length; i += 1) {
    const cx = x + corners[i][0] * cos - corners[i][1] * sin;
    const cy = y + corners[i][0] * sin + corners[i][1] * cos;
    if (city.isWater(cx, cy) || city.buildingAt(cx, cy)) return true;
    if (cx < 20 || cy < 20 || cx > CITY.width - 20 || cy > CITY.height - 20) return true;
  }
  return false;
}

/**
 * Nudge a car whose corner is already inside a building back out along the
 * shortest exit. A car can end up overlapping by a hair — steering swings a
 * corner into a wall while the car creeps, or another car shoves it — and a
 * plain rollback then leaves it wedged: every step out collides again before
 * any speed can build, forward or reverse. The nudge is the penetration
 * depth plus a hair, so it only ever un-wedges.
 */
function pushOutOfBuildings(city, car) {
  for (let iter = 0; iter < 4; iter += 1) {
    const cos = Math.cos(car.angle);
    const sin = Math.sin(car.angle);
    const corners = [
      [CAR.length / 2, CAR.width / 2], [CAR.length / 2, -CAR.width / 2],
      [-CAR.length / 2, CAR.width / 2], [-CAR.length / 2, -CAR.width / 2],
    ];
    let pushed = false;
    for (let i = 0; i < corners.length; i += 1) {
      const cx = car.x + corners[i][0] * cos - corners[i][1] * sin;
      const cy = car.y + corners[i][0] * sin + corners[i][1] * cos;
      const b = city.buildingAt(cx, cy);
      if (!b) continue;
      const dl = cx - b.x;
      const dr = b.x + b.w - cx;
      const dt = cy - b.y;
      const db = b.y + b.h - cy;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) car.x -= dl + 0.5;
      else if (m === dr) car.x += dr + 0.5;
      else if (m === dt) car.y -= dt + 0.5;
      else car.y += db + 0.5;
      pushed = true;
      break; // re-check corners from the new spot
    }
    if (!pushed) return;
  }
}

export function createCar(x, y, angle, color, kind) {
  return {
    kind: kind || 'traffic',
    x, y, angle,
    speed: 0,
    color,
    health: CAR.health,
    dead: false,
    // Traffic only: which way it drives along its road and when it last turned.
    vertical: false,
    dir: 1,
    turnCooldown: 0,
    brakeLight: false,
    sirenPhase: 0,
  };
}

export function randomCarColor(random) {
  return pick(random, CAR_COLORS);
}

/**
 * Drive one car one step. `drive` is {throttle: -1..1, steer: -1..1} for the player;
 * traffic passes null and follows its road instead. Returns true when it hit a wall.
 */
export function stepCar(car, dt, drive, city) {
  if (car.dead) return false;
  const prevX = car.x;
  const prevY = car.y;

  if (drive) {
    if (drive.throttle > 0) car.speed += CAR.accel * drive.throttle * dt;
    else if (drive.throttle < 0) {
      if (car.speed > 5) car.speed -= CAR.brake * dt;
      else car.speed += CAR.reverseAccel * drive.throttle * dt;
    }
    car.speed -= car.speed * CAR.drag * dt;
    if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
    if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
    const steerAmount = drive.steer * CAR.turnRate * dt * Math.min(1, Math.abs(car.speed) / 160 + 0.25);
    car.angle += steerAmount * (car.speed >= 0 ? 1 : -1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.brakeLight = drive.throttle < 0 && car.speed > 5;
  } else {
    // Traffic: cruise along its road, slow near intersections, turn sometimes.
    const target = car.cruiseSpeed || TRAFFIC.cruiseSpeed;
    car.speed += (target - car.speed) * Math.min(1, 1.2 * dt);
    car.turnCooldown -= dt;
    const ahead = car.vertical
      ? { x: car.x, y: car.y + car.dir * 60 }
      : { x: car.x + car.dir * 60, y: car.y };
    const nearCrossing = car.vertical
      ? Math.abs((ahead.y % CITY.roadGap) - CITY.roadGap / 2) > CITY.roadGap / 2 - 90
      : Math.abs((ahead.x % CITY.roadGap) - CITY.roadGap / 2) > CITY.roadGap / 2 - 90;
    if (nearCrossing && car.turnCooldown <= 0 && car.randomTurn && car.randomTurn()) {
      // Turn onto the crossing road.
      const wasVertical = car.vertical;
      car.vertical = !wasVertical;
      car.dir = car.randomDir ? car.randomDir() : 1;
      car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      car.turnCooldown = 2.5;
      // Snap onto the centre of the new road.
      if (car.vertical) car.x = Math.round(car.x / CITY.roadGap) * CITY.roadGap;
      else car.y = Math.round(car.y / CITY.roadGap) * CITY.roadGap;
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the far edge so traffic never runs out.
    if (car.x < -80) car.x = CITY.width + 60;
    if (car.x > CITY.width + 80) car.x = -60;
    if (car.y < -80) car.y = CITY.beachY - 60;
    if (car.y > CITY.beachY + 80) car.y = -60;
  }

  if (collideBuildings(city, car.x, car.y, CAR.length / 2, CAR.width / 2, car.angle)) {
    // Roll the position back but keep the new heading: reverting the angle too
    // meant a car nosed into a wall corner could never steer away — every
    // step's steering was undone, so it froze in place instead of turning
    // along the wall. With the heading kept, throttle + steering slides the
    // car free, and reversing out works the same way.
    car.x = prevX;
    car.y = prevY;
    // A hard hit bounces; a gentle nose into a wall just stops. Bouncing a
    // slow graze to a small negative speed would flip the steering sense
    // (reverse) and pin the car against the wall, since the throttle keeps
    // re-adding the same small speed every step.
    car.speed = Math.abs(car.speed) > 60 ? car.speed * -0.25 : 0;
    // If the rolled-back spot still overlaps a building, the car is wedged
    // and no step out can ever succeed from there — nudge it clear first.
    if (collideBuildings(city, car.x, car.y, CAR.length / 2, CAR.width / 2, car.angle)) {
      pushOutOfBuildings(city, car);
    }
    return true;
  }
  return false;
}

/** Circle-vs-car overlap, used for bumping and for entering a car on foot. */
export function carOverlapsPoint(car, x, y, radius) {
  const dx = x - car.x;
  const dy = y - car.y;
  const cos = Math.cos(-car.angle);
  const sin = Math.sin(-car.angle);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) < CAR.length / 2 + radius && Math.abs(ly) < CAR.width / 2 + radius;
}

export function carsOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < (CAR.length * 0.9) * (CAR.length * 0.9);
}

/** Push two overlapping cars apart and trade a little speed, like a fender-bender. */
export function separateCars(a, b) {
  if (!carsOverlap(a, b)) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const push = (CAR.length * 0.85 - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const tmp = a.speed;
  a.speed = b.speed * 0.6;
  b.speed = tmp * 0.6;
}
