// The story: five missions for Vic, a small-time fixer in Solmar, that take the
// player from stealing a first car to the big score at the Marlin Casino. Each
// mission is a list of stages; a stage names its place, its text and what ends it
// (arrive, steal a car, pick up, defeat the gang, survive the timer). The world
// drives the stage machine; this file only describes it.

import { MISSION_REWARDS } from './config.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'First Wheels',
    intro: 'Vic needs a driver. Steal any car on the street and bring it to my garage. Try not to get noticed.',
    stages: [
      { type: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { type: 'arrive', place: 'garage', text: 'Drive the car to Vic\'s Garage' },
    ],
  },
  {
    id: 2,
    title: 'The Package',
    intro: 'A package is waiting at the pickup spot. Grab it, drop it off — and the cops are already looking for you.',
    stages: [
      { type: 'arrive', place: 'pickup', text: 'Go to the package pickup' },
      { type: 'pickup', text: 'Pick up the package (press E)' },
      { type: 'arrive', place: 'dropPoint', text: 'Deliver the package to the drop point', heat: 1.2 },
    ],
  },
  {
    id: 3,
    title: 'Getaway Driver',
    intro: 'The bank job is on. Get to the bank, then lose the cops and make the safehouse before the clock runs out.',
    stages: [
      { type: 'arrive', place: 'bank', text: 'Get to Solmar Bank', heat: 0.8 },
      { type: 'arrive', place: 'safehouse', seconds: 75, text: 'Escape to the Safehouse before time runs out!', heat: 2.0 },
    ],
  },
  {
    id: 4,
    title: 'Street Heat',
    intro: 'The Docks crew has been muscling in on Vic. Go to the docks and settle it. Bring the pistol.',
    stages: [
      { type: 'arrive', place: 'docks', text: 'Go to the Docks' },
      { type: 'defeat', count: 4, text: 'Defeat the Docks crew (4 left)' },
    ],
  },
  {
    id: 5,
    title: 'The Big Score',
    intro: 'One last job: the Marlin Casino vault. Grab the cash, then run — every cop in Solmar will be on you.',
    stages: [
      { type: 'arrive', place: 'casino', text: 'Get to the Marlin Casino', heat: 1.0 },
      { type: 'pickup', text: 'Grab the casino cash (press E)' },
      { type: 'arrive', place: 'safehouse', text: 'Escape to the Safehouse with the cash', heat: 3.0 },
    ],
  },
];

export function createMissions() {
  return {
    index: 0,
    stage: 0,
    timer: 0,
    active: false,
    done: false,
    // The marker the HUD and minimap point at, set by the world each step.
    marker: null,
    // Text shown while the mission is between stages.
    banner: '',
    bannerTimer: 0,
    defeated: 0,
  };
}

export function currentMission(missions) {
  return MISSIONS[missions.index] || null;
}

export function currentStage(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  return mission.stages[missions.stage] || null;
}

export function missionReward(index) {
  return MISSION_REWARDS[index] || 500;
}

/** Start the current mission: reset its stage and show its intro as a banner. */
export function startMission(missions) {
  const mission = currentMission(missions);
  if (!mission) return;
  missions.active = true;
  missions.stage = 0;
  missions.timer = 0;
  missions.defeated = 0;
  missions.banner = `Mission ${mission.id}: ${mission.title} — ${mission.intro}`;
  missions.bannerTimer = 6;
}

/**
 * Advance one stage. Returns 'complete' when the mission is finished, 'next'
 * when another stage follows, or 'none' when the stage is not done yet. The
 * caller passes what happened this step: arrived at the marker, stole a car,
 * picked something up, defeated an enemy, or the timer running out.
 */
export function advanceStage(missions, event) {
  const mission = currentMission(missions);
  const stage = currentStage(missions);
  if (!mission || !stage || !missions.active) return 'none';
  let done = false;
  if (stage.type === 'arrive' && event === 'arrive') done = true;
  else if (stage.type === 'steal' && event === 'steal') done = true;
  else if (stage.type === 'pickup' && event === 'pickup') done = true;
  else if (stage.type === 'defeat' && event === 'defeat') {
    missions.defeated += 1;
    if (missions.defeated >= stage.count) done = true;
  } else if (stage.type === 'arrive' && stage.seconds && event === 'timeout') {
    // The escape timer ran out: the mission fails and restarts from its first stage.
    missions.stage = 0;
    missions.timer = 0;
    missions.defeated = 0;
    missions.banner = `Too slow — ${mission.title} failed. Vic is giving you another shot.`;
    missions.bannerTimer = 5;
    return 'failed';
  }
  if (!done) return 'none';
  missions.stage += 1;
  missions.timer = 0;
  if (missions.stage >= mission.stages.length) {
    missions.active = false;
    missions.done = true;
    return 'complete';
  }
  return 'next';
}

/** Finish a mission: pay out and move to the next one. Returns the reward. */
export function completeMission(missions) {
  const reward = missionReward(missions.index);
  const mission = currentMission(missions);
  missions.index += 1;
  missions.stage = 0;
  missions.timer = 0;
  missions.defeated = 0;
  missions.done = false;
  if (missions.index >= MISSIONS.length) {
    missions.banner = 'All missions complete! You own Solmar now. Free roam — the city is yours.';
    missions.bannerTimer = 8;
  } else {
    const next = MISSIONS[missions.index];
    missions.banner = `Mission complete: ${mission.title} — $${reward}. Next: ${next.title}. Press Enter to start it.`;
    missions.bannerTimer = 7;
  }
  return reward;
}

/** The stage's objective text, with the live defeat count filled in. */
export function stageText(missions) {
  const stage = currentStage(missions);
  if (!stage) return '';
  if (stage.type === 'defeat') {
    return `Defeat the Docks crew (${Math.max(0, stage.count - missions.defeated)} left)`;
  }
  return stage.text;
}
