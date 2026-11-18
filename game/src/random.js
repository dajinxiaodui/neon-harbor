// A small seeded random number generator (splitmix32): the same seed gives the
// same city, the same traffic and the same screenshot scenes, which is what
// makes the game repeatable and the staged screenshots stable.
export function createRandom(seed) {
  let a = (seed | 0) >>> 0;
  return function random() {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    t ^= t >>> 15;
    return (t >>> 0) / 4294967296;
  };
}

/** Pick one item of `list` with the seeded random. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/** An integer in [min, max] from the seeded random. */
export function intBetween(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}
