// Every tuning number, colour and city constant for Solmar City in one place.
// The playfield is a fixed logical area; the renderer draws the part around the
// camera, so no rule below depends on the window size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The whole city, in world units. Roads run on a grid; blocks between them hold buildings. */
export const CITY = {
  width: 3600,
  height: 2600,
  roadGap: 450,
  roadWidth: 104,
  sidewalk: 26,
  beachY: 2280,
  waterY: 2440,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 235,
  runSpeed: 330,
  health: 100,
  punchDamage: 12,
  shootCooldown: 0.22,
  bulletSpeed: 900,
  bulletDamage: 34,
  bulletRange: 620,
};

export const CAR = {
  length: 64,
  width: 32,
  accel: 520,
  reverseAccel: 320,
  maxSpeed: 640,
  maxReverse: 220,
  brake: 900,
  drag: 0.55,
  turnRate: 2.6,
  grip: 6.5,
  enterRadius: 70,
  health: 100,
};

/** Traffic and police car counts and behaviour. */
export const TRAFFIC = {
  count: 26,
  cruiseSpeed: 170,
  cruiseJitter: 55,
  spawnMargin: 500,
};

export const PEDS = { count: 42, speed: 55, fleeSpeed: 150 };

/** Wanted stars 0..5; each level names how many police cars hunt and how fast they are. */
export const WANTED = [
  { cars: 0, cops: 0, speed: 0 },
  { cars: 1, cops: 2, speed: 430 },
  { cars: 2, cops: 3, speed: 470 },
  { cars: 3, cops: 4, speed: 520 },
  { cars: 4, cops: 6, speed: 570 },
  { cars: 6, cops: 8, speed: 620 },
];

/** Wanted heat decays this many points a second while no crime is committed. */
export const HEAT_DECAY = 0.045;
/** Heat points per crime: stealing a car, hitting a pedestrian, shooting, killing a cop. */
export const HEAT = { steal: 0.7, hitPed: 0.6, shoot: 0.4, killCop: 1.2, ramCop: 0.5 };

export const COP = { radius: 12, speed: 250, punchDamage: 8, punchCooldown: 0.9 };

/** Mission cash rewards, in order. */
export const MISSION_REWARDS = [400, 800, 1500, 2200, 5000];

export const PALETTE = {
  backdrop: '#0d1520',
  grass: '#5d9c4e',
  parkGrass: '#4e8f43',
  sand: '#e0c184',
  water: '#1e7fa8',
  waterDeep: '#14648a',
  road: '#3a3f4a',
  roadLine: '#d8c95a',
  sidewalk: '#9aa0a8',
  curb: '#6e747e',
  buildingRoof: '#b0703f',
  buildingRoof2: '#7d8aa0',
  buildingRoof3: '#c98f5f',
  buildingRoof4: '#5f7d6a',
  buildingEdge: '#2c2f36',
  player: '#ffcf3f',
  playerShirt: '#e8483f',
  cop: '#2f6fd0',
  copCar: '#1d4fa8',
  copCarLight: '#ff3b30',
  text: '#f4f1e8',
  muted: '#aab3bd',
  panel: 'rgba(12, 18, 28, 0.88)',
  panelEdge: '#f2c94c',
  hudBg: 'rgba(10, 14, 22, 0.72)',
  star: '#ffd23f',
  starEmpty: '#5a6270',
  health: '#57d977',
  healthLow: '#e5534b',
  cash: '#7be07b',
  marker: '#ff5fa2',
  markerRing: '#ffffff',
  bullet: '#ffe9a8',
  muzzle: '#ffd23f',
  smoke: 'rgba(180, 180, 180, 0.55)',
  minimapBg: 'rgba(8, 12, 20, 0.82)',
  minimapRoad: '#8b93a3',
  minimapWater: '#1e7fa8',
  minimapPark: '#4e8f43',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save (money, mission, position, stats) is kept between visits. */
export const SAVE_KEY = 'solmar-city.save.v1';
/** Where the best cash haul is kept. */
export const BEST_KEY = 'solmar-city.best';
