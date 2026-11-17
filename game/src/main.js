// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play, paused
// and busted/wasted. Progress saves to localStorage every few seconds and on
// every mission completion, so a closed tab keeps the story.
//
// ?seed=N fixes the city and the traffic. ?shot=start|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot. Any uncaught error is recorded on
// window.__errors so a headless run can report it.

import { STEP } from './config.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION_DONE, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MISSION, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { readBest, readSave, writeBest, writeSave } from './save.js';
import { startMission, currentMission } from './missions.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Seconds between autosaves while playing. */
const AUTOSAVE_SECONDS = 8;

window.__errors = [];
window.addEventListener('error', (event) => {
  window.__errors.push(String(event.message || event.error || 'unknown error'));
});

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, saveExists: false, overKind: null, overText: '' });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let autosaveTimer = AUTOSAVE_SECONDS;
  let overKind = null;
  let overText = '';

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function saveGame() {
    writeSave(world.toSave());
  }

  function startNewGame() {
    world.reset();
    world.state.player.money = 250;
    screen = SCREEN_PLAY;
    announce('Playing Solmar City. Press M to start the first mission.');
  }

  function continueGame() {
    world.reset();
    world.applySave(save);
    screen = SCREEN_PLAY;
    announce('Welcome back to Solmar City.');
  }

  function startMissionNow() {
    const mission = currentMission(world.state.missions);
    if (!mission || world.state.missions.active) return;
    startMission(world.state.missions);
    audio.missionStart();
    announce(`Mission ${mission.id}: ${mission.title}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_MISSION_DONE) {
      audio.cash();
      saveGame();
      const done = world.state.stats.missionsDone;
      announce(`Mission complete. ${done} done.`);
    }
    if (events & EVENT_BUSTED) {
      overKind = 'busted';
      overText = 'The Solmar PD caught up with you.';
      screen = SCREEN_OVER;
      audio.bust();
      saveGame();
      announce('Busted. Press Space to get back out there.');
    } else if (events & EVENT_WASTED) {
      overKind = 'wasted';
      overText = 'The streets of Solmar got the better of you.';
      screen = SCREEN_OVER;
      audio.bust();
      saveGame();
      announce('Wasted. Press Space to get back out there.');
    }
  }

  function step() {
    const mouse = input.mouse();
    // Aim: from the screen centre toward the mouse, in world space.
    const rect = canvas.getBoundingClientRect();
    const view = renderer.view;
    const aimWorldX = world.state.camera.x + (mouse.x - rect.width / 2) / view.scale;
    const aimWorldY = world.state.camera.y + (mouse.y - rect.height / 2) / view.scale;
    const aim = Math.atan2(aimWorldY - world.state.player.y, aimWorldX - world.state.player.x);
    const ctrl = {
      move: input.move(),
      run: input.running(),
      aim,
      shoot: input.shooting(),
      enter: false,
    };
    const actions = input.takeActions(ACTION_ENTER | ACTION_MISSION | ACTION_MUTE);
    if (actions & ACTION_ENTER) ctrl.enter = true;
    if (actions & ACTION_MISSION) startMissionNow();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    const events = world.step(STEP, ctrl);
    handleEvents(events);
    // Engine hum and sirens follow the action.
    const car = world.state.player.car;
    audio.engine(car ? Math.abs(car.speed) / 640 : 0, STEP);
    audio.siren(world.state.police.cars.length > 0, STEP);
    // Autosave while playing.
    autosaveTimer -= STEP;
    if (autosaveTimer <= 0) {
      autosaveTimer = AUTOSAVE_SECONDS;
      saveGame();
    }
  }

  function handleActions() {
    // Only the screen-level actions are taken here; E/M/N stay queued for step().
    const actions = input.takeActions(ACTION_CONFIRM | ACTION_PAUSE);
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        if (save) continueGame();
        else startNewGame();
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_TITLE) {
      // The title screen's backdrop lives: traffic rolls behind the menu.
      while (accumulator >= STEP) {
        world.step(STEP, { move: { x: 0, y: 0 }, run: false, aim: 0, shoot: false, enter: false });
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const ui = { best, saveExists: !!save, overKind, overText };
    renderer.draw(world.state, screen, ui);
    if (world.state.player.money > best) {
      best = Math.floor(world.state.player.money);
      writeBest(best);
    }
  }

  // Leaving the tab pauses a running game rather than letting the cops catch the player unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      saveGame();
    }
  });

  announce('Solmar City. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
