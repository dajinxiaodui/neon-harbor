// Neon Harbor's simulation: one player, traffic, pedestrians, police, crimes,
// a wanted level, and a five-mission story. The world advances in fixed 1/60 s
// steps; everything below is deterministic for a given seed and input stream.
import { WORLD, PLAYER, CAR, TRAFFIC_COUNT, PED_COUNT, WANTED, POLICE, FINE, MISSIONS, PLACES, PALETTE } from './config.js';
import { createCity, ROAD_W, ROADS_V, ROADS_H, BEACH_Y } from './city.js';
import { pick, intBetween } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_MISSION = 1;
export const EVENT_STORY = 2;
export const EVENT_BUSTED = 4;
export const EVENT_WASTED = 8;
export const EVENT_SHOT = 16;
export const EVENT_HIT = 32;
export const EVENT_PICKUP = 64;
export const EVENT_WANTED_UP = 128;
export const EVENT_CRASH = 256;

const CAR_COLORS = ['#c94b4b', '#4b7fc9', '#c9a44b', '#5a9e5a', '#8a5fb8', '#c9c9c9', '#3a3a3a', '#d97b3f', '#4bb8c9'];
const TWO_PI = Math.PI * 2;

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function angleDiff(a, b) {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function createWorld(random) {
  const city = createCity(random);
  let state = null;

  function spawnTrafficCar(x, y) {
    const start = city.nearestIntersection(x, y);
    const route = [start];
    for (let i = 0; i < 5; i += 1) {
      const last = route[route.length - 1];
      const next = pick(random, city.intersections.filter((n) => n !== last));
      route.push(next);
    }
    return {
      x, y, angle: pick(random, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      speed: intBetween(random, 150, 220), cruise: intBetween(random, 150, 220),
      color: pick(random, CAR_COLORS), kind: 'traffic', driver: true,
      route, routeIdx: 1, stuck: 0,
    };
  }

  function spawnPed(x, y) {
    return {
      x, y, angle: pick(random, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      speed: intBetween(random, 40, 70), color: pick(random, PALETTE.ped),
      state: 'walk', fleeT: 0, fx: 0, fy: 0, dead: false, fade: 0,
    };
  }

  function spawnPickups() {
    const spots = [
      { x: 1380, y: 900, kind: 'ammo' }, { x: 1520, y: 900, kind: 'health' },
      { x: 2750, y: 1900, kind: 'ammo' }, { x: 2950, y: 2100, kind: 'health' },
      { x: 1650, y: 1050, kind: 'ammo' }, { x: 900, y: 300, kind: 'health' },
      { x: 420, y: 420, kind: 'ammo' }, { x: 2400, y: 1250, kind: 'health' },
    ];
    return spots.map((s) => ({ ...s, taken: false, respawn: 0 }));
  }

  function reset() {
    const cars = [];
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const node = city.intersections[Math.floor(random() * city.intersections.length)];
      const car = spawnTrafficCar(node.x + (random() - 0.5) * 40, node.y + (random() - 0.5) * 40);
      cars.push(car);
    }
    // A few parked cars the player can take.
    for (let i = 0; i < 5; i += 1) {
      const node = city.intersections[Math.floor(random() * city.intersections.length)];
      cars.push({
        x: node.x + 60, y: node.y + 30, angle: 0, speed: 0, cruise: 0,
        color: pick(random, CAR_COLORS), kind: 'parked', driver: false, route: [], routeIdx: 0, stuck: 0,
      });
    }
    const peds = [];
    for (let i = 0; i < PED_COUNT; i += 1) {
      const node = city.intersections[Math.floor(random() * city.intersections.length)];
      peds.push(spawnPed(node.x + (random() - 0.5) * 160, node.y + (random() - 0.5) * 160));
    }
    state = {
      time: 0,
      player: {
        x: PLACES.spawn.x, y: PLACES.spawn.y, angle: -Math.PI / 2,
        hp: PLAYER.hp, money: 0, ammo: PLAYER.startAmmo, inCar: -1,
        speed: 0, fireCd: 0, invuln: 0, aimAngle: -Math.PI / 2, hasPackage: false,
      },
      cars, peds, cops: [], thugs: [], bullets: [], parts: [], pickups: spawnPickups(),
      wanted: 0, lastCrime: -100, policeSpawnT: 0,
      missionIdx: 0, stepIdx: 0, defeated: 0, markedCar: -1,
      toast: '', toastT: 0, banner: '',
      busted: false, wasted: false, storyDone: false,
      camera: { x: PLACES.spawn.x, y: PLACES.spawn.y },
      shake: 0,
    };
    activateStep();
  }

  function currentMission() {
    return MISSIONS[state.missionIdx] ?? null;
  }
  function currentStep() {
    const m = currentMission();
    return m ? m.steps[state.stepIdx] ?? null : null;
  }

  function say(text, seconds = 4) {
    state.toast = text;
    state.toastT = seconds;
  }

  function addWanted(amount) {
    const before = Math.ceil(state.wanted);
    state.wanted = clamp(state.wanted + amount, 0, WANTED.max);
    state.lastCrime = state.time;
    return Math.ceil(state.wanted) > before;
  }

  function spawnThugs(area, count) {
    for (let i = 0; i < count; i += 1) {
      // Rejection-sample the spot: a thug inside a building or in the water
      // can never be shot or reached, which would make the defeat step
      // impossible to finish.
      let x = area.x;
      let y = area.y;
      for (let tries = 0; tries < 40; tries += 1) {
        const a = random() * TWO_PI;
        const r = 40 + random() * (area.r - 60);
        const cx = area.x + Math.cos(a) * r;
        const cy = area.y + Math.sin(a) * r;
        if (!city.blocked(cx, cy, 11) && !city.inWater(cx, cy)) { x = cx; y = cy; break; }
      }
      state.thugs.push({
        x, y,
        angle: 0, hp: 100, fireCd: 1 + random(), speed: 120, dead: false,
      });
    }
  }

  function spawnMarkedCar(target) {
    const car = {
      x: target.x, y: target.y - 20, angle: Math.PI / 2, speed: 0, cruise: 0,
      color: '#e84c8a', kind: 'marked', driver: false, route: [], routeIdx: 0, stuck: 0,
    };
    state.cars.push(car);
    state.markedCar = state.cars.length - 1;
  }

  function activateStep() {
    const step = currentStep();
    if (!step) return;
    if (step.setWanted !== undefined) {
      state.wanted = Math.max(state.wanted, step.setWanted);
      state.lastCrime = state.time;
    }
    if (step.type === 'steal') spawnMarkedCar(step.target);
    if (step.type === 'defeat') {
      state.defeated = 0;
      spawnThugs(step.area, step.count);
    }
    state.banner = step.text;
    say(step.text, 5);
  }

  function advanceStep() {
    const mission = currentMission();
    state.stepIdx += 1;
    if (state.stepIdx >= mission.steps.length) {
      state.player.money += mission.reward;
      say(`MISSION COMPLETE: ${mission.title} — $${mission.reward}`, 5);
      state.missionIdx += 1;
      state.stepIdx = 0;
      if (state.missionIdx >= MISSIONS.length) {
        state.storyDone = true;
        return EVENT_STORY;
      }
      activateStep();
      return EVENT_MISSION;
    }
    activateStep();
    return EVENT_MISSION;
  }

  function damagePlayer(amount) {
    if (state.player.invuln > 0) return EVENT_NONE;
    state.player.hp -= amount;
    state.player.invuln = 0.4;
    state.shake = 6;
    if (state.player.hp <= 0) {
      state.player.hp = 0;
      return wastePlayer();
    }
    return EVENT_HIT;
  }

  function wastePlayer() {
    state.wasted = true;
    state.player.money = Math.max(0, state.player.money - FINE);
    state.wanted = Math.max(0, state.wanted - 2);
    state.player.hp = PLAYER.hp;
    state.player.inCar = -1;
    state.player.x = PLACES.hospital.x;
    state.player.y = PLACES.hospital.y;
    state.cops = [];
    state.thugs = state.thugs.filter((t) => !t.dead);
    return EVENT_WASTED;
  }

  function bustPlayer() {
    state.busted = true;
    state.player.money = Math.max(0, state.player.money - FINE);
    state.wanted = 0;
    state.player.inCar = -1;
    state.player.x = PLACES.policeStation.x;
    state.player.y = PLACES.policeStation.y;
    state.player.hp = PLAYER.hp;
    state.cops = [];
    state.thugs = state.thugs.filter((t) => !t.dead);
    return EVENT_BUSTED;
  }

  function addParts(x, y, n, color, speed = 160) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * TWO_PI;
      const s = speed * (0.4 + random() * 0.8);
      state.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + random() * 0.4, maxLife: 0.9, color, size: 2 + random() * 3 });
    }
  }

  function fireBullet(from, x, y, angle, speed, damage) {
    state.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, from, damage, life: PLAYER.pistolRange / speed });
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    if (p.inCar >= 0) {
      const car = state.cars[p.inCar];
      if (!car) { p.inCar = -1; return EVENT_NONE; }
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      if (input.up) car.speed += CAR.accel * dt;
      if (input.down) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.6) * dt;
      if (!input.up && !input.down) car.speed -= Math.sign(car.speed) * 140 * dt;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      if (Math.abs(car.speed) < 4) car.speed = 0;
      car.angle += steer * CAR.turn * dt * clamp(Math.abs(car.speed) / 120, 0.3, 1) * Math.sign(car.speed || 1);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const moved = city.moveCircle(car.x, car.y, nx - car.x, ny - car.y, 26);
      if ((moved.x === car.x && Math.abs(nx - car.x) > 0.01) || (moved.y === car.y && Math.abs(ny - car.y) > 0.01)) {
        // A hard hit hurts; a scrape just slides along the wall, so the car
        // keeps its speed and can turn away instead of grinding to a stop.
        if (Math.abs(car.speed) > 260) return crashCar(car);
      }
      car.x = moved.x;
      car.y = moved.y;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = car.speed;
      // Running over pedestrians.
      for (const ped of state.peds) {
        if (ped.dead) continue;
        if (dist(ped.x, ped.y, car.x, car.y) < 34 && Math.abs(car.speed) > 120) {
          ped.dead = true;
          ped.fade = 0;
          addParts(ped.x, ped.y, 10, '#c94b4b');
          const rose = addWanted(WANTED.hitPed);
          say('Pedestrian hit! The cops are coming.', 3);
          if (rose) return EVENT_WANTED_UP;
        }
      }
      return EVENT_NONE;
    }
    // On foot.
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1;
    const mx = (dx / len) * PLAYER.walkSpeed * dt * (dx || dy ? 1 : 0);
    const my = (dy / len) * PLAYER.walkSpeed * dt * (dx || dy ? 1 : 0);
    const moved = city.moveCircle(p.x, p.y, mx, my, PLAYER.radius);
    p.x = moved.x;
    p.y = moved.y;
    if (dx || dy) p.angle = Math.atan2(dy, dx);
    p.speed = (dx || dy) ? PLAYER.walkSpeed : 0;
    if (input.mouseActive) {
      p.aimAngle = Math.atan2(state.camera.y + input.mouseY - p.y, state.camera.x + input.mouseX - p.x);
    } else {
      p.aimAngle = p.angle;
    }
    if ((input.shoot || input.mouseDown) && p.fireCd <= 0) {
      if (p.ammo > 0) {
        p.ammo -= 1;
        p.fireCd = PLAYER.pistolRate;
        const a = p.aimAngle;
        fireBullet('player', p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, a, 900, PLAYER.pistolDamage);
        addParts(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, 3, '#ffd23e', 120);
        return EVENT_SHOT;
      }
    }
    return EVENT_NONE;
  }

  function crashCar(car) {
    car.speed *= -0.25;
    state.shake = 8;
    addParts(car.x, car.y, 8, '#9aa0ab');
    const ev = damagePlayer(3);
    return ev | EVENT_CRASH;
  }

  function stepEnterExit(input) {
    const p = state.player;
    if (!input.enter) return EVENT_NONE;
    if (p.inCar >= 0) {
      const car = state.cars[p.inCar];
      car.speed = 0;
      if (car.kind !== 'police') car.kind = 'parked';
      p.inCar = -1;
      const side = city.moveCircle(car.x, car.y, Math.cos(car.angle + Math.PI / 2) * 44, Math.sin(car.angle + Math.PI / 2) * 44, PLAYER.radius);
      p.x = side.x;
      p.y = side.y;
      return EVENT_NONE;
    }
    let best = -1;
    let bd = 80;
    for (let i = 0; i < state.cars.length; i += 1) {
      const car = state.cars[i];
      if (car.kind === 'police' && state.wanted > 0) continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) return EVENT_NONE;
    const car = state.cars[best];
    if (car.driver && car.kind === 'traffic') {
      // Carjacking: the driver bails and runs, and the law notices.
      const driver = spawnPed(car.x, car.y);
      driver.state = 'flee';
      driver.fleeT = 3;
      driver.fx = p.x;
      driver.fy = p.y;
      state.peds.push(driver);
      car.driver = false;
      const rose = addWanted(WANTED.steal);
      say('Car stolen!', 3);
      p.inCar = best;
      car.kind = 'parked';
      return rose ? EVENT_WANTED_UP : EVENT_NONE;
    }
    p.inCar = best;
    if (car.kind === 'marked') {
      car.kind = 'parked';
      const step = currentStep();
      if (step && step.type === 'steal') return advanceStep() | EVENT_MISSION;
    }
    return EVENT_NONE;
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic' || !car.driver) continue;
      const node = car.route[car.routeIdx % car.route.length];
      const target = angleTo(car.x, car.y, node.x, node.y);
      const d = angleDiff(car.angle, target);
      car.angle += clamp(d, -2.2 * dt, 2.2 * dt);
      // Slow down for the car ahead.
      let ahead = false;
      for (const other of state.cars) {
        if (other === car) continue;
        const dd = dist(car.x, car.y, other.x, other.y);
        if (dd < 72) {
          const a = angleTo(car.x, car.y, other.x, other.y);
          if (Math.abs(angleDiff(car.angle, a)) < 0.6) { ahead = true; break; }
        }
      }
      const want = ahead ? 0 : car.cruise;
      car.speed += clamp(want - car.speed, -500 * dt, 300 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const moved = city.moveCircle(car.x, car.y, nx - car.x, ny - car.y, 26);
      car.x = moved.x;
      car.y = moved.y;
      if (dist(car.x, car.y, node.x, node.y) < 50) {
        car.routeIdx += 1;
        if (car.routeIdx >= car.route.length) {
          const last = car.route[car.route.length - 1];
          const next = pick(random, city.intersections.filter((n) => n !== last));
          car.route = [last, next];
          car.routeIdx = 1;
        }
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of state.peds) {
      if (ped.dead) { ped.fade += dt; continue; }
      if (ped.state === 'flee') {
        ped.fleeT -= dt;
        if (ped.fleeT <= 0) ped.state = 'walk';
        const a = angleTo(ped.fx, ped.fy, ped.x, ped.y);
        const moved = city.moveCircle(ped.x, ped.y, Math.cos(a) * 170 * dt, Math.sin(a) * 170 * dt, 10);
        ped.x = moved.x;
        ped.y = moved.y;
        ped.angle = a;
        continue;
      }
      // Amble along the sidewalk; turn at intersections.
      if (random() < dt * 0.12) {
        ped.angle = ped.angle + pick(random, [0, Math.PI / 2, -Math.PI / 2, Math.PI]);
      }
      const moved = city.moveCircle(ped.x, ped.y, Math.cos(ped.angle) * ped.speed * dt, Math.sin(ped.angle) * ped.speed * dt, 10);
      if (moved.x === ped.x && moved.y === ped.y) ped.angle += Math.PI / 2;
      ped.x = moved.x;
      ped.y = moved.y;
      // Keep to the sidewalk: drift back toward the nearest road.
      if (!city.onSidewalk(ped.x, ped.y) && !city.onRoad(ped.x, ped.y)) {
        const near = city.nearestIntersection(ped.x, ped.y);
        ped.angle = angleTo(ped.x, ped.y, near.x, near.y);
      }
    }
    state.peds = state.peds.filter((ped) => !ped.dead || ped.fade < 4);
  }

  function spawnPoliceCar() {
    const p = state.player;
    const a = random() * TWO_PI;
    const x = clamp(p.x + Math.cos(a) * POLICE.spawnDistance, 100, WORLD.width - 100);
    const y = clamp(p.y + Math.sin(a) * POLICE.spawnDistance, 100, WORLD.height - 100);
    const near = city.nearestIntersection(x, y);
    state.cars.push({
      x: near.x, y: near.y, angle: angleTo(near.x, near.y, p.x, p.y), speed: 200, cruise: POLICE.carSpeed,
      color: PALETTE.policeCar, kind: 'police', driver: true, route: [], routeIdx: 0, stuck: 0,
    });
  }

  function spawnFootCop() {
    const p = state.player;
    const a = random() * TWO_PI;
    const x = clamp(p.x + Math.cos(a) * POLICE.spawnDistance, 100, WORLD.width - 100);
    const y = clamp(p.y + Math.sin(a) * POLICE.spawnDistance, 100, WORLD.height - 100);
    state.cops.push({ x, y, angle: 0, hp: 100, fireCd: 1 + random() * 1.5 });
  }

  function stepPolice(dt) {
    const p = state.player;
    const stars = Math.ceil(state.wanted);
    state.policeSpawnT -= dt;
    if (stars > 0 && state.policeSpawnT <= 0) {
      const policeCars = state.cars.filter((c) => c.kind === 'police').length;
      if (stars >= 2 && policeCars < Math.min(POLICE.maxCars, stars)) spawnPoliceCar();
      else if (state.cops.length < Math.min(POLICE.maxFoot, stars + 1)) spawnFootCop();
      state.policeSpawnT = 1.6;
    }
    // Foot cops chase the player; arrest on touch when the player is on foot.
    for (const cop of state.cops) {
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (d > 900) continue;
      const a = angleTo(cop.x, cop.y, p.x, p.y);
      cop.angle = a;
      const moved = city.moveCircle(cop.x, cop.y, Math.cos(a) * POLICE.footSpeed * dt, Math.sin(a) * POLICE.footSpeed * dt, 11);
      cop.x = moved.x;
      cop.y = moved.y;
      if (d < POLICE.arrestRange && p.inCar < 0 && p.invuln <= 0) {
        return bustPlayer();
      }
      // Cops shoot when the heat is high.
      if (stars >= 3 && d < 380 && d > 60) {
        cop.fireCd -= dt;
        if (cop.fireCd <= 0) {
          cop.fireCd = 1.1 + random() * 0.7;
          fireBullet('enemy', cop.x, cop.y, a + (random() - 0.5) * 0.24, 700, 8);
        }
      }
    }
    // Police cars ram the player's car; on foot they pull up short and the
    // foot cops do the arresting, so they do not sit on top of the player.
    // They also ease off when another car is right ahead, like traffic does.
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      const target = angleTo(car.x, car.y, p.x, p.y);
      const d = angleDiff(car.angle, target);
      car.angle += clamp(d, -3.0 * dt, 3.0 * dt);
      const pdist = dist(car.x, car.y, p.x, p.y);
      let want = pdist > 90 ? POLICE.carSpeed : POLICE.carSpeed * 0.55;
      if (p.inCar < 0 && pdist < 110) want = 0;
      for (const other of state.cars) {
        if (other === car) continue;
        if (dist(car.x, car.y, other.x, other.y) < 60) { want = Math.min(want, 120); break; }
      }
      car.speed += clamp(want - car.speed, -700 * dt, 500 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const moved = city.moveCircle(car.x, car.y, nx - car.x, ny - car.y, 26);
      car.x = moved.x;
      car.y = moved.y;
      car.ramCd = Math.max(0, (car.ramCd || 0) - dt);
      if (p.inCar >= 0 && car.ramCd <= 0) {
        const pc = state.cars[p.inCar];
        if (pc && dist(car.x, car.y, pc.x, pc.y) < 56) {
          pc.speed *= 0.85;
          car.speed *= 0.7;
          car.ramCd = 1.2;
          const ev = damagePlayer(3);
          if (ev & (EVENT_BUSTED | EVENT_WASTED)) return ev;
          addParts(pc.x, pc.y, 4, '#e8d44d');
        }
      }
    }
    return EVENT_NONE;
  }

  function stepThugs(dt) {
    const p = state.player;
    for (const thug of state.thugs) {
      if (thug.dead) continue;
      const d = dist(thug.x, thug.y, p.x, p.y);
      if (d < 520) {
        const a = angleTo(thug.x, thug.y, p.x, p.y);
        thug.angle = a;
        if (d > 180) {
          const moved = city.moveCircle(thug.x, thug.y, Math.cos(a) * thug.speed * dt, Math.sin(a) * thug.speed * dt, 11);
          thug.x = moved.x;
          thug.y = moved.y;
        }
        thug.fireCd -= dt;
        if (thug.fireCd <= 0 && d < 460) {
          thug.fireCd = 0.9 + random() * 0.8;
          fireBullet('enemy', thug.x, thug.y, a + (random() - 0.5) * 0.2, 720, 8);
        }
      }
    }
  }

  function stepBullets(dt) {
    const p = state.player;
    let events = EVENT_NONE;
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || city.blocked(b.x, b.y, 2)) {
        b.life = 0;
        if (city.blocked(b.x, b.y, 2)) addParts(b.x, b.y, 3, '#9aa0ab', 80);
        continue;
      }
      if (b.from === 'player') {
        let consumed = false;
        for (const ped of state.peds) {
          if (!ped.dead && dist(b.x, b.y, ped.x, ped.y) < 14) {
            ped.dead = true;
            ped.fade = 0;
            b.life = 0;
            consumed = true;
            addParts(ped.x, ped.y, 10, '#c94b4b');
            addWanted(WANTED.shoot);
            break;
          }
        }
        if (!consumed) for (const cop of state.cops) {
          if (dist(b.x, b.y, cop.x, cop.y) < 14) {
            cop.hp -= b.damage;
            b.life = 0;
            consumed = true;
            addParts(cop.x, cop.y, 8, '#c94b4b');
            if (cop.hp <= 0) {
              state.cops = state.cops.filter((c) => c !== cop);
              addWanted(WANTED.killCop);
              say('You took down a cop. The whole harbor is after you now.', 3);
            } else addWanted(WANTED.shoot);
            break;
          }
        }
        if (!consumed) for (const thug of state.thugs) {
          if (!thug.dead && dist(b.x, b.y, thug.x, thug.y) < 14) {
            thug.hp -= b.damage;
            b.life = 0;
            consumed = true;
            addParts(thug.x, thug.y, 8, '#c94b4b');
            if (thug.hp <= 0) {
              thug.dead = true;
              state.defeated += 1;
              const step = currentStep();
              if (step && step.type === 'defeat' && state.defeated >= step.count) {
                events |= advanceStep();
              }
            }
            break;
          }
        }
        if (!consumed) for (const car of state.cars) {
          if (car.kind === 'police' && dist(b.x, b.y, car.x, car.y) < 30) {
            b.life = 0;
            addParts(b.x, b.y, 4, '#e8d44d');
            addWanted(WANTED.shoot);
            break;
          }
        }
      } else if (dist(b.x, b.y, p.x, p.y) < (p.inCar >= 0 ? 30 : 13)) {
        b.life = 0;
        const ev = damagePlayer(b.damage);
        events |= ev;
        if (ev & (EVENT_BUSTED | EVENT_WASTED)) return events;
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    return events;
  }

  function stepPickups(dt) {
    const p = state.player;
    for (const pk of state.pickups) {
      if (pk.taken) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) pk.taken = false;
        continue;
      }
      if (p.inCar < 0 && dist(p.x, p.y, pk.x, pk.y) < 30) {
        pk.taken = true;
        pk.respawn = 45;
        if (pk.kind === 'ammo') {
          p.ammo = Math.min(PLAYER.maxAmmo, p.ammo + 48);
          say('Picked up ammo (+48).', 2);
        } else {
          p.hp = Math.min(PLAYER.hp, p.hp + 40);
          say('Picked up a medkit (+40 health).', 2);
        }
        return EVENT_PICKUP;
      }
    }
    return EVENT_NONE;
  }

  function stepMission(dt) {
    const step = currentStep();
    if (!step || state.busted || state.wasted) return EVENT_NONE;
    const p = state.player;
    if (step.type === 'goto' || step.type === 'deliver') {
      const needCar = step.needCar === true;
      if (dist(p.x, p.y, step.target.x, step.target.y) < step.target.r && (!needCar || p.inCar >= 0)) {
        return advanceStep();
      }
    } else if (step.type === 'pickup') {
      if (p.inCar < 0 && dist(p.x, p.y, step.target.x, step.target.y) < step.target.r) {
        p.hasPackage = true;
        return advanceStep();
      }
    }
    return EVENT_NONE;
  }

  function stepWanted(dt) {
    if (state.wanted > 0 && state.time - state.lastCrime > WANTED.decayDelay) {
      const nearCop = state.cops.some((c) => dist(c.x, c.y, state.player.x, state.player.y) < 500)
        || state.cars.some((c) => c.kind === 'police' && dist(c.x, c.y, state.player.x, state.player.y) < 500);
      if (!nearCop) state.wanted = Math.max(0, state.wanted - WANTED.decayRate * dt);
    }
  }

  function stepCamera(dt) {
    const p = state.player;
    const tx = clamp(p.x - 640, 0, WORLD.width - 1280);
    const ty = clamp(p.y - 360, 0, WORLD.height - 720);
    state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 6);
    state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 6);
    state.shake = Math.max(0, state.shake - dt * 22);
  }

  function step(dt, input, demo) {
    let events = EVENT_NONE;
    state.time += dt;
    if (state.toastT > 0) state.toastT -= dt;
    if (state.busted || state.wasted) return EVENT_NONE;
    if (!demo) {
      events |= stepPlayer(dt, input);
      if (events & (EVENT_BUSTED | EVENT_WASTED)) return events;
      events |= stepEnterExit(input);
      events |= stepPolice(dt);
      if (events & (EVENT_BUSTED | EVENT_WASTED)) return events;
      events |= stepThugs(dt);
      events |= stepBullets(dt);
      if (events & (EVENT_BUSTED | EVENT_WASTED)) return events;
      events |= stepPickups(dt);
      events |= stepMission(dt);
      stepWanted(dt);
    }
    stepTraffic(dt);
    stepPeds(dt);
    for (const part of state.parts) {
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.life -= dt;
    }
    state.parts = state.parts.filter((pt) => pt.life > 0);
    stepCamera(dt);
    state.step = currentStep();
    return events;
  }

  function getSave() {
    return { missionIdx: state.missionIdx, money: state.player.money };
  }

  function applySave(save) {
    if (!save) return;
    state.missionIdx = clamp(save.missionIdx | 0, 0, MISSIONS.length - 1);
    state.player.money = Math.max(0, save.money | 0);
    state.stepIdx = 0;
    state.defeated = 0;
    activateStep();
  }

  reset();

  return {
    // `state` is a getter: reset() replaces the object, and readers must always
    // see the current one, never a stale snapshot from before the reset.
    get state() { return state; },
    city, reset, step, currentMission, currentStep, activateStep,
    getSave, applySave, say,
  };
}
