// Keyboard and mouse input. Held keys give movement and driving; one-shot
// presses (enter a car, shoot, start a mission, pause, mute) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost
// and never counted twice. The mouse aims the pistol.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;
export const ACTION_MISSION = 16;
export const ACTION_MUTE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const MISSION = new Set(['KeyM']);
const MUTE = new Set(['KeyN']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (MISSION.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MISSION;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });

  function hasAny(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1/0/1 for each axis from the held movement keys. */
    move() {
      const x = (hasAny(RIGHT) ? 1 : 0) - (hasAny(LEFT) ? 1 : 0);
      const y = (hasAny(DOWN) ? 1 : 0) - (hasAny(UP) ? 1 : 0);
      return { x, y };
    },
    /** True while Shift is held: run on foot. */
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** The mouse position in window pixels, for aiming. */
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** True while the mouse button (or F) is held: hold to shoot. */
    shooting() {
      return mouseDown || held.has('KeyF');
    },
    /** The one-shot presses since the last call, as ACTION_* flags. With a mask,
        only those bits are taken; the rest stay queued for the next caller. */
    takeActions(mask) {
      if (mask === undefined) {
        const taken = actions;
        actions = 0;
        return taken;
      }
      const taken = actions & mask;
      actions &= ~mask;
      return taken;
    },
  };
}
