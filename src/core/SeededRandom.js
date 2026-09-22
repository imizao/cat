function hash32(value) {
  let x = value >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

export function floorSeed(worldSeed, floorIndex, salt = 0) {
  return hash32((worldSeed >>> 0) ^ Math.imul(floorIndex >>> 0, 0x9e3779b1) ^ salt);
}

export class SeededRandom {
  constructor(seed = 1) { this.state = hash32(seed) || 0x6d2b79f5; }
  random() {
    let t = this.state += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min, max) { return min + (max - min) * this.random(); }
  int(min, max) { return Math.floor(this.range(min, max + 1)); }
  pick(array) { return array[this.int(0, array.length - 1)]; }
  chance(probability) { return this.random() < probability; }
}
