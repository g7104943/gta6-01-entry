// Pedestrians: the people of Solmar, walking the sidewalks, crossing at corners,
// running away when shots are fired or a car bears down on them. Each one has a
// colour, a pace and a little patience; hit one and the city notices.

import { PEDS } from './config.js';
import { pick, range } from './random.js';

const SHIRTS = ['#e8483f', '#3f8fe8', '#e8b23a', '#7bc96f', '#c96fd9', '#e07b39', '#4fb3a9', '#f2f2f2'];
const SKINS = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];
const PANTS = ['#2c3e50', '#4a4a4a', '#5d4037', '#37474f'];

export function createPedestrian(random, city) {
  const spot = city.randomSidewalkPoint(random);
  return {
    x: spot.x,
    y: spot.y,
    angle: random() * Math.PI * 2,
    speed: PEDS.speed * (0.8 + random() * 0.5),
    shirt: pick(random, SHIRTS),
    skin: pick(random, SKINS),
    pants: pick(random, PANTS),
    // Walking target: a sidewalk point it strolls toward, then a new one.
    tx: spot.x,
    ty: spot.y,
    wait: 0,
    flee: 0,
    dead: false,
    hitFlash: 0,
  };
}

/** Steer a pedestrian toward its target; pick a new target when it arrives. */
function pickTarget(ped, random, city) {
  const spot = city.randomSidewalkPoint(random);
  ped.tx = spot.x;
  ped.ty = spot.y;
}

export function stepPedestrian(ped, dt, random, city, danger) {
  if (ped.dead) return;
  if (ped.hitFlash > 0) ped.hitFlash -= dt;
  if (ped.wait > 0) {
    ped.wait -= dt;
    return;
  }
  let speed = ped.speed;
  let tx = ped.tx;
  let ty = ped.ty;
  if (danger) {
    // Run away from the danger point.
    const dx = ped.x - danger.x;
    const dy = ped.y - danger.y;
    const dist = Math.hypot(dx, dy) || 1;
    tx = ped.x + (dx / dist) * 300;
    ty = ped.y + (dy / dist) * 300;
    speed = PEDS.fleeSpeed;
    ped.flee = 0.8;
  } else if (ped.flee > 0) {
    ped.flee -= dt;
  }
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) {
    if (danger) {
      pickTarget(ped, random, city);
    } else if (random() < 0.12) {
      ped.wait = range(random, 1, 4);
    } else {
      pickTarget(ped, random, city);
    }
    return;
  }
  const want = Math.atan2(dy, dx);
  let turn = want - ped.angle;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  ped.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, turn));
  const moved = city.moveCircle(ped.x, ped.y, Math.cos(ped.angle) * speed * dt, Math.sin(ped.angle) * speed * dt, 11);
  ped.x = moved.x;
  ped.y = moved.y;
}
