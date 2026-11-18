// Keyboard and mouse input. Held keys give a movement direction; one-shot
// presses (confirm, pause, enter/exit car, shoot) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and never
// counted twice. The mouse aims the pistol: its position is kept in the
// renderer's logical 1280 x 720 coordinates (main.js converts it).
import { VIEW } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const SHOOT = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas, toLogical) {
  const keys = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let mouseX = VIEW.width / 2;
  let mouseY = VIEW.height / 2;
  let mouseDown = false;
  let mouseActive = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (SHOOT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SHOOT;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = false;
    mouseDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const p = toLogical(event.clientX, event.clientY);
    mouseX = p.x;
    mouseY = p.y;
    mouseActive = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      mouseActive = true;
      const p = toLogical(event.clientX, event.clientY);
      mouseX = p.x;
      mouseY = p.y;
    }
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
  });

  return {
    /** Held movement keys, as booleans. */
    get up() { return keys.up; },
    get down() { return keys.down; },
    get left() { return keys.left; },
    get right() { return keys.right; },
    /** Mouse aim in logical view coordinates, and whether the button is held. */
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },
    get mouseDown() { return mouseDown; },
    get mouseActive() { return mouseActive; },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The per-step movement/shoot state the world reads. */
    frame() {
      return {
        up: keys.up, down: keys.down, left: keys.left, right: keys.right,
        enter: false, shoot: false,
        mouseX, mouseY, mouseDown, mouseActive,
      };
    },
  };
}
