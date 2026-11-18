// Drawing only: the world's state and the current screen in, pixels out. The
// 1280 x 720 view is scaled to fit the window and centred, the margin filled
// with the backdrop colour. The camera follows the player across the 3200 x
// 2400 city; the HUD (health, money, wanted stars, minimap, objective) is
// drawn in screen space on top.
import { WORLD, VIEW, PALETTE, FONT, PLACES } from './config.js';
import { ROAD_W, ROADS_V, ROADS_H, BEACH_Y } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_STORY = 'story';

const MAP_W = 200;
const MAP_H = 150;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    const key = size + (align === 'center' ? 'c' : '') + (baseline === 'top' ? 't' : '');
    if (!fonts.has(key)) fonts.set(key, `${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function star(cx, cy, r, color) {
    context.fillStyle = color;
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
  }

  function drawCity(state, city) {
    const cam = state.camera;
    const shx = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shy = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.save();
    context.translate(-cam.x + shx, -cam.y + shy);

    // Ground, beach and water.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, BEACH_Y, WORLD.width, 44);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, BEACH_Y + 44, WORLD.width, WORLD.height - BEACH_Y - 44);
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 3;
    for (let x = 0; x < WORLD.width; x += 160) {
      context.beginPath();
      context.moveTo(x, BEACH_Y + 56 + 6 * Math.sin(x * 0.01 + state.time));
      context.lineTo(x + 90, BEACH_Y + 56 + 6 * Math.sin(x * 0.01 + state.time));
      context.stroke();
    }
    // Park.
    context.fillStyle = PALETTE.park;
    context.fillRect(city.park.x0, city.park.y0, city.park.x1 - city.park.x0, city.park.y1 - city.park.y0);
    for (const t of city.trees) {
      context.fillStyle = PALETTE.tree;
      context.beginPath();
      context.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      context.fill();
    }
    // Roads: sidewalk, asphalt, centre dashes.
    for (const rx of ROADS_V) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(rx - ROAD_W / 2 - 22, 0, ROAD_W + 44, WORLD.height);
      context.fillStyle = PALETTE.road;
      context.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    }
    for (const ry of ROADS_H) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, ry - ROAD_W / 2 - 22, WORLD.width, ROAD_W + 44);
      context.fillStyle = PALETTE.road;
      context.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    }
    context.fillStyle = PALETTE.line;
    for (const rx of ROADS_V) {
      for (let y = 40; y < WORLD.height; y += 90) context.fillRect(rx - 3, y, 6, 44);
    }
    for (const ry of ROADS_H) {
      for (let x = 40; x < WORLD.width; x += 90) context.fillRect(x, ry - 3, 44, 6);
    }
    // Buildings with a shadow, a roof and a few lit windows.
    for (const b of city.buildings) {
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
      context.fillStyle = 'rgba(255,230,140,0.75)';
      const cols = Math.floor((b.w - 30) / 34);
      const rows = Math.floor((b.h - 30) / 34);
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if (((b.x * 7 + b.y * 13 + i * 5 + j * 11) % 5) < 2) {
            context.fillRect(b.x + 18 + i * 34, b.y + 18 + j * 34, 12, 14);
          }
        }
      }
    }
    // Place signs.
    context.textAlign = 'center';
    text("MARA'S GARAGE", PLACES.garage.x, PLACES.garage.y - 30, 15, '#3a2f1e', 'center');
    text('THE DOCKS', PLACES.docks.x, PLACES.docks.y - 60, 15, '#3a2f1e', 'center');
    text('AIRSTRIP', PLACES.airstrip.x, PLACES.airstrip.y - 30, 15, '#3a2f1e', 'center');
    text('SAFEHOUSE', PLACES.safehouse.x, PLACES.safehouse.y - 30, 15, '#3a2f1e', 'center');
    text('HOSPITAL', PLACES.hospital.x, PLACES.hospital.y - 30, 15, '#3a2f1e', 'center');
    text('POLICE STATION', PLACES.policeStation.x, PLACES.policeStation.y - 30, 15, '#3a2f1e', 'center');
    context.textAlign = 'left';

    drawMarker(state);
    drawPickups(state);
    drawCars(state);
    drawPeds(state);
    drawCops(state);
    drawThugs(state);
    drawPlayer(state);
    drawBullets(state);
    drawParts(state);
    context.restore();
  }

  function drawMarker(state) {
    const mission = state.missionIdx;
    const step = state.step;
    if (!step || !step.target) return;
    const t = step.target;
    const pulse = 1 + 0.18 * Math.sin(state.time * 5);
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(t.x, t.y, t.r * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = 'rgba(255, 210, 62, 0.25)';
    context.beginPath();
    context.arc(t.x, t.y, t.r * pulse, 0, Math.PI * 2);
    context.fill();
    // A beam so the marker reads from a distance.
    context.fillStyle = 'rgba(255, 210, 62, 0.35)';
    context.fillRect(t.x - 4, t.y - 190, 8, 190);
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(state.time * 3 + pk.x) * 3;
      if (pk.kind === 'ammo') {
        context.fillStyle = '#8a6a2f';
        context.fillRect(pk.x - 12, pk.y - 10 + bob, 24, 20);
        context.fillStyle = '#ffd23e';
        context.fillRect(pk.x - 8, pk.y - 5 + bob, 16, 4);
        context.fillRect(pk.x - 8, pk.y + 2 + bob, 16, 4);
      } else {
        context.fillStyle = '#f2f4f6';
        context.fillRect(pk.x - 12, pk.y - 12 + bob, 24, 24);
        context.fillStyle = '#e5534b';
        context.fillRect(pk.x - 3, pk.y - 9 + bob, 6, 18);
        context.fillRect(pk.x - 9, pk.y - 3 + bob, 18, 6);
      }
    }
  }

  function drawCarShape(car, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    if (isPlayer) {
      context.strokeStyle = 'rgba(255, 210, 62, 0.9)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(0, 0, 44, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(-30, -12, 64, 32);
    context.fillStyle = car.color;
    context.fillRect(-32, -15, 64, 30);
    context.fillStyle = car.kind === 'police' ? PALETTE.policeTrim : '#222831';
    context.fillRect(-8, -12, 22, 24);
    // Windows.
    context.fillStyle = '#9fc4d8';
    context.fillRect(14, -11, 10, 22);
    context.fillRect(-28, -11, 6, 22);
    // Headlights.
    context.fillStyle = '#ffe9a8';
    context.beginPath();
    context.arc(32, -10, 4, 0, Math.PI * 2);
    context.arc(32, 10, 4, 0, Math.PI * 2);
    context.fill();
    if (car.kind === 'police') {
      const flash = Math.floor(stateTime() * 6) % 2 === 0;
      context.fillStyle = flash ? '#e5534b' : '#3f6fd8';
      context.fillRect(-4, -15, 10, 6);
      context.fillStyle = flash ? '#3f6fd8' : '#e5534b';
      context.fillRect(-4, 9, 10, 6);
    }
    if (car.kind === 'marked') {
      context.fillStyle = '#ffffff';
      text('$', 0, 4, 20, '#ffffff', 'center');
    }
    context.restore();
  }

  let now = 0;
  function stateTime() {
    return now;
  }

  function drawCars(state) {
    for (const car of state.cars) {
      drawCarShape(car, state.player.inCar >= 0 && state.cars[state.player.inCar] === car);
    }
  }

  function drawPerson(x, y, angle, shirt, hat) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8c39a';
    context.beginPath();
    context.arc(5, 0, 6, 0, Math.PI * 2);
    context.fill();
    if (hat) {
      context.fillStyle = hat;
      context.beginPath();
      context.arc(5, 0, 6.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#e8c39a';
      context.beginPath();
      context.arc(6, 0, 4, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawPeds(state) {
    for (const ped of state.peds) {
      if (ped.dead) {
        context.save();
        context.globalAlpha = Math.max(0, 1 - ped.fade / 4);
        context.translate(ped.x, ped.y);
        context.rotate(ped.angle + Math.PI / 2);
        context.fillStyle = ped.color;
        context.fillRect(-12, -5, 24, 10);
        context.restore();
        context.globalAlpha = 1;
        continue;
      }
      drawPerson(ped.x, ped.y, ped.angle, ped.color, null);
    }
  }

  function drawCops(state) {
    for (const cop of state.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#1c2f5e', '#16233f');
    }
  }

  function drawThugs(state) {
    for (const thug of state.thugs) {
      if (thug.dead) continue;
      drawPerson(thug.x, thug.y, thug.angle, '#8a2f2f', null);
      context.strokeStyle = '#222831';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(thug.x, thug.y);
      context.lineTo(thug.x + Math.cos(thug.angle) * 22, thug.y + Math.sin(thug.angle) * 22);
      context.stroke();
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.inCar >= 0) return;
    if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0) return;
    context.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(p.x, p.y, 17, 0, Math.PI * 2);
    context.stroke();
    drawPerson(p.x, p.y, p.aimAngle, PALETTE.playerShirt, null);
    context.fillStyle = '#ffd23e';
    context.beginPath();
    context.arc(p.x, p.y, 4, 0, Math.PI * 2);
    context.fill();
    // Gun barrel toward the aim.
    context.strokeStyle = '#222831';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(p.x, p.y);
    context.lineTo(p.x + Math.cos(p.aimAngle) * 24, p.y + Math.sin(p.aimAngle) * 24);
    context.stroke();
  }

  function drawBullets(state) {
    context.fillStyle = '#ffe9a8';
    for (const b of state.bullets) {
      context.save();
      context.translate(b.x, b.y);
      context.rotate(Math.atan2(b.vy, b.vx));
      context.fillRect(-6, -2, 12, 4);
      context.restore();
    }
  }

  function drawParts(state) {
    for (const pt of state.parts) {
      context.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      context.fillStyle = pt.color;
      context.beginPath();
      context.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, save) {
    const p = state.player;
    // Top-left: health, money, ammo.
    context.fillStyle = PALETTE.hudBg;
    context.fillRect(16, 14, 250, 74);
    text('HEALTH', 28, 30, 13, PALETTE.hudMuted, 'left', 'top');
    context.fillStyle = '#2a2f3a';
    context.fillRect(28, 36, 180, 12);
    context.fillStyle = p.hp > 35 ? PALETTE.health : PALETTE.healthLow;
    context.fillRect(28, 36, Math.max(0, 180 * (p.hp / 100)), 12);
    text(`$${p.money}`, 28, 62, 20, PALETTE.hudText, 'left', 'top');
    text(`PISTOL ${p.ammo}`, 150, 62, 16, PALETTE.hudMuted, 'left', 'top');
    // Top-right: wanted stars.
    const stars = Math.ceil(state.wanted);
    context.fillStyle = PALETTE.hudBg;
    context.fillRect(VIEW.width - 226, 14, 210, 44);
    text('WANTED', VIEW.width - 214, 26, 13, PALETTE.hudMuted, 'left', 'top');
    for (let i = 0; i < 5; i += 1) {
      star(VIEW.width - 60 + i * 30, 36, 11, i < stars ? PALETTE.star : PALETTE.starEmpty);
    }
    // Top-centre: objective banner and toast.
    if (state.banner) {
      context.font = `16px ${FONT}`;
      const bw = context.measureText(state.banner).width + 32;
      context.fillStyle = PALETTE.hudBg;
      context.fillRect(VIEW.width / 2 - bw / 2, 14, bw, 30);
      text(state.banner, VIEW.width / 2, 35, 16, PALETTE.title, 'center', 'top');
    }
    if (state.toastT > 0 && state.toast) {
      context.font = `18px ${FONT}`;
      const tw = context.measureText(state.toast).width + 28;
      context.fillStyle = 'rgba(12, 16, 24, 0.85)';
      context.fillRect(VIEW.width / 2 - tw / 2, 52, tw, 30);
      text(state.toast, VIEW.width / 2, 74, 18, PALETTE.hudText, 'center', 'top');
    }
    // Bottom-left: controls and speed.
    context.fillStyle = PALETTE.hudBg;
    context.fillRect(16, VIEW.height - 52, 330, 36);
    text('WASD move/drive · E enter car · F shoot · P pause · M mute', 28, VIEW.height - 40, 13, PALETTE.hudMuted, 'left', 'top');
    if (p.inCar >= 0) {
      text(`${Math.round(Math.abs(p.speed) * 0.22)} mph`, 28, VIEW.height - 24, 14, PALETTE.hudText, 'left', 'top');
    } else if (p.hasPackage) {
      text('PACKAGE — deliver it', 28, VIEW.height - 24, 14, PALETTE.title, 'left', 'top');
    }
    drawMinimap(state);
    // Low-health vignette.
    if (p.hp < 40) {
      const a = (40 - p.hp) / 40 * 0.35;
      context.fillStyle = `rgba(229, 83, 75, ${a})`;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  function drawMinimap(state) {
    const mx = VIEW.width - MAP_W - 16;
    const my = VIEW.height - MAP_H - 16;
    const sx = MAP_W / WORLD.width;
    const sy = MAP_H / WORLD.height;
    context.fillStyle = 'rgba(12, 16, 24, 0.8)';
    context.fillRect(mx, my, MAP_W, MAP_H);
    context.fillStyle = PALETTE.water;
    context.fillRect(mx, my + (BEACH_Y + 44) * sy, MAP_W, MAP_H - (BEACH_Y + 44) * sy);
    context.strokeStyle = '#8b93a3';
    context.lineWidth = 2;
    for (const rx of ROADS_V) {
      context.beginPath();
      context.moveTo(mx + rx * sx, my);
      context.lineTo(mx + rx * sx, my + MAP_H);
      context.stroke();
    }
    for (const ry of ROADS_H) {
      context.beginPath();
      context.moveTo(mx, my + ry * sy);
      context.lineTo(mx + MAP_W, my + ry * sy);
      context.stroke();
    }
    const step = state.step;
    if (step && step.target) {
      const pulse = 3 + 2 * Math.sin(state.time * 5);
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(mx + step.target.x * sx, my + step.target.y * sy, pulse, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      context.fillStyle = '#e5534b';
      context.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
    }
    const p = state.player;
    context.save();
    context.translate(mx + p.x * sx, my + p.y * sy);
    context.rotate(p.angle);
    context.fillStyle = PALETTE.title;
    context.beginPath();
    context.moveTo(7, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 34 + 60;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(12, 16, 24, 0.88)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.title;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 72, 46, accent || PALETTE.title, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 130 + i * 34, 20, PALETTE.hudMuted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 34, 22, PALETTE.title, 'center');
  }

  /** Paint one frame: the city, then the HUD or a panel for the screen the game is on. */
  function draw(state, city, screen, save) {
    now = state.time;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b0e14';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawCity(state, city);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'Danny Cole, getaway driver, new in Neon Harbor.',
        'Mara Voss has work for you — five jobs, one way out.',
        'Steal cars, lose the cops, finish the story.',
        'WASD move and drive · E enter a car · F or click to shoot · P pause',
      ];
      if (save && save.missionIdx > 0) {
        lines.push(`Continue: mission ${save.missionIdx + 1} of 5 · $${save.money} in the bank`);
      }
      drawPanel('NEON HARBOR', lines, 'Press SPACE or click to start', PALETTE.title);
      return;
    }
    drawHud(state, save);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The harbor waits for you.'], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Harbor PD caught you.', `-$${200} fine. Your car is gone.`], 'Press SPACE to walk free', '#3f6fd8');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['You woke up in Harbor General.', `-$${200} hospital bill.`], 'Press SPACE to get back out there', PALETTE.healthLow);
    } else if (screen === SCREEN_STORY) {
      drawPanel('THE GETAWAY — DONE', [`You finished all five jobs for Mara Voss.`, `Banked $${state.player.money}. Neon Harbor is yours now.`, 'Free roam: steal cars, dodge the law, keep the money.'], 'Press SPACE to keep playing');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    /** Convert a mouse position in CSS pixels to logical view coordinates. */
    toLogical(clientX, clientY) {
      const ratio = window.devicePixelRatio || 1;
      return {
        x: (clientX * ratio - view.x) / view.scale,
        y: (clientY * ratio - view.y) / view.scale,
      };
    },
  };
}
