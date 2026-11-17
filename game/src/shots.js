// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, driven by a
// small autopilot (steer along the road, keep the throttle down), so the frame is
// what a short game really looks like and the same seed always gives the same
// frame. The renderer draws the same HUD a player sees.

import { CITY, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startMission } from './missions.js';

const START_SECONDS = 6;
const DRIVE_SECONDS = 7;
const CHASE_SECONDS = 9;
const MISSION_SECONDS = 6;

/** Steer a car along its road: aim at a point ahead on the same road line,
 * and turn onto the next crossing road (toward the city centre) before the
 * road runs out at the city edge — otherwise the car pins itself against
 * the boundary with nowhere to go. Turns are taken at part throttle so the
 * arc stays on the road, and a stuck car (a corner grazing a building while
 * the throttle is down) reverses out instead of sitting there: pure pursuit
 * can converge on a heading whose front corner stays one unit inside a
 * building, with the throttle re-adding the same small speed every step. */
function driveAutopilot(world) {
  const state = world.state;
  const player = state.player;
  const car = player.car;
  if (!car) return { move: { x: 0, y: 0 }, run: false, aim: player.angle, shoot: false, enter: false };
  // Per-world autopilot memory: last spot, how long it has been stuck, and
  // whether it is mid-escape. Lives on the world state so the same seed
  // always replays the same frames.
  let ap = state.autopilot;
  if (!ap) ap = state.autopilot = { lastX: car.x, lastY: car.y, stuckFor: 0, reversingUntil: 0, reverseSteer: 0, lastSteer: 0 };
  const moved = Math.hypot(car.x - ap.lastX, car.y - ap.lastY);
  ap.lastX = car.x;
  ap.lastY = car.y;
  if (state.time < ap.reversingUntil) {
    // Back out with the opposite lock: reversing flips the steering sense,
    // so the same steer value swings the nose the other way.
    return { move: { x: -ap.reverseSteer, y: 1 }, run: false, aim: car.angle, shoot: false, enter: false };
  }
  ap.reversingUntil = 0;
  // Barely moving under full throttle means wedged, not parked: a step
  // covers 0.35 units at ~21 units/s, far below any real crawl.
  if (moved < 0.35) ap.stuckFor += STEP;
  else ap.stuckFor = 0;
  if (ap.stuckFor > 0.75) {
    ap.stuckFor = 0;
    ap.reverseSteer = ap.lastSteer || 1;
    ap.reversingUntil = state.time + 0.8;
    return { move: { x: -ap.reverseSteer, y: 1 }, run: false, aim: car.angle, shoot: false, enter: false };
  }
  // Find the road the car is on: the nearer centreline wins. (A fixed band
  // around one line misfires near intersections — a car 66 units off the
  // vertical line but 1 off the horizontal one is on the horizontal road,
  // and steering it as if it were on the vertical one sends it diagonally
  // across the building corner.)
  const roadX = Math.round(car.x / CITY.roadGap) * CITY.roadGap;
  const roadY = Math.round(car.y / CITY.roadGap) * CITY.roadGap;
  const onVertical = Math.abs(car.x - roadX) < Math.abs(car.y - roadY);
  let tx;
  let ty;
  let turning = false;
  let turnPoint = null;
  if (onVertical) {
    // A vertical road runs along y, so the direction of travel is sin(angle).
    const dir = Math.sin(car.angle) > 0 ? 1 : -1;
    // Next horizontal crossing ahead: the first road line past the car in
    // its direction of travel (not the line nearest a lookahead point — that
    // jumps to the following crossing once the car is halfway there, and the
    // turn never happens). Turn onto it before running out of road: a
    // 90-degree turn at speed covers ~200 units, so a late trigger sails
    // straight past the crossing and strands the car at the city edge.
    const crossY = dir > 0
      ? (Math.floor(car.y / CITY.roadGap) + 1) * CITY.roadGap
      : Math.ceil(car.y / CITY.roadGap - 1) * CITY.roadGap;
    const distToCross = (crossY - car.y) * dir;
    if (distToCross > 0 && distToCross < 250 && crossY > 0 && crossY < CITY.beachY) {
      const cdir = CITY.width / 2 - car.x > 0 ? 1 : -1;
      tx = roadX + cdir * 260;
      ty = crossY;
      turning = true;
      turnPoint = { x: roadX, y: crossY };
    } else if (crossY <= 0 || crossY >= CITY.beachY) {
      // No crossing ahead (already past the last one, heading for the edge):
      // turn around at the nearest crossing instead of pinning the boundary.
      // Aim past it toward the centre, not at the point itself — aiming at a
      // point right under the nose makes the car orbit it in a spin.
      const backY = Math.round(car.y / CITY.roadGap) * CITY.roadGap;
      const cdir = CITY.width / 2 - car.x > 0 ? 1 : -1;
      tx = roadX + cdir * 260;
      ty = Math.max(CITY.roadGap, Math.min(CITY.beachY - CITY.roadGap, backY));
      turning = true;
      turnPoint = { x: roadX, y: ty };
    } else {
      tx = roadX;
      ty = car.y + dir * 260;
    }
  } else {
    // A horizontal road runs along x, so the direction of travel is cos(angle).
    const dir = Math.cos(car.angle) > 0 ? 1 : -1;
    // Next vertical crossing ahead: the first road line past the car in its
    // direction of travel (see the vertical branch).
    const crossX = dir > 0
      ? (Math.floor(car.x / CITY.roadGap) + 1) * CITY.roadGap
      : Math.ceil(car.x / CITY.roadGap - 1) * CITY.roadGap;
    const distToCross = (crossX - car.x) * dir;
    if (distToCross > 0 && distToCross < 250 && crossX > 0 && crossX < CITY.width) {
      const cdir = CITY.height / 2 - car.y > 0 ? 1 : -1;
      tx = crossX;
      ty = roadY + cdir * 260;
      turning = true;
      turnPoint = { x: crossX, y: roadY };
    } else if (crossX <= 0 || crossX >= CITY.width) {
      // No crossing ahead: turn around at the nearest crossing, aiming past
      // it toward the centre (see the vertical branch).
      const backX = Math.round(car.x / CITY.roadGap) * CITY.roadGap;
      const cdir = CITY.height / 2 - car.y > 0 ? 1 : -1;
      tx = Math.max(CITY.roadGap, Math.min(CITY.width - CITY.roadGap, backX));
      ty = roadY + cdir * 260;
      turning = true;
      turnPoint = { x: tx, y: roadY };
    } else {
      tx = car.x + dir * 260;
      ty = roadY;
    }
  }
  if (turning && turnPoint) {
    // Drive to the crossing itself first: aiming diagonally at a point 260
    // past it cuts the corner across the building at the road's edge and the
    // car's front corner grazes the wall. Only once close, aim down the new
    // road and make the turn there, where the intersection is open.
    const distToCross = Math.hypot(turnPoint.x - car.x, turnPoint.y - car.y);
    if (distToCross > 60) {
      tx = turnPoint.x;
      ty = turnPoint.y;
    }
  }
  const want = Math.atan2(ty - car.y, tx - car.x);
  let turn = want - car.angle;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, turn * 2));
  ap.lastSteer = steer;
  // Speed control: brake hard into a corner and take it slow. A 90-degree
  // turn's radius is speed / turnRate, and the intersection is only 104 wide
  // — above ~140 units/s the arc cuts the building on the inside of the
  // corner, however the target is aimed. At ~130 the whole arc fits inside
  // the crossing, and the car exits already lined up on the new road.
  let throttle;
  if (turning) {
    if (car.speed > 140) throttle = -1;
    else if (car.speed < 110) throttle = 0.45;
    else throttle = 0;
  } else {
    throttle = 1;
  }
  return { move: { x: steer, y: -throttle }, run: false, aim: car.angle, shoot: false, enter: false };
}

function idleCtrl() {
  return { move: { x: 0, y: 0 }, run: false, aim: 0, shoot: false, enter: false };
}

function putPlayerInCar(world, x, y) {
  const state = world.state;
  // Find the nearest traffic car to the spot and hand it to the player.
  let best = null;
  let bestDist = Infinity;
  for (const car of state.traffic) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  if (!best) return;
  state.player.x = best.x;
  state.player.y = best.y;
  world.enterCar(best);
  // A staged drive is not a crime scene: clear the theft heat.
  state.police.heat = 0;
  state.police.level = 0;
}

export function stageShot(name, world) {
  const state = world.state;
  if (name !== 'drive' && name !== 'chase' && name !== 'mission') {
    // Title: let the city live for a few seconds behind the menu.
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, idleCtrl());
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'drive') {
    putPlayerInCar(world, 450, 450);
    for (let i = 0; i < DRIVE_SECONDS / STEP; i += 1) world.step(STEP, driveAutopilot(world));
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'chase') {
    putPlayerInCar(world, 1350, 900);
    state.police.heat = 3.0;
    state.police.level = 3;
    state.missions.index = 1;
    startMission(state.missions);
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) world.step(STEP, driveAutopilot(world));
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // Mission: The Package, mid-delivery, wanted level 1, marker on the HUD.
  putPlayerInCar(world, 1350, 900);
  state.missions.index = 1;
  startMission(state.missions);
  state.missions.stage = 2;
  state.police.heat = 0.2;
  state.police.level = 0;
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) world.step(STEP, driveAutopilot(world));
  return { screen: SCREEN_PLAY, best: 0 };
}
