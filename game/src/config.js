// Every tuning number, colour and story beat in one place. The city is a fixed
// 3200 x 2400 world; the renderer shows a 1280 x 720 window of it, so no rule
// below depends on the screen size. All names, places and people are invented:
// Neon Harbor is a fictional sun-soaked coastal city, not a real place.

export const WORLD = { width: 3200, height: 2400 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The window the renderer paints, in logical pixels. */
export const VIEW = { width: 1280, height: 720 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 215,
  hp: 100,
  pistolDamage: 34,
  pistolRange: 560,
  pistolRate: 0.22,
  startAmmo: 48,
  maxAmmo: 240,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 420,
  brake: 700,
  maxSpeed: 560,
  maxReverse: 160,
  turn: 2.6,
  grip: 3.2,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 22;

export const WANTED = {
  steal: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 2,
  decayDelay: 10,
  decayRate: 0.25,
  max: 5,
};

export const POLICE = {
  footSpeed: 235,
  carSpeed: 590,
  arrestRange: 26,
  spawnDistance: 700,
  maxFoot: 6,
  maxCars: 5,
};

/** Money the player loses when busted or wasted. */
export const FINE = 200;

export const PALETTE = {
  grass: '#7fae5a',
  sand: '#e3cd8f',
  water: '#2f7fb8',
  road: '#3c414d',
  roadEdge: '#2c303a',
  sidewalk: '#9aa0ab',
  line: '#e8d44d',
  building: ['#b5654a', '#4a7a9e', '#8a6fa8', '#c98a4b', '#5d8a6a', '#9e4a5a'],
  roof: '#5a5148',
  park: '#5d9b4a',
  tree: '#2f6b2f',
  player: '#f2c94c',
  playerShirt: '#2f6fb8',
  ped: ['#d97b6c', '#6cb8d9', '#c9a86a', '#9b7fd4', '#7fc9a0'],
  policeCar: '#e8e8e8',
  policeTrim: '#1c2f5e',
  thug: '#8a2f2f',
  marker: '#ffd23e',
  markerRing: '#ffffff',
  hudBg: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f2f4f6',
  hudMuted: '#aab2bd',
  star: '#ffd23e',
  starEmpty: '#5a6270',
  health: '#4fc46a',
  healthLow: '#e5534b',
  title: '#ffd23e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'neon-harbor.save.v1';

// ---------------------------------------------------------------- missions
// The story: Danny Cole, a getaway driver new in Neon Harbor, takes jobs from
// fixer Mara Voss. Each mission is a list of steps; a step is done when its
// condition holds (reach a marker, pick something up, steal a marked car,
// defeat a set number of armed men, deliver a package). Rewards are in dollars.
export const MISSIONS = [
  {
    title: 'First Shift',
    brief: "Mara Voss runs jobs out of a garage on Harbor Row. Prove you can drive.",
    reward: 150,
    steps: [
      { type: 'goto', text: 'Get in a car and drive to the yellow marker', target: { x: 1450, y: 830, r: 70 }, needCar: true },
      { type: 'goto', text: "Drive to Mara's garage", target: { x: 1450, y: 790, r: 60 }, needCar: false },
    ],
  },
  {
    title: 'The Pickup',
    brief: 'A crate at the docks needs moving. No questions, no stops.',
    reward: 300,
    steps: [
      { type: 'goto', text: 'Drive to the docks', target: { x: 2830, y: 1980, r: 80 }, needCar: true },
      { type: 'pickup', text: 'Walk to the crate and grab the package', target: { x: 2890, y: 2050, r: 46 } },
      { type: 'deliver', text: 'Bring the package back to the garage', target: { x: 1450, y: 790, r: 60 } },
    ],
  },
  {
    title: 'Hot Wheels',
    brief: 'A Comet GT is parked uptown. Bring it home. The owner will not mind. The cops might.',
    reward: 450,
    steps: [
      { type: 'steal', text: 'Steal the marked Comet GT', target: { x: 2400, y: 350, r: 60 } },
      { type: 'deliver', text: 'Deliver the Comet GT to the garage — the cops are on you', target: { x: 1450, y: 790, r: 60 }, setWanted: 2 },
    ],
  },
  {
    title: 'Dockside Trouble',
    brief: 'The dock crew took Mara\'s money. Take it back.',
    reward: 600,
    steps: [
      { type: 'goto', text: 'Reach the docks', target: { x: 2830, y: 1980, r: 80 } },
      { type: 'defeat', text: 'Deal with the four armed men at the docks', count: 4, area: { x: 2830, y: 2000, r: 260 } },
      { type: 'goto', text: 'Escape to the safehouse', target: { x: 950, y: 1250, r: 70 }, setWanted: 3 },
    ],
  },
  {
    title: 'The Getaway',
    brief: 'One last package, one last drive. The whole harbor will be watching.',
    reward: 1000,
    steps: [
      { type: 'goto', text: 'Reach the docks and grab the package', target: { x: 2890, y: 2050, r: 46 } },
      { type: 'pickup', text: 'Grab the package — the heat is coming', target: { x: 2890, y: 2050, r: 46 }, setWanted: 4 },
      { type: 'deliver', text: 'Drive the package to the airstrip gate', target: { x: 420, y: 330, r: 70 }, needCar: true },
    ],
  },
];

export const PLACES = {
  garage: { x: 1450, y: 790, label: "Mara's Garage" },
  docks: { x: 2830, y: 1980, label: 'The Docks' },
  safehouse: { x: 950, y: 1250, label: 'Safehouse' },
  airstrip: { x: 420, y: 330, label: 'Airstrip' },
  policeStation: { x: 1950, y: 330, label: 'Police Station' },
  hospital: { x: 950, y: 350, label: 'Hospital' },
  spawn: { x: 1450, y: 900 },
};
