// The world: everything the game is, in one state object, advanced one fixed
// step at a time. The player on foot or in a car, traffic, pedestrians, police,
// combat, missions, particles and the camera. No drawing and no browser in it:
// the renderer paints this state, the loop feeds it input.

import { CAR, CITY, FIELD, HEAT, HEAT_DECAY, PLAYER, STEP, TRAFFIC, PEDS } from './config.js';
import { createCity } from './city.js';
import { createRandom, range } from './random.js';
import { createCar, stepCar, carOverlapsPoint, carsOverlap, separateCars, randomCarColor } from './vehicles.js';
import { createPedestrian, stepPedestrian } from './pedestrians.js';
import { createPolice, wantedLevel, addHeat, clearHeat, maintainPolice, stepPolice } from './police.js';
import { createCombat, tryShoot, stepCombat, spawnEnemy } from './combat.js';
import { createMissions, currentMission, currentStage, startMission, advanceStage, completeMission, stageText } from './missions.js';

export const EVENT_NONE = 0;
export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_MISSION_DONE = 4;
export const EVENT_MISSION_FAIL = 8;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = createCity(random);
  const police = createPolice();
  const combat = createCombat();
  const missions = createMissions();

  const player = {
    x: city.landmarks.garage.x + 60,
    y: city.landmarks.garage.y + 60,
    angle: 0,
    aim: 0,
    health: PLAYER.health,
    money: 250,
    car: null,
    onFoot: true,
    invulnerable: 0,
  };

  const traffic = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const spot = city.randomRoadPoint(random, 240);
    if (dist(spot.x, spot.y, player.x, player.y) < 420) continue;
    const car = createCar(spot.x, spot.y, spot.vertical ? Math.PI / 2 : 0, randomCarColor(random), 'traffic');
    car.vertical = spot.vertical;
    car.dir = random() < 0.5 ? 1 : -1;
    car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.cruiseSpeed = TRAFFIC.cruiseSpeed + range(random, -TRAFFIC.cruiseJitter, TRAFFIC.cruiseJitter);
    car.randomTurn = () => random() < 0.3;
    car.randomDir = () => (random() < 0.5 ? 1 : -1);
    traffic.push(car);
  }

  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) peds.push(createPedestrian(random, city));

  const state = {
    seed,
    time: 0,
    clock: 15.5,
    player,
    traffic,
    peds,
    police,
    combat,
    missions,
    city,
    camera: { x: player.x, y: player.y },
    particles: [],
    // The marker the HUD points at (mission target or pickup).
    marker: null,
    pickup: null,
    stats: { stolen: 0, pedsDown: 0, copsDown: 0, missionsDone: 0, cashEarned: 0, shotsFired: 0 },
    message: '',
    messageTimer: 0,
    lastStageKey: '',
    enemiesSpawnedFor: -1,
  };

  function addParticles(x, y, count, color, speed, life) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const sp = speed * (0.4 + random() * 0.8);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * sp,
        vy: Math.sin(angle) * sp,
        life: life * (0.6 + random() * 0.8),
        maxLife: life,
        color,
        size: 2 + random() * 4,
      });
    }
  }

  function showMessage(text, seconds) {
    state.message = text;
    state.messageTimer = seconds || 3;
  }

  function reset() {
    // Rebuild a fresh state and copy its fields into this one, so anything
    // holding a reference to `state` keeps seeing the live game.
    const fresh = createWorld(seed).state;
    for (const key of Object.keys(fresh)) state[key] = fresh[key];
  }

  function applySave(save) {
    player.money = save.money ?? 250;
    player.x = save.x ?? player.x;
    player.y = save.y ?? player.y;
    player.health = save.health ?? PLAYER.health;
    missions.index = save.missionIndex ?? 0;
    state.stats = { ...state.stats, ...(save.stats || {}) };
    state.camera.x = player.x;
    state.camera.y = player.y;
  }

  function toSave() {
    return {
      money: player.money,
      missionIndex: missions.index,
      x: Math.round(player.x),
      y: Math.round(player.y),
      health: Math.round(player.health),
      stats: state.stats,
    };
  }

  function nearestEnterableCar() {
    let best = null;
    let bestDist = CAR.enterRadius;
    for (let i = 0; i < traffic.length; i += 1) {
      const car = traffic[i];
      if (car.dead) continue;
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    const index = traffic.indexOf(car);
    if (index !== -1) traffic.splice(index, 1);
    player.car = car;
    player.car.kind = 'player';
    player.onFoot = false;
    player.x = car.x;
    player.y = car.y;
    state.stats.stolen += 1;
    addHeat(police, 'steal');
    showMessage('Car stolen! The cops are onto you.', 2.5);
    advanceStage(missions, 'steal');
    return true;
  }

  function exitCar() {
    const car = player.car;
    if (!car) return;
    const angle = car.angle + Math.PI / 2;
    const px = car.x + Math.cos(angle) * 48;
    const py = car.y + Math.sin(angle) * 48;
    const spot = city.walkable(px, py, PLAYER.radius) ? { x: px, y: py } : { x: car.x, y: car.y };
    player.x = spot.x;
    player.y = spot.y;
    player.onFoot = true;
    player.car = null;
    car.kind = 'traffic';
    car.cruiseSpeed = 0;
    car.randomTurn = () => false;
    traffic.push(car);
  }

  function respawn(reason) {
    const fine = Math.min(player.money, reason === 'busted' ? 300 : 200);
    player.money -= fine;
    player.health = PLAYER.health;
    player.x = city.landmarks.garage.x + 60;
    player.y = city.landmarks.garage.y + 60;
    player.car = null;
    player.onFoot = true;
    clearHeat(police);
    combat.bullets.length = 0;
    combat.enemies.length = 0;
    state.camera.x = player.x;
    state.camera.y = player.y;
    showMessage(reason === 'busted' ? `BUSTED! Fine $${fine}. Vic bailed you out.` : `WASTED! Hospital bill $${fine}.`, 4);
  }

  function stagePlace() {
    const stage = currentStage(missions);
    if (!stage || !stage.place) return null;
    return city.landmarks[stage.place];
  }

  function updateMissionMarker() {
    const stage = currentStage(missions);
    if (!missions.active || !stage) {
      state.marker = null;
      state.pickup = null;
      return;
    }
    if (stage.type === 'arrive' && stage.place) {
      const place = city.landmarks[stage.place];
      state.marker = { x: place.x, y: place.y, label: place.label };
      state.pickup = null;
    } else if (stage.type === 'pickup') {
      const place = stage.place ? city.landmarks[stage.place] : null;
      const at = place || stagePlace() || { x: player.x, y: player.y };
      state.marker = { x: at.x, y: at.y, label: 'Pickup' };
      state.pickup = { x: at.x, y: at.y };
    } else if (stage.type === 'defeat') {
      const place = city.landmarks.docks;
      state.marker = { x: place.x, y: place.y, label: place.label };
      state.pickup = null;
    } else {
      state.marker = null;
      state.pickup = null;
    }
  }

  function onStageStart() {
    const stage = currentStage(missions);
    if (!stage) return;
    if (stage.heat) police.heat = Math.min(5.4, police.heat + stage.heat);
    if (stage.seconds) missions.timer = stage.seconds;
    if (stage.type === 'defeat') {
      const place = city.landmarks.docks;
      for (let i = 0; i < stage.count; i += 1) {
        spawnEnemy(combat, place.x + range(random, -120, 120), place.y + range(random, -80, 80), 60);
      }
      state.enemiesSpawnedFor = missions.stage;
      showMessage('The Docks crew is here. Take them down!', 3);
    }
  }

  function step(dt, ctrl) {
    let events = EVENT_NONE;
    state.time += dt;
    state.clock = (15.5 + state.time / 120) % 24;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (missions.bannerTimer > 0) missions.bannerTimer -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;

    // Mission stage bookkeeping: a new stage starts its heat and timer once.
    const stageKey = `${missions.index}:${missions.stage}:${missions.active}`;
    if (stageKey !== state.lastStageKey) {
      state.lastStageKey = stageKey;
      if (missions.active) onStageStart();
    }
    police.level = wantedLevel(police.heat);
    updateMissionMarker();

    // --- Player ---
    player.aim = ctrl.aim;
    if (player.onFoot) {
      const speed = ctrl.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const len = Math.hypot(ctrl.move.x, ctrl.move.y) || 1;
      const mx = ctrl.move.x / len;
      const my = ctrl.move.y / len;
      const moving = ctrl.move.x !== 0 || ctrl.move.y !== 0;
      if (moving) {
        player.angle = Math.atan2(my, mx);
        const moved = city.moveCircle(player.x, player.y, mx * speed * dt, my * speed * dt, PLAYER.radius);
        player.x = moved.x;
        player.y = moved.y;
      }
      if (ctrl.enter) {
        const car = nearestEnterableCar();
        if (car) enterCar(car);
        else if (state.pickup && dist(player.x, player.y, state.pickup.x, state.pickup.y) < 70) {
          if (advanceStage(missions, 'pickup') === 'complete') {
            const reward = completeMission(missions);
            player.money += reward;
            state.stats.cashEarned += reward;
            state.stats.missionsDone += 1;
            events |= EVENT_MISSION_DONE;
          }
        }
      }
      if (ctrl.shoot) {
        if (tryShoot(combat, player.x, player.y, player.aim)) {
          state.stats.shotsFired += 1;
          addHeat(police, 'shoot');
        }
      }
    } else if (player.car) {
      const car = player.car;
      const drive = { throttle: -ctrl.move.y, steer: ctrl.move.x };
      const hitWall = stepCar(car, dt, drive, city);
      if (hitWall && Math.abs(car.speed) > 200) {
        addParticles(car.x, car.y, 8, '#cccccc', 120, 0.6);
      }
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      if (ctrl.enter) {
        if (state.pickup && dist(player.x, player.y, state.pickup.x, state.pickup.y) < 80) {
          if (advanceStage(missions, 'pickup') === 'complete') {
            const reward = completeMission(missions);
            player.money += reward;
            state.stats.cashEarned += reward;
            state.stats.missionsDone += 1;
            events |= EVENT_MISSION_DONE;
          }
        } else {
          exitCar();
        }
      }
      if (ctrl.shoot) {
        if (tryShoot(combat, player.x, player.y, player.aim)) {
          state.stats.shotsFired += 1;
          addHeat(police, 'shoot');
        }
      }
      if (car.health <= 0 && !car.dead) {
        car.dead = true;
        addParticles(car.x, car.y, 30, '#555555', 260, 1.2);
        exitCar();
        showMessage('Your car is wrecked!', 2.5);
      }
    }

    // --- Traffic ---
    for (let i = 0; i < traffic.length; i += 1) {
      const car = traffic[i];
      if (car.dead) continue;
      if (car.cruiseSpeed === 0 && car.kind === 'traffic') continue; // parked car
      stepCar(car, dt, null, city);
    }
    for (let i = 0; i < traffic.length; i += 1) {
      for (let j = i + 1; j < traffic.length; j += 1) {
        separateCars(traffic[i], traffic[j]);
      }
      if (player.car) separateCars(traffic[i], player.car);
      for (let k = 0; k < police.cars.length; k += 1) separateCars(traffic[i], police.cars[k]);
    }

    // --- Pedestrians ---
    const danger = combat.bullets.length > 0 || (player.car && Math.abs(player.car.speed) > 300)
      ? { x: player.x, y: player.y }
      : null;
    for (let i = 0; i < peds.length; i += 1) {
      const ped = peds[i];
      if (ped.dead) continue;
      stepPedestrian(ped, dt, random, city, danger);
    }
    // The player's car running over a pedestrian.
    if (player.car) {
      for (let i = 0; i < peds.length; i += 1) {
        const ped = peds[i];
        if (ped.dead) continue;
        if (carOverlapsPoint(player.car, ped.x, ped.y, 10) && Math.abs(player.car.speed) > 60) {
          ped.dead = true;
          state.stats.pedsDown += 1;
          addHeat(police, 'hitPed');
          addParticles(ped.x, ped.y, 10, '#e8483f', 140, 0.7);
          showMessage('You hit a pedestrian!', 2);
        }
      }
    }

    // --- Police ---
    if (police.level > 0) maintainPolice(police, random, city, player);
    else {
      police.cars.length = 0;
      police.cops.length = 0;
    }
    if (police.heat > 0 && state.time % 1 < dt) {
      // Heat cools slowly while the player stays out of trouble.
      police.heat = Math.max(0, police.heat - HEAT_DECAY);
      police.level = wantedLevel(police.heat);
    }
    const bust = stepPolice(police, dt, random, city, player, player.car);
    if (bust === 'busted') {
      respawn('busted');
      events |= EVENT_BUSTED;
    }
    // Police cars ramming the player's car damage it.
    if (player.car) {
      for (let i = 0; i < police.cars.length; i += 1) {
        const cop = police.cars[i];
        if (carsOverlap(cop, player.car)) {
          player.car.health -= 26 * dt;
          addParticles(player.car.x, player.car.y, 2, '#ffcc44', 80, 0.4);
        }
      }
    }

    // --- Combat ---
    const combatResult = stepCombat(combat, dt, city, player, player.car, peds, police, [...traffic, ...(player.car ? [player.car] : [])], (hit) => {
      if (hit.kind === 'cop') {
        state.stats.copsDown += 1;
        addHeat(police, 'killCop');
      } else if (hit.kind === 'ped') {
        state.stats.pedsDown += 1;
        addHeat(police, 'hitPed');
      } else if (hit.kind === 'enemy') {
        if (hit.target.dead) {
          if (advanceStage(missions, 'defeat') === 'complete') {
            const reward = completeMission(missions);
            player.money += reward;
            state.stats.cashEarned += reward;
            state.stats.missionsDone += 1;
            events |= EVENT_MISSION_DONE;
          }
        }
      }
    });
    if (combatResult === 'playerDead') {
      respawn('wasted');
      events |= EVENT_WASTED;
    }

    // --- Missions: arrival, timer ---
    if (missions.active) {
      const stage = currentStage(missions);
      if (stage) {
        if (stage.type === 'arrive' && stage.place) {
          const place = city.landmarks[stage.place];
          if (dist(player.x, player.y, place.x, place.y) < 120) {
            const result = advanceStage(missions, 'arrive');
            if (result === 'complete') {
              const reward = completeMission(missions);
              player.money += reward;
              state.stats.cashEarned += reward;
              state.stats.missionsDone += 1;
              events |= EVENT_MISSION_DONE;
            }
          }
        }
        if (stage.seconds) {
          missions.timer -= dt;
          if (missions.timer <= 0) {
            if (advanceStage(missions, 'timeout') === 'failed') events |= EVENT_MISSION_FAIL;
          }
        }
      }
    }

    // --- Particles ---
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2 * dt;
      p.vy *= 1 - 2 * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    // --- Camera follows the player, clamped to the city ---
    const tx = Math.max(FIELD.width / 2 - 60, Math.min(CITY.width - FIELD.width / 2 + 60, player.x));
    const ty = Math.max(FIELD.height / 2 - 60, Math.min(CITY.height - FIELD.height / 2 + 60, player.y));
    state.camera.x += (tx - state.camera.x) * Math.min(1, 5 * dt);
    state.camera.y += (ty - state.camera.y) * Math.min(1, 5 * dt);

    // Slow health regen when nobody is after the player.
    if (police.level === 0 && player.health < PLAYER.health) {
      player.health = Math.min(PLAYER.health, player.health + 2 * dt);
    }

    return events;
  }

  return { state, reset, step, applySave, toSave, showMessage, enterCar, exitCar, nearestEnterableCar };
}
