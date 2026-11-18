// The screenshot scenes behind ?shot=start|chase|mission|combat. Each one sets
// the world up from a fresh reset and then plays the real rules forward for a
// fixed number of steps, steered by a small scripted driver, so the frame is
// what real play looks like and the same seed always gives the same frame.
import { STEP, PLACES } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE = { up: false, down: false, left: false, right: false, enter: false, shoot: false, mouseX: 640, mouseY: 360, mouseDown: false, mouseActive: false };

function aimAt(world, tx, ty) {
  const s = world.state;
  const mx = tx - s.camera.x;
  const my = ty - s.camera.y;
  return { ...IDLE, mouseX: mx, mouseY: my, mouseDown: true, mouseActive: true };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * save info to show. Unknown names stage the title screen.
 */
export function stageShot(name, world) {
  world.reset();
  const s = world.state;
  if (name === 'chase') {
    // Mission 3's escape: wanted 3, police cars behind, driving flat out up
    // Harbor Road (a straight run, so the shot is a real chase, not a crash).
    s.missionIdx = 2;
    s.stepIdx = 1;
    world.activateStep();
    s.wanted = 3;
    s.lastCrime = 0;
    s.player.money = 450;
    const car = {
      x: 2400, y: 1900, angle: -Math.PI / 2, speed: 500, cruise: 0,
      color: '#c94b4b', kind: 'parked', driver: false, route: [], routeIdx: 0, stuck: 0,
    };
    s.cars.push(car);
    s.player.inCar = s.cars.length - 1;
    s.player.x = car.x;
    s.player.y = car.y;
    s.player.angle = car.angle;
    for (let i = 0; i < 2; i += 1) {
      s.cars.push({
        x: 2400, y: 2050 + i * 110, angle: -Math.PI / 2, speed: 480, cruise: 590,
        color: '#e8e8e8', kind: 'police', driver: true, route: [], routeIdx: 0, stuck: 0,
      });
    }
    for (let i = 0; i < 120; i += 1) world.step(STEP, { ...IDLE, up: true }, false);
    s.banner = 'Deliver the Comet GT to the garage — the cops are on you';
    s.toast = '';
    return { screen: SCREEN_PLAY, save: { missionIdx: 2, money: 450 } };
  }
  if (name === 'mission') {
    // Mission 2 at the docks: on foot, package crate ahead, marker pulsing.
    s.missionIdx = 1;
    s.stepIdx = 1;
    world.activateStep();
    s.player.x = 2740;
    s.player.y = 1980;
    s.player.money = 150;
    s.camera.x = 2740 - 640;
    s.camera.y = 1980 - 360;
    s.banner = 'Walk to the crate and grab the package';
    s.toast = '';
    s.toastT = 0;
    for (let i = 0; i < 90; i += 1) world.step(STEP, IDLE, false);
    return { screen: SCREEN_PLAY, save: { missionIdx: 1, money: 150 } };
  }
  if (name === 'combat') {
    // Mission 4's shootout: armed men at the docks, player firing.
    s.missionIdx = 3;
    s.stepIdx = 1;
    world.activateStep();
    s.player.x = 2700;
    s.player.y = 1980;
    s.player.money = 600;
    s.wanted = 2;
    s.camera.x = 2700 - 640;
    s.camera.y = 1980 - 360;
    s.banner = 'Deal with the four armed men at the docks';
    s.toast = '';
    s.toastT = 0;
    for (let i = 0; i < 60; i += 1) {
      const thug = s.thugs[0];
      const input = thug ? aimAt(world, thug.x, thug.y) : IDLE;
      world.step(STEP, input, false);
    }
    return { screen: SCREEN_PLAY, save: { missionIdx: 3, money: 600 } };
  }
  // start: the title screen over a living city.
  for (let i = 0; i < 300; i += 1) world.step(STEP, IDLE, true);
  return { screen: SCREEN_TITLE, save: { missionIdx: 0, money: 0 } };
}
