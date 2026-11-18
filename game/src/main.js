// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play,
// paused, busted, wasted and story complete. Progress (mission and money) is
// kept in localStorage between visits.
//
// ?seed=N fixes the city. ?shot=start|chase|mission|combat (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, SAVE_KEY, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_BUSTED, EVENT_WASTED, EVENT_STORY, EVENT_MISSION,
  EVENT_SHOT, EVENT_HIT, EVENT_PICKUP, EVENT_CRASH,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_SHOOT, ACTION_MUTE, createInput,
} from './input.js';
import {
  createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED,
  SCREEN_BUSTED, SCREEN_WASTED, SCREEN_STORY,
} from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas, (x, y) => renderer.toLogical(x, y));
// For automated playtests: the live world, readable from the console.
window.__world = world;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || typeof save.missionIdx !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.getSave()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

let save = readSave();
let wantNew = false;
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyN' && !event.repeat) wantNew = true;
});

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world.city, scene.screen, scene.save);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each mission.
  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    world.reset();
    if (!fresh && save) world.applySave(save);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    const mission = world.currentMission();
    announce(mission ? `Playing. ${mission.title}: ${mission.steps[0].text}` : 'Playing. Free roam.');
  }

  function frameInput() {
    const frame = input.frame();
    const actions = input.takeActions();
    frame.enter = (actions & ACTION_ENTER) !== 0;
    frame.shoot = (actions & ACTION_SHOOT) !== 0;
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    return { frame, actions };
  }

  function handleActions(actions) {
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) startGame(wantNew || !save);
      else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
        world.state.busted = false;
        world.state.wasted = false;
        screen = SCREEN_PLAY;
        announce('Back on the street.');
      } else if (screen === SCREEN_STORY) {
        screen = SCREEN_PLAY;
        announce('Free roam. Neon Harbor is yours.');
      }
      wantNew = false;
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step(inputFrame) {
    const events = world.step(STEP, inputFrame, screen === SCREEN_TITLE);
    if (events & EVENT_MISSION) {
      audio.mission();
      writeSave();
      const mission = world.currentMission();
      if (mission) announce(`Mission complete. Next: ${mission.title}.`);
    }
    if (events & EVENT_STORY) {
      screen = SCREEN_STORY;
      writeSave();
      announce('Story complete. All five jobs done.');
    }
    if (events & EVENT_BUSTED) {
      screen = SCREEN_BUSTED;
      audio.busted();
      writeSave();
      announce('Busted. The police caught you.');
    }
    if (events & EVENT_WASTED) {
      screen = SCREEN_WASTED;
      audio.busted();
      writeSave();
      announce('Wasted. You woke up in hospital.');
    }
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CRASH) audio.crash();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const { frame: inputFrame, actions } = frameInput();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      accumulator += dt;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(screen === SCREEN_TITLE ? { up: false, down: false, left: false, right: false, enter: false, shoot: false, mouseX: 640, mouseY: 360, mouseDown: false, mouseActive: false } : inputFrame);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const p = world.state.player;
    audio.siren(world.state.wanted > 0 && screen === SCREEN_PLAY);
    audio.sirenStep(dt);
    audio.engine(p.speed, p.inCar >= 0 && screen === SCREEN_PLAY);
    renderer.draw(world.state, world.city, screen, save);
  }

  // Leaving the tab pauses a running game rather than letting the cops catch the player unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Harbor. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
