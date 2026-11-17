// The city of Solmar: a road grid, the blocks between the roads, the park, the
// beach and the bay. Everything is laid out from a seed, so the same seed builds
// the same city. The world answers geometry questions (is this point road, water,
// inside a building) and hands traffic a road to drive on.

import { CITY } from './config.js';

const ROAD_HALF = CITY.roadWidth / 2;
const BLOCK = CITY.roadGap;

/** Road centre lines, in world units, both directions. */
function roadLines() {
  const vertical = [];
  const horizontal = [];
  for (let x = BLOCK; x < CITY.width; x += BLOCK) vertical.push(x);
  for (let y = BLOCK; y < CITY.beachY; y += BLOCK) horizontal.push(y);
  return { vertical, horizontal };
}

function onRoadX(x) {
  return x % BLOCK < ROAD_HALF || x % BLOCK > BLOCK - ROAD_HALF;
}

function onRoadY(y) {
  return y % BLOCK < ROAD_HALF || y % BLOCK > BLOCK - ROAD_HALF;
}

/** Distance from a point to the nearest road centre line (0 when on a road). */
function roadDistance(x, y) {
  let best = Infinity;
  const rx = x % BLOCK;
  const dx = Math.min(rx, BLOCK - rx);
  const ry = y % BLOCK;
  const dy = Math.min(ry, BLOCK - ry);
  if (dx < ROAD_HALF) best = Math.min(best, 0);
  else best = Math.min(best, dx - ROAD_HALF);
  if (y < CITY.beachY) {
    if (dy < ROAD_HALF) best = Math.min(best, 0);
    else best = Math.min(best, dy - ROAD_HALF);
  }
  return best;
}

export function createCity(random) {
  const { vertical, horizontal } = roadLines();
  const buildings = [];
  const parks = [];

  // One building per block, inset from the roads, with a roof colour and a height
  // (drawn as a shadow offset). The block at the centre holds the park instead.
  const parkCol = 3;
  const parkRow = 2;
  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row < 5; row += 1) {
      const bx = col * BLOCK + ROAD_HALF + 14;
      const by = row * BLOCK + ROAD_HALF + 14;
      const bw = BLOCK - CITY.roadWidth - 28;
      const bh = BLOCK - CITY.roadWidth - 28;
      if (by + bh > CITY.beachY - ROAD_HALF) continue;
      if (col === parkCol && row === parkRow) {
        parks.push({ x: bx, y: by, w: bw, h: bh });
        continue;
      }
      const split = random() < 0.45;
      if (split) {
        const cut = bw * (0.42 + random() * 0.16);
        buildings.push({ x: bx, y: by, w: cut - 10, h: bh, roof: Math.floor(random() * 4), height: 8 + random() * 22 });
        buildings.push({ x: bx + cut + 10, y: by, w: bw - cut - 10, h: bh, roof: Math.floor(random() * 4), height: 8 + random() * 22 });
      } else {
        buildings.push({ x: bx, y: by, w: bw, h: bh, roof: Math.floor(random() * 4), height: 8 + random() * 22 });
      }
    }
  }

  // The docks: a pier jutting into the bay on the west edge, and the casino, bank,
  // garage and safehouse are fixed landmarks the missions point at.
  const landmarks = {
    garage: { x: 450, y: 450, label: 'Vic\'s Garage' },
    bank: { x: 2250, y: 450, label: 'Solmar Bank' },
    casino: { x: 2700, y: 1350, label: 'The Marlin Casino' },
    docks: { x: 180, y: 2050, label: 'The Docks' },
    safehouse: { x: 3150, y: 450, label: 'Safehouse' },
    dropPoint: { x: 900, y: 1350, label: 'Drop Point' },
    pickup: { x: 1350, y: 900, label: 'Package Pickup' },
  };

  function isWater(x, y) {
    return y >= CITY.waterY;
  }

  function isBeach(x, y) {
    return y >= CITY.beachY && y < CITY.waterY;
  }

  function isRoad(x, y) {
    if (y >= CITY.beachY) return false;
    return onRoadX(x) || onRoadY(y);
  }

  function isSidewalk(x, y) {
    if (y >= CITY.beachY || isRoad(x, y)) return false;
    return roadDistance(x, y) < CITY.sidewalk + 2;
  }

  function buildingAt(x, y) {
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  function inPark(x, y) {
    for (let i = 0; i < parks.length; i += 1) {
      const p = parks[i];
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
    }
    return false;
  }

  /** True when a circle of `radius` at (x, y) can stand there: not in water or a building. */
  function walkable(x, y, radius) {
    if (x < radius || y < radius || x > CITY.width - radius || y > CITY.height - radius) return false;
    if (isWater(x, y)) return false;
    const b = buildingAt(x, y);
    if (b) return false;
    return true;
  }

  /** Slide a circle out of buildings: try x then y, so movement hugs walls. */
  function moveCircle(x, y, dx, dy, radius) {
    let nx = x;
    let ny = y;
    if (walkable(x + dx, y, radius)) nx = x + dx;
    if (walkable(nx, y + dy, radius)) ny = y + dy;
    return { x: nx, y: ny };
  }

  /** Snap a point to the nearest road centre line (for spawning traffic on roads). */
  function nearestRoadPoint(x, y) {
    const rx = Math.round(x / BLOCK) * BLOCK;
    const ry = Math.round(y / BLOCK) * BLOCK;
    const dx = Math.abs(rx - x);
    const dy = Math.abs(ry - y);
    if (y >= CITY.beachY) return { x: rx, y: CITY.beachY - BLOCK, vertical: dx <= dy };
    if (dx <= dy) return { x: rx, y, vertical: true };
    return { x, y: ry, vertical: false };
  }

  /** A random point on a road, at least `margin` from the city edge. */
  function randomRoadPoint(randomFn, margin) {
    const vertical = randomFn() < 0.5;
    if (vertical) {
      const x = vertical[Math.floor(randomFn() * vertical.length)];
      const y = margin + randomFn() * (CITY.beachY - margin * 2);
      return { x, y, vertical: true };
    }
    const y = horizontal[Math.floor(randomFn() * horizontal.length)];
    const x = margin + randomFn() * (CITY.width - margin * 2);
    return { x, y, vertical: false };
  }

  /** A random sidewalk point (for pedestrians). */
  function randomSidewalkPoint(randomFn) {
    for (let tries = 0; tries < 40; tries += 1) {
      const x = 80 + randomFn() * (CITY.width - 160);
      const y = 80 + randomFn() * (CITY.beachY - 160);
      if (isSidewalk(x, y)) return { x, y };
    }
    return { x: BLOCK + ROAD_HALF + CITY.sidewalk / 2, y: BLOCK };
  }

  return {
    buildings,
    parks,
    landmarks,
    vertical,
    horizontal,
    isWater,
    isBeach,
    isRoad,
    isSidewalk,
    buildingAt,
    inPark,
    walkable,
    moveCircle,
    nearestRoadPoint,
    randomRoadPoint,
    randomSidewalkPoint,
  };
}
