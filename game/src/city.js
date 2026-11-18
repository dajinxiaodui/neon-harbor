// Neon Harbor's map: a fixed grid of roads, blocks of buildings, a park, and a
// beach along the south edge. Everything is laid out from a seeded random, so
// the city is the same every visit. Cars drive on the road graph (the list of
// intersections); pedestrians walk on the sidewalks beside the roads.
import { WORLD, PALETTE } from './config.js';
import { intBetween, pick } from './random.js';

export const ROAD_W = 110;
export const ROADS_V = [400, 900, 1400, 1900, 2400, 2900];
export const ROADS_H = [350, 800, 1250, 1700, 2050];
export const BEACH_Y = 2150;

function onRoad(x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

function onSidewalk(x, y) {
  for (const rx of ROADS_V) {
    const d = Math.abs(x - rx);
    if (d > ROAD_W / 2 && d <= ROAD_W / 2 + 22) return true;
  }
  for (const ry of ROADS_H) {
    const d = Math.abs(y - ry);
    if (d > ROAD_W / 2 && d <= ROAD_W / 2 + 22) return true;
  }
  return false;
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  // One block = the space between two neighbouring roads. Fill each block with
  // one or two buildings, except the park block and the beach strip.
  const park = { x0: 1400 + ROAD_W / 2 + 30, y0: 800 + ROAD_W / 2 + 30, x1: 1900 - ROAD_W / 2 - 30, y1: 1250 - ROAD_W / 2 - 30 };
  for (let vi = 0; vi < ROADS_V.length - 1; vi += 1) {
    for (let hi = 0; hi < ROADS_H.length - 1; hi += 1) {
      const x0 = ROADS_V[vi] + ROAD_W / 2 + 28;
      const x1 = ROADS_V[vi + 1] - ROAD_W / 2 - 28;
      const y0 = ROADS_H[hi] + ROAD_W / 2 + 28;
      const y1 = ROADS_H[hi + 1] - ROAD_W / 2 - 28;
      if (y0 >= BEACH_Y - 40) continue;
      const isPark = x0 >= park.x0 - 40 && x1 <= park.x1 + 40 && y0 >= park.y0 - 40 && y1 <= park.y1 + 40;
      if (isPark) {
        for (let t = 0; t < 14; t += 1) {
          trees.push({ x: intBetween(random, x0 + 20, x1 - 20), y: intBetween(random, y0 + 20, y1 - 20), r: intBetween(random, 12, 20) });
        }
        continue;
      }
      const split = random() < 0.45;
      const color = pick(random, PALETTE.building);
      if (split) {
        const mid = x0 + (x1 - x0) * (0.42 + random() * 0.16);
        buildings.push({ x: x0, y: y0, w: mid - x0 - 14, h: y1 - y0, color, roof: pick(random, ['#5a5148', '#6b5a4a', '#4a4a55']) });
        buildings.push({ x: mid + 14, y: y0, w: x1 - mid - 14, h: y1 - y0, color: pick(random, PALETTE.building), roof: '#5a5148' });
      } else {
        buildings.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, color, roof: pick(random, ['#5a5148', '#6b5a4a', '#4a4a55']) });
      }
    }
  }

  const intersections = [];
  for (const rx of ROADS_V) for (const ry of ROADS_H) intersections.push({ x: rx, y: ry });

  function inWater(x, y) {
    return y >= BEACH_Y + 40;
  }

  function blocked(x, y, r) {
    if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
    if (inWater(x, y)) return true;
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }

  /** Move a circle from (x, y) by (dx, dy), sliding along walls instead of sticking. */
  function moveCircle(x, y, dx, dy, r) {
    let nx = x + dx;
    if (blocked(nx, y, r)) nx = x;
    let ny = y + dy;
    if (blocked(nx, ny, r)) ny = y;
    return { x: nx, y: ny };
  }

  function nearestIntersection(x, y) {
    let best = intersections[0];
    let bd = Infinity;
    for (const n of intersections) {
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  return {
    buildings, trees, park, intersections,
    onRoad, onSidewalk, inWater, blocked, moveCircle, nearestIntersection,
  };
}
